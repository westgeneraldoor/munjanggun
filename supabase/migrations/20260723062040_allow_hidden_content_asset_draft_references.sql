-- Production ledger version: 20260723062040.
-- Hidden assets are intentional private draft candidates imported from the
-- central brand repository. They must remain attachable to draft media and
-- usage ledgers, while archived assets stay blocked at the database boundary.
CREATE OR REPLACE FUNCTION showroom.reject_archived_content_asset_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.content_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM showroom.content_assets AS asset
  WHERE asset.id = NEW.content_asset_id
    AND asset.library_state IN (
      'available'::showroom.content_asset_library_state,
      'hidden'::showroom.content_asset_library_state
    )
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'archived content assets cannot be referenced'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION showroom.reject_archived_content_asset_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM 1
  FROM showroom.content_assets AS asset
  WHERE asset.id = NEW.asset_id
    AND asset.library_state IN (
      'available'::showroom.content_asset_library_state,
      'hidden'::showroom.content_asset_library_state
    )
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'archived content assets cannot be referenced'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION showroom.reject_archived_content_asset_reference()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION showroom.reject_archived_content_asset_usage()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION showroom.reject_archived_content_asset_reference() IS
  'Allows available and private hidden draft assets; rejects archived assets before blog_media writes.';
COMMENT ON FUNCTION showroom.reject_archived_content_asset_usage() IS
  'Allows available and private hidden draft assets; rejects archived assets before usage-ledger writes.';
