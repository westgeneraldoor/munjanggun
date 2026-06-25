-- MVP-CONTENTOS-01 / PR-01 storage.objects policy draft.
--
-- Apply this with a DB owner/Supabase CLI context. Some managed migration
-- runners cannot alter storage.objects because it is owned by Supabase
-- Storage internals.
--
-- Upsert/file replacement is intentionally unsupported:
-- - No UPDATE policy is defined for blog-media.
-- - Upload code must use new object paths instead of upsert.

DROP POLICY IF EXISTS blog_media_public_select ON storage.objects;
CREATE POLICY blog_media_public_select
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'blog-media');

DROP POLICY IF EXISTS blog_media_admin_insert_public ON storage.objects;
CREATE POLICY blog_media_admin_insert_public
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-media'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS blog_media_admin_delete_public ON storage.objects;
CREATE POLICY blog_media_admin_delete_public
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'blog-media'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS blog_media_private_admin_select ON storage.objects;
CREATE POLICY blog_media_private_admin_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'blog-media-private'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS blog_media_private_admin_insert ON storage.objects;
CREATE POLICY blog_media_private_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-media-private'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS blog_media_private_admin_delete ON storage.objects;
CREATE POLICY blog_media_private_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'blog-media-private'
  AND (SELECT platform_private.is_admin())
);
