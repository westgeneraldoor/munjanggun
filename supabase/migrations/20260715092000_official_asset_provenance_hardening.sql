-- Central provenance is a server-side safety boundary. Preserve it across
-- ordinary metadata edits and serialize both central IDs and original hashes.

CREATE UNIQUE INDEX IF NOT EXISTS content_assets_central_brand_sha256_unique
  ON showroom.content_assets ((labels #>> '{centralBrand,sha256}'))
  WHERE NULLIF(labels #>> '{centralBrand,sha256}', '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS blog_media_active_content_asset_unique
  ON showroom.blog_media (post_id, content_asset_id)
  WHERE content_asset_id IS NOT NULL AND usage_status <> 'rejected';

CREATE UNIQUE INDEX IF NOT EXISTS content_asset_blog_post_usage_unique
  ON showroom.content_asset_usages (asset_id, ref_id)
  WHERE usage_context = 'blog_post' AND ref_table = 'showroom.blog_posts';

CREATE UNIQUE INDEX IF NOT EXISTS content_asset_blog_block_ref_unique
  ON showroom.content_asset_usages (ref_id)
  WHERE usage_context = 'blog_block' AND ref_table = 'showroom.blog_blocks';

CREATE OR REPLACE FUNCTION showroom.protect_central_brand_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.labels -> 'centralBrand' IS NOT NULL
     AND NEW.labels -> 'centralBrand' IS DISTINCT FROM OLD.labels -> 'centralBrand'
  THEN
    RAISE EXCEPTION 'central brand provenance is immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_central_brand_provenance_on_assets
  ON showroom.content_assets;

CREATE TRIGGER protect_central_brand_provenance_on_assets
  BEFORE UPDATE OF labels ON showroom.content_assets
  FOR EACH ROW
  EXECUTE FUNCTION showroom.protect_central_brand_provenance();

REVOKE ALL ON FUNCTION showroom.protect_central_brand_provenance() FROM PUBLIC;
