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

CREATE TABLE IF NOT EXISTS showroom.blog_publication_attempts (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES showroom.blog_posts(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  expected_updated_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'staged',
  object_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  retired_cleanup_job_id UUID REFERENCES showroom.storage_cleanup_jobs(id) ON DELETE SET NULL,
  staging_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  published_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_publication_attempts_status_check
    CHECK (status IN ('staged', 'published', 'abandoned', 'reconcile'))
);

CREATE TABLE IF NOT EXISTS showroom.blog_public_media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  media_id UUID REFERENCES showroom.blog_media(id) ON DELETE SET NULL,
  publication_attempt_id UUID NOT NULL,
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT blog_public_media_objects_state_check
    CHECK (state IN ('active', 'retired', 'trash_pending', 'deleted'))
);

CREATE INDEX IF NOT EXISTS blog_publication_attempts_post_idx
  ON showroom.blog_publication_attempts(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_public_media_objects_post_state_idx
  ON showroom.blog_public_media_objects(post_id, state, created_at DESC);

ALTER TABLE showroom.blog_publication_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.blog_public_media_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON showroom.blog_publication_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON showroom.blog_public_media_objects FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON showroom.blog_publication_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_public_media_objects TO service_role;

-- Preserve derivatives created before this ledger existed. The media id is a
-- stable legacy attempt identifier; later publications use their real attempt.
INSERT INTO showroom.blog_public_media_objects (
  post_id,
  media_id,
  publication_attempt_id,
  bucket,
  object_path,
  state
)
SELECT
  media.post_id,
  media.id,
  media.id,
  media.public_bucket,
  media.public_object_path,
  CASE
    WHEN media.usage_status = 'published'::showroom.blog_media_usage_status THEN 'active'
    ELSE 'retired'
  END
FROM showroom.blog_media AS media
WHERE media.post_id IS NOT NULL
  AND media.public_bucket = 'blog-media'
  AND NULLIF(media.public_object_path, '') IS NOT NULL
ON CONFLICT (object_path) DO NOTHING;

-- Create the durable attempt while holding the same post lock used by publish,
-- trash, and permanent deletion. This prevents a staging process from starting
-- after the post has moved to trash.
CREATE OR REPLACE FUNCTION showroom.create_blog_publication_attempt(
  p_publication_attempt_id UUID,
  p_post_id UUID,
  p_actor_id UUID,
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_status showroom.blog_post_status;
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  SELECT post.status, post.updated_at
  INTO v_status, v_updated_at
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post does not exist';
  END IF;
  IF v_status IN (
    'published'::showroom.blog_post_status,
    'archived'::showroom.blog_post_status
  ) THEN
    RAISE EXCEPTION 'published or trashed posts cannot start publication';
  END IF;
  IF v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'blog post changed since the editor loaded';
  END IF;

  PERFORM 1
  FROM showroom.blog_publication_attempts AS attempt
  WHERE attempt.post_id = p_post_id
    AND attempt.status IN ('staged', 'reconcile')
  ORDER BY attempt.id
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'another publication attempt is already in progress';
  END IF;

  INSERT INTO showroom.blog_publication_attempts (
    id,
    post_id,
    actor_id,
    expected_updated_at
  ) VALUES (
    p_publication_attempt_id,
    p_post_id,
    p_actor_id,
    p_expected_updated_at
  );

  RETURN p_publication_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION showroom.create_blog_publication_attempt(UUID, UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.create_blog_publication_attempt(UUID, UUID, UUID, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION showroom.heartbeat_blog_publication_attempt(
  p_publication_attempt_id UUID,
  p_actor_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ := clock_timestamp() + INTERVAL '15 minutes';
BEGIN
  UPDATE showroom.blog_publication_attempts AS attempt
  SET
    staging_expires_at = v_expires_at,
    updated_at = clock_timestamp()
  WHERE attempt.id = p_publication_attempt_id
    AND attempt.actor_id = p_actor_id
    AND attempt.status = 'staged';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publication attempt lease is no longer active';
  END IF;

  RETURN v_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION showroom.heartbeat_blog_publication_attempt(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.heartbeat_blog_publication_attempt(UUID, UUID)
  TO service_role;

-- Recovery is two-phase. An expired staged attempt is first fenced into
-- reconcile; storage cleanup runs only after a separate grace window. A late
-- upload therefore observes the lost heartbeat and can clean itself, while a
-- crashed process leaves durable paths for the delayed retry.
CREATE OR REPLACE FUNCTION showroom.claim_expired_blog_publication_attempt(
  p_publication_attempt_id UUID,
  p_actor_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  PERFORM 1
  FROM showroom.blog_publication_attempts AS attempt
  WHERE attempt.id = p_publication_attempt_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE showroom.blog_publication_attempts AS attempt
  SET
    status = 'reconcile',
    last_error = 'staging heartbeat expired; administrator recovery claimed',
    updated_at = clock_timestamp()
  WHERE attempt.id = p_publication_attempt_id
    AND attempt.status = 'staged'
    AND attempt.staging_expires_at <= clock_timestamp();

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION showroom.claim_expired_blog_publication_attempt(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.claim_expired_blog_publication_attempt(UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION showroom.save_and_publish_blog_post(
  p_publication_attempt_id UUID,
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
  v_persisted_updated_at TIMESTAMPTZ;
  v_block JSONB;
  v_attempt_paths TEXT[];
  v_retired_public_paths TEXT[] := ARRAY[]::TEXT[];
  v_retired_cleanup_job_id UUID;
  v_published_at TIMESTAMPTZ := clock_timestamp();
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
  IF pg_catalog.length(pg_catalog.btrim(COALESCE(p_post ->> 'summary_answer', ''))) <= 20 THEN
    RAISE EXCEPTION 'summary answer must contain at least 21 characters'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(pg_catalog.btrim(p_post ->> 'title'), '') IS NULL
    OR NULLIF(pg_catalog.btrim(p_post ->> 'slug'), '') IS NULL
    OR pg_catalog.btrim(p_post ->> 'slug') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  THEN
    RAISE EXCEPTION 'title and a valid slug are required for publication'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.length(pg_catalog.btrim(COALESCE(p_post ->> 'meta_description', ''))) NOT BETWEEN 50 AND 180
    OR NULLIF(pg_catalog.btrim(p_post ->> 'target_question'), '') IS NULL
  THEN
    RAISE EXCEPTION 'publication SEO fields do not pass the required boundary'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_blocks) AS incoming(block)
    WHERE incoming.block ->> 'type' = 'cta'
  ) THEN
    RAISE EXCEPTION 'a published post must contain a CTA block'
      USING ERRCODE = '22023';
  END IF;

  SELECT attempt.object_paths
  INTO v_attempt_paths
  FROM showroom.blog_publication_attempts AS attempt
  WHERE attempt.id = p_publication_attempt_id
    AND attempt.post_id = p_post_id
    AND attempt.actor_id = p_actor_id
    AND attempt.expected_updated_at = p_expected_updated_at
    AND attempt.status = 'staged'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publication attempt is missing or already finalized';
  END IF;

  PERFORM 1
  FROM showroom.blog_editor_save_leases AS lease
  WHERE lease.post_id = p_post_id
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'an editor save is already in progress';
  END IF;

  -- Deterministic lock order: post -> attempt -> assets -> media -> blocks ->
  -- usages -> questions. Lock every asset currently connected to the post,
  -- including assets removed by this publication, before usage triggers can
  -- update their counters.
  -- The asset archive RPC also locks assets before media/usages, avoiding the
  -- inverse order that could otherwise deadlock an archive against publication.
  PERFORM 1
  FROM showroom.content_assets AS asset
  WHERE asset.id IN (
    SELECT media.content_asset_id
    FROM showroom.blog_media AS media
    WHERE media.post_id = p_post_id
      AND media.content_asset_id IS NOT NULL
    UNION
    SELECT usage.asset_id
    FROM showroom.content_asset_usages AS usage
    WHERE (
      usage.ref_table = 'showroom.blog_posts'
      AND usage.ref_id = p_post_id
    ) OR (
      usage.ref_table = 'showroom.blog_blocks'
      AND EXISTS (
        SELECT 1
        FROM showroom.blog_blocks AS referenced_block
        WHERE referenced_block.id = usage.ref_id
          AND referenced_block.post_id = p_post_id
      )
    )
  )
  ORDER BY asset.id
  FOR UPDATE;

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

  IF EXISTS (
    SELECT 1
    FROM showroom.blog_media AS media
    LEFT JOIN showroom.content_assets AS asset
      ON asset.id = media.content_asset_id
    WHERE media.post_id = p_post_id
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
        WHERE NULLIF(publication.item ->> 'id', '')::UUID = media.id
      )
      AND media.content_asset_id IS NOT NULL
      AND (
        asset.id IS NULL
        OR asset.library_state = 'archived'::showroom.content_asset_library_state
        OR NOT asset.privacy_checked
        OR NOT asset.promotion_consent_checked
        OR (
          asset.labels ? 'centralBrand'
          AND (
            asset.labels #>> '{centralBrand,privacyStatus}' IS DISTINCT FROM 'official_reviewed'
            OR asset.labels #>> '{centralBrand,claimRisk}' IS DISTINCT FROM 'low'
            OR asset.labels #>> '{centralBrand,externalPublish}' IS DISTINCT FROM 'allowed_after_context_check'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'a linked content asset changed or no longer passes the publication gate';
  END IF;

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

  IF NULLIF(pg_catalog.btrim(p_post ->> 'media_missing_reason'), '') IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM showroom.blog_media AS media
      WHERE media.post_id = p_post_id
        AND media.used_as_cover
        AND EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
          WHERE NULLIF(publication.item ->> 'id', '')::UUID = media.id
        )
    )
  THEN
    RAISE EXCEPTION 'a cover image or a documented media exception is required';
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

  IF (
    SELECT pg_catalog.count(*) <> pg_catalog.count(DISTINCT publication.item ->> 'id')
      OR pg_catalog.count(*) <> pg_catalog.count(DISTINCT publication.item ->> 'public_object_path')
    FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
  ) THEN
    RAISE EXCEPTION 'publication media contains duplicate ids or object paths';
  END IF;

  IF (
    SELECT COALESCE(
      pg_catalog.array_agg(publication.item ->> 'public_object_path' ORDER BY publication.item ->> 'public_object_path'),
      ARRAY[]::TEXT[]
    )
    FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
  ) IS DISTINCT FROM (
    SELECT COALESCE(pg_catalog.array_agg(path ORDER BY path), ARRAY[]::TEXT[])
    FROM pg_catalog.unnest(v_attempt_paths) AS paths(path)
  ) THEN
    RAISE EXCEPTION 'publication attempt paths do not match the media snapshot';
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
    reviewed_at = v_published_at,
    published_block_id = block.id,
    published_at = v_published_at
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
    published_at = v_published_at,
    updated_at = v_published_at
  FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item)
  WHERE media.id = NULLIF(publication.item ->> 'id', '')::UUID
    AND media.post_id = p_post_id
    AND media.usage_status = 'approved'::showroom.blog_media_usage_status;

  SELECT COALESCE(pg_catalog.array_agg(object.object_path ORDER BY object.object_path), ARRAY[]::TEXT[])
  INTO v_retired_public_paths
  FROM showroom.blog_public_media_objects AS object
  WHERE object.post_id = p_post_id
    AND object.state = 'active';

  UPDATE showroom.blog_public_media_objects AS object
  SET state = 'retired'
  WHERE object.post_id = p_post_id
    AND object.state = 'active';

  IF pg_catalog.cardinality(v_retired_public_paths) > 0 THEN
    INSERT INTO showroom.storage_cleanup_jobs (
      bucket,
      object_paths,
      reason,
      actor_id
    ) VALUES (
      'blog-media',
      v_retired_public_paths,
      'retired_blog_publication:' || p_publication_attempt_id::TEXT,
      p_actor_id
    )
    RETURNING id INTO v_retired_cleanup_job_id;
  END IF;

  INSERT INTO showroom.blog_public_media_objects (
    post_id,
    media_id,
    publication_attempt_id,
    bucket,
    object_path,
    state
  )
  SELECT
    p_post_id,
    NULLIF(publication.item ->> 'id', '')::UUID,
    p_publication_attempt_id,
    publication.item ->> 'public_bucket',
    publication.item ->> 'public_object_path',
    'active'
  FROM pg_catalog.jsonb_array_elements(p_media) AS publication(item);

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
    published_at = v_published_at,
    updated_at = v_published_at
  WHERE post.id = p_post_id
    AND post.status = v_post_status
    AND post.updated_at = p_expected_updated_at
  RETURNING post.updated_at INTO v_persisted_updated_at;
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
      'publication_attempt_id', p_publication_attempt_id,
      'previous_slug', v_post_slug,
      'published_media_ids', (
        SELECT COALESCE(pg_catalog.jsonb_agg(item ->> 'id'), '[]'::JSONB)
        FROM pg_catalog.jsonb_array_elements(p_media) AS media(item)
      )
    )
  );

  UPDATE showroom.blog_publication_attempts AS attempt
  SET
    status = 'published',
    retired_cleanup_job_id = v_retired_cleanup_job_id,
    published_at = v_published_at,
    updated_at = clock_timestamp()
  WHERE attempt.id = p_publication_attempt_id
    AND attempt.status = 'staged';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publication attempt changed during publication';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'post_id', p_post_id,
    'slug', p_post ->> 'slug',
    'published_at', v_published_at,
    'updated_at', v_persisted_updated_at,
    'retired_public_paths', pg_catalog.to_jsonb(v_retired_public_paths),
    'retired_cleanup_job_id', v_retired_cleanup_job_id
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.save_and_publish_blog_post(
  UUID, UUID, TIMESTAMPTZ, UUID, JSONB, JSONB, JSONB, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.save_and_publish_blog_post(
  UUID, UUID, TIMESTAMPTZ, UUID, JSONB, JSONB, JSONB, TIMESTAMPTZ
) TO service_role;

-- A plain SELECT can observe the old staged row while the publication
-- transaction is still running. This resolver takes a row lock, so an
-- ambiguous RPC response is classified only after commit or rollback.
CREATE OR REPLACE FUNCTION showroom.resolve_blog_publication_attempt(
  p_publication_attempt_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_attempt showroom.blog_publication_attempts%ROWTYPE;
BEGIN
  SELECT attempt.*
  INTO v_attempt
  FROM showroom.blog_publication_attempts AS attempt
  WHERE attempt.id = p_publication_attempt_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'publication attempt does not exist';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'status', v_attempt.status,
    'post_id', v_attempt.post_id,
    'updated_at', (
      SELECT post.updated_at
      FROM showroom.blog_posts AS post
      WHERE post.id = v_attempt.post_id
    ),
    'object_paths', pg_catalog.to_jsonb(v_attempt.object_paths),
    'retired_public_paths', COALESCE(
      (
        SELECT pg_catalog.to_jsonb(job.object_paths)
        FROM showroom.storage_cleanup_jobs AS job
        WHERE job.id = v_attempt.retired_cleanup_job_id
      ),
      '[]'::JSONB
    ),
    'retired_cleanup_job_id', v_attempt.retired_cleanup_job_id,
    'published_at', v_attempt.published_at
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.resolve_blog_publication_attempt(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.resolve_blog_publication_attempt(UUID)
  TO service_role;

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
  v_public_paths TEXT[] := ARRAY[]::TEXT[];
  v_cleanup_job_id UUID;
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
  FROM showroom.blog_publication_attempts AS attempt
  WHERE attempt.post_id = p_post_id
    AND attempt.status IN ('staged', 'reconcile')
  ORDER BY attempt.id
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'a publication attempt is still in progress';
  END IF;

  PERFORM 1
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
  ORDER BY media.id
  FOR UPDATE;

  PERFORM 1
  FROM showroom.blog_public_media_objects AS object
  WHERE object.post_id = p_post_id
  ORDER BY object.id
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

    SELECT COALESCE(pg_catalog.array_agg(DISTINCT paths.path), ARRAY[]::TEXT[])
    INTO v_public_paths
    FROM (
      SELECT object.object_path AS path
      FROM showroom.blog_public_media_objects AS object
      WHERE object.post_id = p_post_id
        AND object.state <> 'deleted'
      UNION
      SELECT media.public_object_path AS path
      FROM showroom.blog_media AS media
      WHERE media.post_id = p_post_id
        AND media.public_bucket = 'blog-media'
        AND NULLIF(media.public_object_path, '') IS NOT NULL
    ) AS paths;

    UPDATE showroom.blog_public_media_objects AS object
    SET state = 'trash_pending'
    WHERE object.post_id = p_post_id
      AND object.state <> 'deleted';
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
    AND post.status = v_from_status
  RETURNING post.updated_at INTO v_changed_at;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post changed during trash transition';
  END IF;

  IF NOT p_restore AND pg_catalog.cardinality(v_public_paths) > 0 THEN
    INSERT INTO showroom.storage_cleanup_jobs (
      bucket,
      object_paths,
      reason,
      actor_id
    ) VALUES (
      'blog-media',
      v_public_paths,
      'trashed_blog_post:' || p_post_id::TEXT,
      p_actor_id
    )
    RETURNING id INTO v_cleanup_job_id;
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
    'public_paths', pg_catalog.to_jsonb(v_public_paths),
    'cleanup_job_id', v_cleanup_job_id,
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
  FROM showroom.blog_publication_attempts AS attempt
  WHERE attempt.post_id = p_post_id
    AND attempt.status IN ('staged', 'reconcile')
  ORDER BY attempt.id
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'a publication attempt is still in progress';
  END IF;

  PERFORM 1
  FROM showroom.content_assets AS asset
  WHERE asset.id IN (
    SELECT media.content_asset_id
    FROM showroom.blog_media AS media
    WHERE media.post_id = p_post_id
      AND media.content_asset_id IS NOT NULL
    UNION
    SELECT usage.asset_id
    FROM showroom.content_asset_usages AS usage
    WHERE (
      usage.ref_table = 'showroom.blog_posts'
      AND usage.ref_id = p_post_id
    ) OR (
      usage.ref_table = 'showroom.blog_blocks'
      AND EXISTS (
        SELECT 1
        FROM showroom.blog_blocks AS referenced_block
        WHERE referenced_block.id = usage.ref_id
          AND referenced_block.post_id = p_post_id
      )
    )
  )
  ORDER BY asset.id
  FOR UPDATE;

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

  SELECT COALESCE(pg_catalog.array_agg(DISTINCT paths.path), ARRAY[]::TEXT[])
  INTO v_public_paths
  FROM (
    SELECT object.object_path AS path
    FROM showroom.blog_public_media_objects AS object
    WHERE object.post_id = p_post_id
      AND object.state <> 'deleted'
    UNION
    SELECT media.public_object_path AS path
    FROM showroom.blog_media AS media
    WHERE media.post_id = p_post_id
      AND media.public_bucket = 'blog-media'
      AND NULLIF(media.public_object_path, '') IS NOT NULL
  ) AS paths;

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

  -- Delete image blocks before media. The media FK uses ON DELETE SET NULL
  -- while the image-block CHECK requires a non-null media_id.
  DELETE FROM showroom.blog_blocks AS block
  WHERE block.post_id = p_post_id;

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
REVOKE UPDATE ON showroom.blog_posts FROM authenticated;
GRANT UPDATE (
  title,
  slug,
  excerpt,
  seo_title,
  meta_description,
  canonical_url,
  category,
  primary_keyword,
  target_question,
  summary_answer,
  related_questions,
  service_area,
  product_type,
  source_evidence,
  brand_check_result,
  ai_model,
  source_prompt,
  ai_citation_ready,
  last_fact_checked_at,
  media_missing_reason,
  updated_at
) ON showroom.blog_posts TO authenticated;

REVOKE ALL ON FUNCTION showroom.permanently_delete_blog_post(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.permanently_delete_blog_post(UUID, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
