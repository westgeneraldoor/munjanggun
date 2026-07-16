-- Allow validated animated GIF originals in the private ingestion buckets and
-- in the public blog delivery bucket. Static content-asset derivatives remain
-- WebP-only in the public derivative bucket.

DO $$
DECLARE
  touched_buckets INTEGER;
BEGIN
  UPDATE storage.buckets
  SET allowed_mime_types = CASE
    WHEN allowed_mime_types IS NULL THEN NULL
    WHEN 'image/gif' = ANY (allowed_mime_types) THEN allowed_mime_types
    ELSE array_append(allowed_mime_types, 'image/gif')
  END
  WHERE id IN ('content-assets-private', 'blog-media-private', 'blog-media');

  GET DIAGNOSTICS touched_buckets = ROW_COUNT;
  IF touched_buckets <> 3 THEN
    RAISE EXCEPTION 'Expected three media buckets, updated %', touched_buckets;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS content_assets_central_brand_asset_id_unique
  ON showroom.content_assets ((labels #>> '{centralBrand,assetId}'))
  WHERE NULLIF(labels #>> '{centralBrand,assetId}', '') IS NOT NULL;

COMMENT ON TABLE showroom.content_asset_files IS
  'Actual storage files and static derivatives for shared content assets. Animated GIF originals stay private here; public blog promotion preserves the GIF in blog-media while web and thumbnail roles remain static WebP.';
