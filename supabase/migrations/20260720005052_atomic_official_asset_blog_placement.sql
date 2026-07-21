-- Atomically connect a validated central brand asset to a reviewing blog post.
-- The caller imports and verifies the content asset first; this RPC owns every
-- post/media/usage/cover/block/audit write so publish and editor races roll back.

CREATE TABLE IF NOT EXISTS showroom.blog_editor_save_leases (
  post_id UUID PRIMARY KEY REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  lease_token UUID NOT NULL UNIQUE,
  actor_id UUID NOT NULL REFERENCES platform.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE showroom.blog_editor_save_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON showroom.blog_editor_save_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON showroom.blog_editor_save_leases TO service_role;

CREATE OR REPLACE FUNCTION showroom.acquire_blog_editor_save_lease(
  p_post_id UUID,
  p_actor_id UUID,
  p_lease_token UUID,
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_post_status showroom.blog_post_status;
  v_post_updated_at TIMESTAMPTZ;
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
  INTO v_post_status, v_post_updated_at
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post does not exist';
  END IF;
  IF v_post_status = 'published'::showroom.blog_post_status THEN
    RAISE EXCEPTION 'published posts cannot be edited';
  END IF;
  IF v_post_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'blog post changed since the editor loaded';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM showroom.blog_editor_save_leases AS lease
    WHERE lease.post_id = p_post_id
  ) THEN
    RAISE EXCEPTION 'another editor save is already in progress';
  END IF;

  INSERT INTO showroom.blog_editor_save_leases (
    post_id,
    lease_token,
    actor_id
  ) VALUES (
    p_post_id,
    p_lease_token,
    p_actor_id
  );
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION showroom.release_blog_editor_save_lease(
  p_post_id UUID,
  p_actor_id UUID,
  p_lease_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM showroom.blog_editor_save_leases AS lease
  WHERE lease.post_id = p_post_id
    AND lease.actor_id = p_actor_id
    AND lease.lease_token = p_lease_token;
  v_deleted := FOUND;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION showroom.reconcile_blog_editor_save_lease(
  p_post_id UUID,
  p_actor_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_lease_token UUID;
  v_lease_actor_id UUID;
  v_lease_created_at TIMESTAMPTZ;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 OR length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'reconciliation reason must be between 10 and 500 characters';
  END IF;

  PERFORM 1
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post does not exist';
  END IF;

  SELECT lease.lease_token, lease.actor_id, lease.created_at
  INTO v_lease_token, v_lease_actor_id, v_lease_created_at
  FROM showroom.blog_editor_save_leases AS lease
  WHERE lease.post_id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('released', FALSE, 'reason', 'no_lease');
  END IF;
  IF v_lease_created_at > clock_timestamp() - INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'editor save lease is too recent for reconciliation';
  END IF;

  DELETE FROM showroom.blog_editor_save_leases AS lease
  WHERE lease.post_id = p_post_id
    AND lease.lease_token = v_lease_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'editor save lease changed concurrently';
  END IF;

  INSERT INTO showroom.blog_post_events (
    post_id,
    actor_id,
    event_type,
    memo,
    metadata
  ) VALUES (
    p_post_id,
    p_actor_id,
    'editor_save_lease_reconciled',
    btrim(p_reason),
    jsonb_build_object(
      'lease_actor_id', v_lease_actor_id,
      'lease_created_at', v_lease_created_at
    )
  );

  RETURN jsonb_build_object(
    'released', TRUE,
    'leaseActorId', v_lease_actor_id,
    'leaseCreatedAt', v_lease_created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION showroom.attach_official_asset_to_reviewing_post(
  p_post_id UUID,
  p_asset_id UUID,
  p_actor_id UUID,
  p_alt_text TEXT,
  p_caption TEXT DEFAULT NULL,
  p_source_label TEXT DEFAULT NULL,
  p_existing_block_id UUID DEFAULT NULL,
  p_insert_after_block_id UUID DEFAULT NULL,
  p_set_cover BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_post_status showroom.blog_post_status;
  v_actor_role platform.profile_role;
  v_asset_title TEXT;
  v_central_asset_id TEXT;
  v_original_bucket TEXT;
  v_original_path TEXT;
  v_media_id UUID;
  v_media_count INTEGER := 0;
  v_post_usage_id UUID;
  v_post_usage_role showroom.content_asset_usage_role;
  v_usage_count INTEGER := 0;
  v_cover_id UUID;
  v_cover_count INTEGER := 0;
  v_block_id UUID;
  v_block_media_id UUID;
  v_block_type showroom.blog_block_type;
  v_block_count INTEGER := 0;
  v_anchor_order INTEGER;
  v_insert_order INTEGER;
  v_shift RECORD;
  v_shifted_count INTEGER := 0;
  v_created_media BOOLEAN := FALSE;
  v_created_post_usage BOOLEAN := FALSE;
  v_post_usage_role_changed BOOLEAN := FALSE;
  v_cover_changed BOOLEAN := FALSE;
  v_inserted_block BOOLEAN := FALSE;
  v_block_media_changed BOOLEAN := FALSE;
  v_created_block_usage BOOLEAN := FALSE;
  v_event_count INTEGER := 0;
BEGIN
  IF p_post_id IS NULL OR p_asset_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'post, asset, and actor are required';
  END IF;
  IF length(btrim(coalesce(p_alt_text, ''))) = 0 THEN
    RAISE EXCEPTION 'alt text is required';
  END IF;
  IF p_existing_block_id IS NOT NULL AND p_insert_after_block_id IS NOT NULL THEN
    RAISE EXCEPTION 'existing block and insertion anchor are mutually exclusive';
  END IF;

  SELECT profile.role
  INTO v_actor_role
  FROM platform.profiles AS profile
  WHERE profile.id = p_actor_id;
  IF v_actor_role IS DISTINCT FROM 'administrator'::platform.profile_role THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  SELECT post.status
  INTO v_post_status
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'blog post does not exist';
  END IF;
  IF v_post_status IS DISTINCT FROM 'reviewing'::showroom.blog_post_status THEN
    RAISE EXCEPTION 'only reviewing posts accept candidate media';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM showroom.blog_editor_save_leases AS lease
    WHERE lease.post_id = p_post_id
  ) THEN
    RAISE EXCEPTION 'blog editor save is in progress';
  END IF;

  SELECT asset.title, asset.labels #>> '{centralBrand,assetId}'
  INTO v_asset_title, v_central_asset_id
  FROM showroom.content_assets AS asset
  WHERE asset.id = p_asset_id
    AND asset.privacy_checked
    AND NOT asset.promotion_consent_checked
    AND asset.labels #>> '{centralBrand,privacyStatus}' = 'official_reviewed'
  FOR UPDATE;
  IF NOT FOUND OR length(btrim(coalesce(v_central_asset_id, ''))) = 0 THEN
    RAISE EXCEPTION 'asset is not a validated official central brand candidate';
  END IF;

  SELECT asset_file.bucket, asset_file.object_path
  INTO v_original_bucket, v_original_path
  FROM showroom.content_asset_files AS asset_file
  WHERE asset_file.asset_id = p_asset_id
    AND asset_file.file_role = 'original'::showroom.content_asset_file_role
    AND asset_file.transform_status = 'ready'::showroom.content_asset_transform_status;
  IF NOT FOUND
    OR v_original_bucket IS DISTINCT FROM 'content-assets-private'
    OR length(btrim(coalesce(v_original_path, ''))) = 0
  THEN
    RAISE EXCEPTION 'validated private original is missing';
  END IF;

  PERFORM 1
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
    AND media.content_asset_id = p_asset_id
    AND media.usage_status <> 'rejected'::showroom.blog_media_usage_status
  FOR UPDATE;

  SELECT count(*), min(media.id::TEXT)::UUID
  INTO v_media_count, v_media_id
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
    AND media.content_asset_id = p_asset_id
    AND media.usage_status <> 'rejected'::showroom.blog_media_usage_status;
  IF v_media_count > 1 THEN
    RAISE EXCEPTION 'multiple active media rows point to the same central asset';
  END IF;

  IF v_media_id IS NULL THEN
    INSERT INTO showroom.blog_media (
      post_id,
      content_asset_id,
      source_type,
      private_bucket,
      private_object_path,
      source_label,
      alt_text,
      caption,
      usage_status,
      privacy_checked,
      promotion_consent_checked,
      used_as_cover
    ) VALUES (
      p_post_id,
      p_asset_id,
      'showroom_asset'::showroom.blog_media_source_type,
      v_original_bucket,
      v_original_path,
      coalesce(nullif(btrim(p_source_label), ''), v_asset_title, v_central_asset_id),
      btrim(p_alt_text),
      nullif(btrim(p_caption), ''),
      'candidate'::showroom.blog_media_usage_status,
      TRUE,
      FALSE,
      FALSE
    )
    RETURNING id INTO v_media_id;
    v_created_media := TRUE;
  END IF;

  PERFORM 1
  FROM showroom.content_asset_usages AS usage
  WHERE usage.asset_id = p_asset_id
    AND usage.usage_context = 'blog_post'::showroom.content_asset_usage_context
    AND usage.ref_table = 'showroom.blog_posts'
    AND usage.ref_id = p_post_id
  FOR UPDATE;

  SELECT count(*), min(usage.id::TEXT)::UUID
  INTO v_usage_count, v_post_usage_id
  FROM showroom.content_asset_usages AS usage
  WHERE usage.asset_id = p_asset_id
    AND usage.usage_context = 'blog_post'::showroom.content_asset_usage_context
    AND usage.ref_table = 'showroom.blog_posts'
    AND usage.ref_id = p_post_id;
  IF v_usage_count > 1 THEN
    RAISE EXCEPTION 'multiple post usage rows point to the same central asset';
  END IF;

  IF v_post_usage_id IS NULL THEN
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
    ) VALUES (
      p_asset_id,
      'blog_post'::showroom.content_asset_usage_context,
      'showroom.blog_posts',
      p_post_id,
      CASE WHEN p_set_cover
        THEN 'cover'::showroom.content_asset_usage_role
        ELSE 'body'::showroom.content_asset_usage_role
      END,
      nullif(btrim(p_caption), ''),
      btrim(p_alt_text),
      jsonb_build_object('blog_media_id', v_media_id, 'central_asset_id', v_central_asset_id),
      p_actor_id
    )
    RETURNING id, role INTO v_post_usage_id, v_post_usage_role;
    v_created_post_usage := TRUE;
  ELSE
    SELECT usage.role
    INTO v_post_usage_role
    FROM showroom.content_asset_usages AS usage
    WHERE usage.id = v_post_usage_id;
  END IF;

  IF p_set_cover THEN
    PERFORM 1
    FROM showroom.blog_media AS cover
    WHERE cover.post_id = p_post_id AND cover.used_as_cover
    FOR UPDATE;

    SELECT count(*), min(cover.id::TEXT)::UUID
    INTO v_cover_count, v_cover_id
    FROM showroom.blog_media AS cover
    WHERE cover.post_id = p_post_id AND cover.used_as_cover;
    IF v_cover_count > 1 OR (v_cover_id IS NOT NULL AND v_cover_id IS DISTINCT FROM v_media_id) THEN
      RAISE EXCEPTION 'post already has a different cover';
    END IF;

    IF v_cover_id IS NULL THEN
      UPDATE showroom.blog_media
      SET used_as_cover = TRUE
      WHERE id = v_media_id
        AND post_id = p_post_id
        AND NOT used_as_cover;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'cover media changed concurrently';
      END IF;
      v_cover_changed := TRUE;
    END IF;

    IF v_post_usage_role IS DISTINCT FROM 'cover'::showroom.content_asset_usage_role THEN
      UPDATE showroom.content_asset_usages
      SET role = 'cover'::showroom.content_asset_usage_role
      WHERE id = v_post_usage_id
        AND role = v_post_usage_role;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'post usage changed concurrently';
      END IF;
      v_post_usage_role_changed := TRUE;
      v_post_usage_role := 'cover'::showroom.content_asset_usage_role;
    END IF;
  END IF;

  -- Lock all current blocks after the post row. Editor saves update the post first,
  -- so this ordering serializes with both editor save and publish transitions.
  PERFORM 1
  FROM showroom.blog_blocks AS block
  WHERE block.post_id = p_post_id
  FOR UPDATE;

  IF p_insert_after_block_id IS NOT NULL THEN
    SELECT count(*), min(block.id::TEXT)::UUID
    INTO v_block_count, v_block_id
    FROM showroom.blog_blocks AS block
    WHERE block.post_id = p_post_id
      AND block.type = 'image'::showroom.blog_block_type
      AND block.media_id = v_media_id;
    IF v_block_count > 1 THEN
      RAISE EXCEPTION 'same media is attached to multiple image blocks';
    END IF;

    IF v_block_id IS NULL THEN
      SELECT block.display_order
      INTO v_anchor_order
      FROM showroom.blog_blocks AS block
      WHERE block.id = p_insert_after_block_id
        AND block.post_id = p_post_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insertion anchor does not belong to the post';
      END IF;
      v_insert_order := v_anchor_order + 1;

      FOR v_shift IN
        SELECT block.id, block.display_order
        FROM showroom.blog_blocks AS block
        WHERE block.post_id = p_post_id
          AND block.display_order >= v_insert_order
        ORDER BY block.display_order DESC
      LOOP
        UPDATE showroom.blog_blocks
        SET display_order = v_shift.display_order + 1
        WHERE id = v_shift.id
          AND post_id = p_post_id
          AND display_order = v_shift.display_order;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'block order changed concurrently';
        END IF;
        v_shifted_count := v_shifted_count + 1;
      END LOOP;

      INSERT INTO showroom.blog_blocks (
        post_id,
        display_order,
        type,
        heading_level,
        text,
        media_id,
        metadata
      ) VALUES (
        p_post_id,
        v_insert_order,
        'image'::showroom.blog_block_type,
        NULL,
        NULL,
        v_media_id,
        '{}'::JSONB
      )
      RETURNING id INTO v_block_id;
      v_inserted_block := TRUE;
    END IF;
  ELSIF p_existing_block_id IS NOT NULL THEN
    SELECT block.type, block.media_id
    INTO v_block_type, v_block_media_id
    FROM showroom.blog_blocks AS block
    WHERE block.id = p_existing_block_id
      AND block.post_id = p_post_id;
    IF NOT FOUND OR v_block_type IS DISTINCT FROM 'image'::showroom.blog_block_type THEN
      RAISE EXCEPTION 'existing block must be an image block in the selected post';
    END IF;
    IF v_block_media_id IS NOT NULL AND v_block_media_id IS DISTINCT FROM v_media_id THEN
      RAISE EXCEPTION 'existing image block points to different media';
    END IF;
    v_block_id := p_existing_block_id;
    IF v_block_media_id IS DISTINCT FROM v_media_id THEN
      UPDATE showroom.blog_blocks
      SET media_id = v_media_id
      WHERE id = v_block_id
        AND post_id = p_post_id
        AND media_id IS NOT DISTINCT FROM v_block_media_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'image block changed concurrently';
      END IF;
      v_block_media_changed := TRUE;
    END IF;
  END IF;

  IF v_block_id IS NOT NULL THEN
    SELECT count(*)
    INTO v_usage_count
    FROM showroom.content_asset_usages AS usage
    WHERE usage.asset_id = p_asset_id
      AND usage.usage_context = 'blog_block'::showroom.content_asset_usage_context
      AND usage.ref_table = 'showroom.blog_blocks'
      AND usage.ref_id = v_block_id;
    IF v_usage_count > 1 THEN
      RAISE EXCEPTION 'multiple usage rows point to the same image block';
    END IF;
    IF v_usage_count = 0 THEN
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
      ) VALUES (
        p_asset_id,
        'blog_block'::showroom.content_asset_usage_context,
        'showroom.blog_blocks',
        v_block_id,
        'body'::showroom.content_asset_usage_role,
        nullif(btrim(p_caption), ''),
        btrim(p_alt_text),
        jsonb_build_object(
          'post_id', p_post_id,
          'blog_media_id', v_media_id,
          'central_asset_id', v_central_asset_id
        ),
        p_actor_id
      );
      v_created_block_usage := TRUE;
    END IF;
  END IF;

  IF p_set_cover AND (v_cover_changed OR v_created_media OR v_created_post_usage OR v_post_usage_role_changed) THEN
    INSERT INTO showroom.content_asset_events (asset_id, event_type, actor_id, metadata)
    VALUES (
      p_asset_id,
      'attached_to_blog_cover',
      p_actor_id,
      jsonb_build_object(
        'post_id', p_post_id,
        'blog_media_id', v_media_id,
        'central_asset_id', v_central_asset_id
      )
    );
    v_event_count := v_event_count + 1;
  END IF;

  IF v_inserted_block THEN
    INSERT INTO showroom.content_asset_events (asset_id, event_type, actor_id, metadata)
    VALUES (
      p_asset_id,
      'inserted_into_blog_body',
      p_actor_id,
      jsonb_build_object(
        'post_id', p_post_id,
        'blog_media_id', v_media_id,
        'block_id', v_block_id,
        'anchor_block_id', p_insert_after_block_id,
        'shifted_block_count', v_shifted_count,
        'central_asset_id', v_central_asset_id
      )
    );
    v_event_count := v_event_count + 1;
  ELSIF v_block_id IS NOT NULL AND (v_block_media_changed OR v_created_block_usage) THEN
    INSERT INTO showroom.content_asset_events (asset_id, event_type, actor_id, metadata)
    VALUES (
      p_asset_id,
      'attached_to_blog_block',
      p_actor_id,
      jsonb_build_object(
        'post_id', p_post_id,
        'blog_media_id', v_media_id,
        'block_id', v_block_id,
        'central_asset_id', v_central_asset_id
      )
    );
    v_event_count := v_event_count + 1;
  END IF;

  IF v_event_count = 0 AND (v_created_media OR v_created_post_usage) THEN
    INSERT INTO showroom.content_asset_events (asset_id, event_type, actor_id, metadata)
    VALUES (
      p_asset_id,
      'attached_to_blog_post',
      p_actor_id,
      jsonb_build_object(
        'post_id', p_post_id,
        'blog_media_id', v_media_id,
        'central_asset_id', v_central_asset_id
      )
    );
    v_event_count := 1;
  END IF;

  UPDATE showroom.blog_posts
  SET updated_at = clock_timestamp()
  WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'mediaId', v_media_id,
    'blockId', v_block_id,
    'createdMedia', v_created_media,
    'cover', p_set_cover,
    'insertedBlock', v_inserted_block,
    'shiftedBlocks', v_shifted_count,
    'eventsCreated', v_event_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION showroom.delete_unreferenced_official_asset(
  p_asset_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_central_asset_id TEXT;
  v_storage_files JSONB := '[]'::JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'actor must be an administrator';
  END IF;

  SELECT asset.labels #>> '{centralBrand,assetId}'
  INTO v_central_asset_id
  FROM showroom.content_assets AS asset
  WHERE asset.id = p_asset_id
    AND asset.library_state = 'hidden'::showroom.content_asset_library_state
    AND NOT asset.promotion_consent_checked
    AND asset.labels #>> '{centralBrand,usageStatus}' = 'candidate'
  FOR UPDATE;
  IF NOT FOUND OR length(btrim(coalesce(v_central_asset_id, ''))) = 0 THEN
    RAISE EXCEPTION 'official central asset does not exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM showroom.blog_media AS media
    WHERE media.content_asset_id = p_asset_id
  ) OR EXISTS (
    SELECT 1 FROM showroom.content_asset_usages AS usage
    WHERE usage.asset_id = p_asset_id
  ) THEN
    RETURN jsonb_build_object('deleted', FALSE, 'storageFiles', '[]'::JSONB);
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('bucket', asset_file.bucket, 'objectPath', asset_file.object_path)
      ORDER BY asset_file.file_role
    ),
    '[]'::JSONB
  )
  INTO v_storage_files
  FROM showroom.content_asset_files AS asset_file
  WHERE asset_file.asset_id = p_asset_id;

  DELETE FROM showroom.content_assets AS asset
  WHERE asset.id = p_asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'official central asset changed concurrently';
  END IF;

  RETURN jsonb_build_object('deleted', TRUE, 'storageFiles', v_storage_files);
END;
$$;

REVOKE ALL ON FUNCTION showroom.attach_official_asset_to_reviewing_post(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION showroom.attach_official_asset_to_reviewing_post(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN
) TO service_role;

COMMENT ON FUNCTION showroom.attach_official_asset_to_reviewing_post(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN
) IS 'Service-role-only atomic placement of validated official central brand candidates into reviewing blog posts.';

REVOKE ALL ON FUNCTION showroom.acquire_blog_editor_save_lease(
  UUID, UUID, UUID, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.acquire_blog_editor_save_lease(
  UUID, UUID, UUID, TIMESTAMPTZ
) TO service_role;

REVOKE ALL ON FUNCTION showroom.release_blog_editor_save_lease(
  UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.release_blog_editor_save_lease(
  UUID, UUID, UUID
) TO service_role;

REVOKE ALL ON FUNCTION showroom.reconcile_blog_editor_save_lease(
  UUID, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.reconcile_blog_editor_save_lease(
  UUID, UUID, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION showroom.delete_unreferenced_official_asset(
  UUID, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION showroom.delete_unreferenced_official_asset(
  UUID, UUID
) TO service_role;
