-- PostgreSQL has no min(uuid) aggregate. Replace the detach RPC with an
-- equivalent implementation that counts first, then selects the sole UUID.

CREATE OR REPLACE FUNCTION showroom.detach_unused_official_asset_from_reviewing_post(
  p_post_id UUID,
  p_asset_id UUID,
  p_actor_id UUID,
  p_central_asset_id TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_media_id UUID;
  v_media_count INTEGER;
  v_usage_count INTEGER;
BEGIN
  IF p_post_id IS NULL OR p_asset_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'post, asset, and actor are required';
  END IF;
  IF length(btrim(coalesce(p_central_asset_id, ''))) = 0 THEN
    RAISE EXCEPTION 'central asset id is required';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 10 OR length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'detach reason must be between 10 and 500 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'administrator audit actor is required';
  END IF;

  PERFORM 1
  FROM showroom.blog_posts AS post
  WHERE post.id = p_post_id
    AND post.status = 'reviewing'::showroom.blog_post_status
    AND post.published_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'post must remain unpublished and reviewing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM showroom.content_assets AS asset
    WHERE asset.id = p_asset_id
      AND asset.labels #>> '{centralBrand,assetId}' = p_central_asset_id
      AND asset.privacy_checked = TRUE
      AND asset.promotion_consent_checked = FALSE
  ) THEN
    RAISE EXCEPTION 'private official asset boundary does not match';
  END IF;

  PERFORM 1
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
    AND media.content_asset_id = p_asset_id
    AND media.usage_status <> 'rejected'::showroom.blog_media_usage_status
  FOR UPDATE;

  SELECT count(*)
  INTO v_media_count
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
    AND media.content_asset_id = p_asset_id
    AND media.usage_status <> 'rejected'::showroom.blog_media_usage_status;

  IF v_media_count <> 1 THEN
    RAISE EXCEPTION 'exactly one active post media bridge is required';
  END IF;

  SELECT media.id
  INTO STRICT v_media_id
  FROM showroom.blog_media AS media
  WHERE media.post_id = p_post_id
    AND media.content_asset_id = p_asset_id
    AND media.usage_status <> 'rejected'::showroom.blog_media_usage_status;

  IF EXISTS (
    SELECT 1
    FROM showroom.blog_media AS media
    WHERE media.id = v_media_id
      AND (
        media.used_as_cover = TRUE
        OR media.public_bucket IS NOT NULL
        OR media.public_object_path IS NOT NULL
        OR media.public_url IS NOT NULL
        OR media.published_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'cover or public media cannot be detached';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM showroom.blog_blocks AS block
    WHERE block.post_id = p_post_id
      AND block.media_id = v_media_id
  ) THEN
    RAISE EXCEPTION 'body-linked media cannot be detached';
  END IF;

  DELETE FROM showroom.content_asset_usages AS usage
  WHERE usage.asset_id = p_asset_id
    AND usage.usage_context = 'blog_post'::showroom.content_asset_usage_context
    AND usage.ref_table = 'showroom.blog_posts'
    AND usage.ref_id = p_post_id;
  GET DIAGNOSTICS v_usage_count = ROW_COUNT;
  IF v_usage_count <> 1 THEN
    RAISE EXCEPTION 'exactly one post usage record is required';
  END IF;

  UPDATE showroom.blog_media AS media
  SET post_id = NULL,
      usage_status = 'rejected'::showroom.blog_media_usage_status,
      rejection_reason = btrim(p_reason),
      updated_at = NOW()
  WHERE media.id = v_media_id
    AND media.post_id = p_post_id
    AND media.content_asset_id = p_asset_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'media bridge changed concurrently';
  END IF;

  INSERT INTO showroom.content_asset_events (
    asset_id,
    event_type,
    actor_id,
    metadata
  ) VALUES (
    p_asset_id,
    'official_asset_detached_from_reviewing_post',
    p_actor_id,
    jsonb_build_object(
      'post_id', p_post_id,
      'media_id', v_media_id,
      'central_asset_id', p_central_asset_id,
      'reason', btrim(p_reason),
      'asset_record_preserved', TRUE,
      'storage_files_preserved', TRUE
    )
  );

  INSERT INTO showroom.blog_post_events (
    post_id,
    actor_id,
    event_type,
    memo,
    metadata
  ) VALUES (
    p_post_id,
    p_actor_id,
    'official_asset_detached',
    btrim(p_reason),
    jsonb_build_object(
      'asset_id', p_asset_id,
      'media_id', v_media_id,
      'central_asset_id', p_central_asset_id
    )
  );

  RETURN jsonb_build_object(
    'postId', p_post_id,
    'assetId', p_asset_id,
    'mediaId', v_media_id,
    'detached', TRUE,
    'assetRecordPreserved', TRUE,
    'storageFilesPreserved', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION showroom.detach_unused_official_asset_from_reviewing_post(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.detach_unused_official_asset_from_reviewing_post(UUID, UUID, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION showroom.detach_unused_official_asset_from_reviewing_post(UUID, UUID, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION showroom.detach_unused_official_asset_from_reviewing_post(UUID, UUID, UUID, TEXT, TEXT) TO service_role;
