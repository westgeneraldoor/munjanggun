ALTER TABLE platform.measurement_product_categories
  ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'platform-category-images',
  'platform-category-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS platform_category_images_admin_insert ON storage.objects;
CREATE POLICY platform_category_images_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'platform-category-images'
  AND platform_private.is_admin()
);

DROP POLICY IF EXISTS platform_category_images_admin_update ON storage.objects;
CREATE POLICY platform_category_images_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'platform-category-images'
  AND platform_private.is_admin()
)
WITH CHECK (
  bucket_id = 'platform-category-images'
  AND platform_private.is_admin()
);

DROP POLICY IF EXISTS platform_category_images_admin_delete ON storage.objects;
CREATE POLICY platform_category_images_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'platform-category-images'
  AND platform_private.is_admin()
);

GRANT SELECT, INSERT, UPDATE (label, description, image_url, sort_order, is_active, updated_at)
ON platform.measurement_product_categories
TO authenticated;
