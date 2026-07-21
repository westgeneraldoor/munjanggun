-- Make the public-object cleanup intent durable in the same transaction that
-- switches central-brand derivative metadata to private Storage.

DROP FUNCTION IF EXISTS showroom.privatize_central_asset_derivatives(UUID, UUID, TEXT, JSONB);

CREATE FUNCTION showroom.privatize_central_asset_derivatives(
  p_asset_id UUID,
  p_actor_id UUID,
  p_central_asset_id TEXT,
  p_files JSONB,
  p_cleanup_event_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, showroom, platform
AS $$
DECLARE
  file_record RECORD;
  updated_count INTEGER;
  total_updated INTEGER := 0;
  web_seen BOOLEAN := FALSE;
  thumbnail_seen BOOLEAN := FALSE;
  v_public_paths JSONB := '[]'::JSONB;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service role is required';
  END IF;

  IF p_cleanup_event_id IS NULL THEN
    RAISE EXCEPTION 'cleanup event id is required';
  END IF;

  IF jsonb_typeof(p_files) <> 'array' OR jsonb_array_length(p_files) <> 2 THEN
    RAISE EXCEPTION 'exactly two derivative files are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM showroom.content_assets AS asset
    WHERE asset.id = p_asset_id
      AND asset.labels -> 'centralBrand' ->> 'assetId' = p_central_asset_id
      AND asset.privacy_checked = TRUE
      AND asset.promotion_consent_checked = FALSE
  ) THEN
    RAISE EXCEPTION 'central candidate asset boundary does not match';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM platform.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'administrator'::platform.profile_role
  ) THEN
    RAISE EXCEPTION 'administrator audit actor is required';
  END IF;

  FOR file_record IN
    SELECT *
    FROM jsonb_to_recordset(p_files) AS file_data(
      id UUID,
      file_role TEXT,
      old_object_path TEXT,
      new_object_path TEXT
    )
  LOOP
    IF file_record.file_role NOT IN ('web', 'thumbnail') THEN
      RAISE EXCEPTION 'unsupported derivative role';
    END IF;
    IF file_record.file_role = 'web' THEN
      IF web_seen THEN RAISE EXCEPTION 'duplicate web role'; END IF;
      web_seen := TRUE;
    ELSE
      IF thumbnail_seen THEN RAISE EXCEPTION 'duplicate thumbnail role'; END IF;
      thumbnail_seen := TRUE;
    END IF;
    IF file_record.new_object_path NOT LIKE
      p_asset_id::TEXT || '/' || file_record.file_role || '/%.webp'
    THEN
      RAISE EXCEPTION 'private derivative path is invalid';
    END IF;

    UPDATE showroom.content_asset_files AS asset_file
    SET bucket = 'content-assets-private',
        object_path = file_record.new_object_path,
        public_url = NULL
    WHERE asset_file.id = file_record.id
      AND asset_file.asset_id = p_asset_id
      AND asset_file.file_role::TEXT = file_record.file_role
      AND asset_file.bucket = 'content-assets-public'
      AND asset_file.object_path = file_record.old_object_path
      AND asset_file.public_url IS NOT NULL;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> 1 THEN
      RAISE EXCEPTION 'derivative metadata changed concurrently';
    END IF;
    total_updated := total_updated + updated_count;
    v_public_paths := v_public_paths || jsonb_build_array(file_record.old_object_path);
  END LOOP;

  IF NOT web_seen OR NOT thumbnail_seen OR total_updated <> 2 THEN
    RAISE EXCEPTION 'both derivative roles must be privatized';
  END IF;

  INSERT INTO showroom.content_asset_events (
    asset_id,
    event_type,
    actor_id,
    metadata
  ) VALUES (
    p_asset_id,
    'central_brand_derivatives_privatized',
    p_actor_id,
    jsonb_build_object(
      'central_asset_id', p_central_asset_id,
      'roles', jsonb_build_array('web', 'thumbnail'),
      'reason', 'candidate_media_must_not_use_public_storage'
    )
  );

  INSERT INTO showroom.content_asset_events (
    id,
    asset_id,
    event_type,
    actor_id,
    metadata
  ) VALUES (
    p_cleanup_event_id,
    p_asset_id,
    'central_brand_public_cleanup_pending',
    p_actor_id,
    jsonb_build_object(
      'central_asset_id', p_central_asset_id,
      'public_bucket', 'content-assets-public',
      'public_paths', v_public_paths,
      'failure', NULL
    )
  );

  RETURN total_updated;
END;
$$;

COMMENT ON FUNCTION showroom.privatize_central_asset_derivatives(UUID, UUID, TEXT, JSONB, UUID)
IS 'Atomically privatizes both central-brand derivatives and records the durable public-object cleanup intent.';

REVOKE ALL ON FUNCTION showroom.privatize_central_asset_derivatives(UUID, UUID, TEXT, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.privatize_central_asset_derivatives(UUID, UUID, TEXT, JSONB, UUID) FROM anon;
REVOKE ALL ON FUNCTION showroom.privatize_central_asset_derivatives(UUID, UUID, TEXT, JSONB, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION showroom.privatize_central_asset_derivatives(UUID, UUID, TEXT, JSONB, UUID) TO service_role;
