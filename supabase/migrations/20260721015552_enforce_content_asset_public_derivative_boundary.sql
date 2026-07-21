-- Keep all anonymous Content Asset Library surfaces on the same exact
-- asset/usage/media publication contract. This also avoids evaluating nested
-- table lookups with the caller's intentionally narrow column grants.
CREATE OR REPLACE FUNCTION private.is_public_content_asset(
  p_asset_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM showroom.content_assets AS asset
    WHERE asset.id = p_asset_id
      AND asset.library_state = 'available'::showroom.content_asset_library_state
      AND asset.privacy_checked
      AND asset.promotion_consent_checked
      AND EXISTS (
        SELECT 1
        FROM showroom.content_asset_usages AS usage
        WHERE usage.asset_id = asset.id
          AND private.is_published_content_asset_usage(asset.id, usage.id)
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_public_content_asset(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_public_content_asset(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION private.is_public_content_asset(UUID) FROM service_role;
GRANT EXECUTE ON FUNCTION private.is_public_content_asset(UUID) TO anon;

DROP POLICY IF EXISTS content_assets_public_select_published_usage
ON showroom.content_assets;
CREATE POLICY content_assets_public_select_published_usage
ON showroom.content_assets
FOR SELECT
TO anon
USING (private.is_public_content_asset(id));

DROP POLICY IF EXISTS content_asset_files_public_select_ready_derivatives
ON showroom.content_asset_files;
CREATE POLICY content_asset_files_public_select_ready_derivatives
ON showroom.content_asset_files
FOR SELECT
TO anon
USING (
  file_role IN ('web', 'thumbnail')
  AND transform_status = 'ready'
  AND public_url IS NOT NULL
  AND private.is_public_content_asset(asset_id)
);

DROP POLICY IF EXISTS content_asset_usages_public_select_published_blog
ON showroom.content_asset_usages;
CREATE POLICY content_asset_usages_public_select_published_blog
ON showroom.content_asset_usages
FOR SELECT
TO anon
USING (private.is_published_content_asset_usage(asset_id, id));

COMMENT ON FUNCTION private.is_public_content_asset(UUID) IS
  'Returns true only for an available privacy/consent-complete asset with an exact published media usage.';

COMMENT ON POLICY content_asset_files_public_select_ready_derivatives
ON showroom.content_asset_files IS
  'anon can read ready public derivatives only when the owning exact asset satisfies the published media contract.';
