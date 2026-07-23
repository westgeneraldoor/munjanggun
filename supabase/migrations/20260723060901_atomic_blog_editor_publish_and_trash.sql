-- Keep editor data, publication state, media references, asset usages, reader
-- Q&A links, and the audit event in one database transaction. Storage uploads
-- are staged by the server action first and removed if this RPC rolls back.

CREATE TABLE IF NOT EXISTS showroom.storage_cleanup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  object_paths TEXT[] NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  actor_id UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT storage_cleanup_jobs_paths_check CHECK (cardinality(object_paths) > 0),
  CONSTRAINT storage_cleanup_jobs_status_check CHECK (status IN ('pending', 'completed', 'failed'))
);

ALTER TABLE showroom.storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON showroom.storage_cleanup_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON showroom.storage_cleanup_jobs TO service_role;

CREATE OR REPLACE FUNCTION showroom.save_and_publish_blog_post(
  p_post_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_actor_id UUID,
  p_post JSONB,
  p_blocks JSONB,
  p_media JSONB,
  p_published_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_post_status showroom.blog_post_status;
  v_post_slug TEXT;
  v_post_updated_at TIMESTAMPTZ;
  v_block JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  IF pg_catalog.jsonb_typeof(p_post) IS DISTINCT FROM 'object'
    OR pg_catalog.jsonb_typeof(p_blocks) IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_typeof(p_media) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION 'post, blocks, and media must use the documented JSON shapes'
      USING ERRCODE = '22023';
  END IF;

  IF pg_catalog.jsonb_array_length(p_blocks) = 0 THEN
    RAISE EXCEPTION 'a published post must contain at least one block'
      USING ERRCODE = '22023';
  END IF;

  SELECT post.status, post.slug, post.updated_at
  INTO v_post_status, v_post_slug, v_post_updated_at
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post does not exist';
  END IF;
  IF v_post_status IN (
    'published'::showroom.blog_post_status,
    'archived'::showroom.blog_post_status
  ) THEN
    RAISE EXCEPTION 'published or trashed posts cannot use one-click publication';
  END IF;
  IF v_post_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'blog post changed since the editor loaded';
  END IF;

  PERFORM 1
  FROM showroom.blog_editor_save_leases AS lease
  WHERE lease.post_id = p_post_id
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'an editor save is already in progress';
  END IF;

  -- Deterministic lock order: post -> media -> blocks -> usages -> questions.
  PERFORM 1
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
  ORDER BY media.id
  FOR UPDATE;

  PERFORM 1
  FROM showroom.blog_blocks AS block
  WHERE block.post_id = p_post_id
  ORDER BY block.id
  FOR UPDATE;

  PERFORM 1
  FROM showroom.content_asset_usages AS usage
  WHERE (
    usage.ref_table = 'showroom.blog_posts'
    AND usage.ref_id = p_post_id
  ) OR (
    usage.ref_table = 'showroom.blog_blocks'
    AND EXISTS (
      SELECT 1
      FROM showroom.blog_blocks AS locked_block
      WHERE locked_block.id = usage.ref_id
        AND locked_block.post_id = p_post_id
    )
  )
  ORDER BY usage.id
  FOR UPDATE;

  PERFORM 1
  FROM platform.blog_article_questions AS question
  WHERE question.post_id = p_post_id
  ORDER BY question.id
  FOR UPDATE;

  FOR v_block IN
    SELECT item
    FROM pg_catalog.jsonb_array_elements(p_blocks) AS blocks(item)
  LOOP
    IF NULLIF(v_block ->> 'id', '') IS NULL THEN
      RAISE EXCEPTION 'every publication block must have a stable id';
    END IF;
    IF (v_block ->> 'type') = 'image' AND NULLIF(v_block ->> 'media_id', '') IS NULL THEN
      RAISE EXCEPTION 'image blocks must reference media';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT NULLIF(block ->> 'media_id', '')::UUID AS media_id
      FROM pg_catalog.jsonb_array_elements(p_blocks) AS incoming(block)
      WHERE block ->> 'type' = 'image'
      UNION
      SELECT media.id
      FROM showroom.blog_media AS media
      WHERE media.post_id = p_post_id
        AND media.used_as_cover
    ) AS required_media
    WHERE required_media.media_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
        WHERE NULLIF(publication.item ->> 'id', '')::UUID = required_media.media_id
      )
  ) THEN
    RAISE EXCEPTION 'publication media snapshot is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
    LEFT JOIN showroom.blog_media AS media
      ON media.id = NULLIF(publication.item ->> 'id', '')::UUID
      AND media.post_id = p_post_id
    WHERE media.id IS NULL
      OR media.usage_status IS DISTINCT FROM 'approved'::showroom.blog_media_usage_status
      OR NULLIF(pg_catalog.btrim(media.alt_text), '') IS NULL
      OR NOT media.privacy_checked
      OR NOT media.promotion_consent_checked
      OR NULLIF(publication.item ->> 'public_object_path', '') IS NULL
      OR NULLIF(publication.item ->> 'public_url', '') IS NULL
      OR publication.item ->> 'public_bucket' IS DISTINCT FROM 'blog-media'
  ) THEN
    RAISE EXCEPTION 'publication media changed or no longer passes the safety gate';
  END IF;

  UPDATE platform.blog_article_questions AS question
  SET
    status = 'pending_review'::platform.blog_question_status,
    published_block_id = NULL,
    published_at = NULL
  WHERE question.post_id = p_post_id
    AND question.published_block_id IS NOT NULL;

  DELETE FROM showroom.content_asset_usages AS usage
  WHERE (
    usage.ref_table = 'showroom.blog_posts'
    AND usage.ref_id = p_post_id
  ) OR (
    usage.ref_table = 'showroom.blog_blocks'
    AND EXISTS (
      SELECT 1
      FROM showroom.blog_blocks AS old_block
      WHERE old_block.id = usage.ref_id
        AND old_block.post_id = p_post_id
    )
  );

  DELETE FROM showroom.blog_blocks AS block
  WHERE block.post_id = p_post_id;

  INSERT INTO showroom.blog_blocks (
    id,
    post_id,
    display_order,
    type,
    heading_level,
    text,
    media_id,
    metadata
  )
  SELECT
    NULLIF(blocks.block ->> 'id', '')::UUID,
    p_post_id,
    blocks.display_order - 1,
    (blocks.block ->> 'type')::showroom.blog_block_type,
    NULLIF(blocks.block ->> 'heading_level', '')::INTEGER,
    NULLIF(blocks.block ->> 'text', ''),
    NULLIF(blocks.block ->> 'media_id', '')::UUID,
    COALESCE(blocks.block -> 'metadata', '{}'::JSONB)
  FROM pg_catalog.jsonb_array_elements(p_blocks)
    WITH ORDINALITY AS blocks(block, display_order);

  INSERT INTO showroom.content_asset_usages (
    asset_id,
    usage_context,
    ref_table,
    ref_id,
    role,
    caption_override,
    alt_text_override,
    metadata,
    created_by
  )
  SELECT
    media.content_asset_id,
    'blog_block'::showroom.content_asset_usage_context,
    'showroom.blog_blocks',
    block.id,
    'body'::showroom.content_asset_usage_role,
    NULLIF(pg_catalog.btrim(media.caption), ''),
    NULLIF(pg_catalog.btrim(media.alt_text), ''),
    pg_catalog.jsonb_build_object(
      'post_id', p_post_id,
      'blog_media_id', media.id,
      'source_label', media.source_label
    ),
    p_actor_id
  FROM showroom.blog_blocks AS block
  JOIN showroom.blog_media AS media
    ON media.id = block.media_id
    AND media.post_id = p_post_id
  WHERE block.post_id = p_post_id
    AND block.type = 'image'::showroom.blog_block_type
    AND media.content_asset_id IS NOT NULL;

  INSERT INTO showroom.content_asset_usages (
    asset_id,
    usage_context,
    ref_table,
    ref_id,
    role,
    caption_override,
    alt_text_override,
    metadata,
    created_by
  )
  SELECT
    media.content_asset_id,
    'blog_post'::showroom.content_asset_usage_context,
    'showroom.blog_posts',
    p_post_id,
    'cover'::showroom.content_asset_usage_role,
    NULLIF(pg_catalog.btrim(media.caption), ''),
    NULLIF(pg_catalog.btrim(media.alt_text), ''),
    pg_catalog.jsonb_build_object(
      'blog_media_id', media.id,
      'source_label', media.source_label
    ),
    p_actor_id
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
    AND media.used_as_cover
    AND media.content_asset_id IS NOT NULL;

  UPDATE platform.blog_article_questions AS question
  SET
    status = 'approved'::platform.blog_question_status,
    approved_question = NULLIF(pg_catalog.btrim(block.text), ''),
    approved_answer = NULLIF(pg_catalog.btrim(block.metadata ->> 'answer'), ''),
    reviewed_by = p_actor_id,
    reviewed_at = p_published_at,
    published_block_id = block.id,
    published_at = p_published_at
  FROM showroom.blog_blocks AS block
  WHERE block.post_id = p_post_id
    AND block.type = 'qa'::showroom.blog_block_type
    AND NULLIF(block.metadata ->> 'source_blog_question_id', '')::UUID = question.id
    AND question.post_id = p_post_id;

  UPDATE showroom.blog_media AS media
  SET
    usage_status = 'published'::showroom.blog_media_usage_status,
    public_bucket = publication.item ->> 'public_bucket',
    public_object_path = publication.item ->> 'public_object_path',
    public_url = publication.item ->> 'public_url',
    published_at = p_published_at,
    updated_at = p_published_at
  FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
  WHERE media.id = NULLIF(publication.item ->> 'id', '')::UUID
    AND media.post_id = p_post_id
    AND media.usage_status = 'approved'::showroom.blog_media_usage_status;

  UPDATE showroom.blog_posts AS post
  SET
    title = pg_catalog.btrim(p_post ->> 'title'),
    slug = pg_catalog.btrim(p_post ->> 'slug'),
    excerpt = NULLIF(pg_catalog.btrim(p_post ->> 'excerpt'), ''),
    category = (p_post ->> 'category')::showroom.blog_content_category,
    seo_title = NULLIF(pg_catalog.btrim(p_post ->> 'seo_title'), ''),
    meta_description = NULLIF(pg_catalog.btrim(p_post ->> 'meta_description'), ''),
    canonical_url = NULLIF(pg_catalog.btrim(p_post ->> 'canonical_url'), ''),
    primary_keyword = NULLIF(pg_catalog.btrim(p_post ->> 'primary_keyword'), ''),
    target_question = NULLIF(pg_catalog.btrim(p_post ->> 'target_question'), ''),
    summary_answer = NULLIF(pg_catalog.btrim(p_post ->> 'summary_answer'), ''),
    related_questions = COALESCE(p_post -> 'related_questions', '[]'::JSONB),
    service_area = NULLIF(pg_catalog.btrim(p_post ->> 'service_area'), ''),
    product_type = NULLIF(pg_catalog.btrim(p_post ->> 'product_type'), ''),
    ai_citation_ready = COALESCE((p_post ->> 'ai_citation_ready')::BOOLEAN, FALSE),
    media_missing_reason = NULLIF(pg_catalog.btrim(p_post ->> 'media_missing_reason'), ''),
    status = 'published'::showroom.blog_post_status,
    reviewed_by = p_actor_id,
    published_by = p_actor_id,
    published_at = p_published_at,
    updated_at = p_published_at
  WHERE post.id = p_post_id
    AND post.status = v_post_status
    AND post.updated_at = p_expected_updated_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post changed during publication';
  END IF;

  INSERT INTO showroom.blog_post_events (
    post_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    memo,
    metadata
  ) VALUES (
    p_post_id,
    p_actor_id,
    'published',
    v_post_status,
    'published'::showroom.blog_post_status,
    '현재 편집 내용을 저장하고 안전 검사를 통과해 발행했습니다.',
    pg_catalog.jsonb_build_object(
      'atomic_editor_publish', TRUE,
      'previous_slug', v_post_slug,
      'published_media_ids', (
        SELECT COALESCE(pg_catalog.jsonb_agg(item ->> 'id'), '[]'::JSONB)
        FROM pg_catalog.jsonb_array_elements(p_media) AS media(item)
      )
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'post_id', p_post_id,
    'slug', p_post ->> 'slug',
    'published_at', p_published_at
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.save_and_publish_blog_post(
  UUID, TIMESTAMPTZ, UUID, JSONB, JSONB, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.save_and_publish_blog_post(
  UUID, TIMESTAMPTZ, UUID, JSONB, JSONB, JSONB, TIMESTAMPTZ
) TO service_role;

CREATE OR REPLACE FUNCTION showroom.transition_blog_post_trash(
  p_post_id UUID,
  p_actor_id UUID,
  p_restore BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_from_status showroom.blog_post_status;
  v_to_status showroom.blog_post_status;
  v_slug TEXT;
  v_changed_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  SELECT post.status, post.slug
  INTO v_from_status, v_slug
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post does not exist';
  END IF;

  PERFORM 1
  FROM showroom.blog_editor_save_leases AS lease
  WHERE lease.post_id = p_post_id
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'an editor save is already in progress';
  END IF;

  PERFORM 1
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
  ORDER BY media.id
  FOR UPDATE;

  IF p_restore THEN
    IF v_from_status IS DISTINCT FROM 'archived'::showroom.blog_post_status THEN
      RAISE EXCEPTION 'only a trashed post can be restored';
    END IF;
    v_to_status := 'reviewing'::showroom.blog_post_status;
  ELSE
    IF v_from_status = 'archived'::showroom.blog_post_status THEN
      RAISE EXCEPTION 'blog post is already in trash';
    END IF;
    v_to_status := 'archived'::showroom.blog_post_status;

    -- A restored publication must pass the media gate again. Keep the immutable
    -- public derivative as rollback evidence but return the DB row to approved.
    UPDATE showroom.blog_media AS media
    SET
      usage_status = 'approved'::showroom.blog_media_usage_status,
      published_at = NULL,
      updated_at = v_changed_at
    WHERE media.post_id = p_post_id
      AND media.usage_status = 'published'::showroom.blog_media_usage_status;
  END IF;

  UPDATE showroom.blog_posts AS post
  SET
    status = v_to_status,
    reviewed_by = CASE WHEN p_restore THEN p_actor_id ELSE post.reviewed_by END,
    published_by = CASE WHEN p_restore OR v_from_status = 'published'::showroom.blog_post_status
      THEN NULL
      ELSE post.published_by
    END,
    published_at = CASE WHEN p_restore OR v_from_status = 'published'::showroom.blog_post_status
      THEN NULL
      ELSE post.published_at
    END,
    updated_at = v_changed_at
  WHERE post.id = p_post_id
    AND post.status = v_from_status;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post changed during trash transition';
  END IF;

  INSERT INTO showroom.blog_post_events (
    post_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    memo,
    metadata
  ) VALUES (
    p_post_id,
    p_actor_id,
    CASE WHEN p_restore THEN 'restored_from_trash' ELSE 'moved_to_trash' END,
    v_from_status,
    v_to_status,
    CASE
      WHEN p_restore THEN '휴지통의 글을 초안으로 복원했습니다.'
      WHEN v_from_status = 'published'::showroom.blog_post_status
        THEN '발행 글을 휴지통으로 이동해 공개 URL 노출을 중단했습니다.'
      ELSE '글을 휴지통으로 이동했습니다.'
    END,
    jsonb_build_object('previous_status', v_from_status, 'slug', v_slug)
  );

  RETURN jsonb_build_object(
    'post_id', p_post_id,
    'status', v_to_status,
    'slug', v_slug,
    'changed_at', v_changed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.transition_blog_post_trash(UUID, UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.transition_blog_post_trash(UUID, UUID, BOOLEAN)
  TO service_role;

-- Permanent deletion is available only from the trash, requires the exact post
-- title, and records public derivatives for durable post-commit cleanup.
CREATE OR REPLACE FUNCTION showroom.permanently_delete_blog_post(
  p_post_id UUID,
  p_actor_id UUID,
  p_confirmation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_post_status showroom.blog_post_status;
  v_post_title TEXT;
  v_post_slug TEXT;
  v_public_paths TEXT[];
  v_cleanup_job_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  SELECT post.status, post.title, post.slug
  INTO v_post_status, v_post_title, v_post_slug
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post does not exist';
  END IF;
  IF v_post_status IS DISTINCT FROM 'archived'::showroom.blog_post_status THEN
    RAISE EXCEPTION 'only a trashed post can be permanently deleted';
  END IF;
  IF p_confirmation IS DISTINCT FROM v_post_title THEN
    RAISE EXCEPTION 'the exact post title is required for permanent deletion';
  END IF;

  PERFORM 1
  FROM showroom.blog_editor_save_leases AS lease
  WHERE lease.post_id = p_post_id
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'an editor save is already in progress';
  END IF;

  PERFORM 1
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
  ORDER BY media.id
  FOR UPDATE;

  PERFORM 1
  FROM showroom.blog_blocks AS block
  WHERE block.post_id = p_post_id
  ORDER BY block.id
  FOR UPDATE;

  PERFORM 1
  FROM platform.blog_article_questions AS question
  WHERE question.post_id = p_post_id
  ORDER BY question.id
  FOR UPDATE;

  SELECT pg_catalog.array_agg(DISTINCT media.public_object_path)
  INTO v_public_paths
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
    AND media.public_bucket = 'blog-media'
    AND NULLIF(media.public_object_path, '') IS NOT NULL;

  UPDATE platform.blog_article_questions AS question
  SET
    status = 'archived'::platform.blog_question_status,
    published_block_id = NULL,
    published_at = NULL,
    reviewed_by = COALESCE(question.reviewed_by, p_actor_id),
    reviewed_at = COALESCE(question.reviewed_at, NOW())
  WHERE question.post_id = p_post_id
    AND question.published_block_id IS NOT NULL;

  DELETE FROM showroom.content_asset_usages AS usage
  WHERE (
    usage.ref_table = 'showroom.blog_posts'
    AND usage.ref_id = p_post_id
  ) OR (
    usage.ref_table = 'showroom.blog_blocks'
    AND EXISTS (
      SELECT 1
      FROM showroom.blog_blocks AS block
      WHERE block.id = usage.ref_id
        AND block.post_id = p_post_id
    )
  );

  DELETE FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id;

  DELETE FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
    AND post.status = 'archived'::showroom.blog_post_status;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post changed during permanent deletion';
  END IF;

  IF COALESCE(pg_catalog.cardinality(v_public_paths), 0) > 0 THEN
    INSERT INTO showroom.storage_cleanup_jobs (
      bucket,
      object_paths,
      reason,
      actor_id
    ) VALUES (
      'blog-media',
      v_public_paths,
      'permanently_deleted_blog_post:' || p_post_id::TEXT,
      p_actor_id
    )
    RETURNING id INTO v_cleanup_job_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'deleted', TRUE,
    'post_id', p_post_id,
    'title', v_post_title,
    'slug', v_post_slug,
    'cleanup_job_id', v_cleanup_job_id,
    'public_paths', COALESCE(pg_catalog.to_jsonb(v_public_paths), '[]'::JSONB)
  );
END;
$$;

DROP POLICY IF EXISTS blog_posts_admin_delete ON showroom.blog_posts;
REVOKE DELETE ON showroom.blog_posts FROM authenticated;

REVOKE ALL ON FUNCTION showroom.permanently_delete_blog_post(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.permanently_delete_blog_post(UUID, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
