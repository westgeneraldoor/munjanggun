-- PR-08 Content Asset Library storage.objects policies.
--
-- Apply with a DB owner/Supabase MCP/CLI context. Do not edit storage.objects
-- rows directly; object creation/deletion must go through the Storage API.
--
-- Upsert/file replacement is intentionally unsupported:
-- - No UPDATE policy is defined for content-assets-public.
-- - Upload code must use new object paths and upsert: false.

DROP POLICY IF EXISTS content_assets_public_select ON storage.objects;
CREATE POLICY content_assets_public_select
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'content-assets-public');

DROP POLICY IF EXISTS content_assets_public_admin_insert ON storage.objects;
CREATE POLICY content_assets_public_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content-assets-public'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS content_assets_public_admin_delete ON storage.objects;
CREATE POLICY content_assets_public_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'content-assets-public'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS content_assets_private_admin_select ON storage.objects;
CREATE POLICY content_assets_private_admin_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'content-assets-private'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS content_assets_private_admin_insert ON storage.objects;
CREATE POLICY content_assets_private_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content-assets-private'
  AND (SELECT platform_private.is_admin())
);

DROP POLICY IF EXISTS content_assets_private_admin_delete ON storage.objects;
CREATE POLICY content_assets_private_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'content-assets-private'
  AND (SELECT platform_private.is_admin())
);
