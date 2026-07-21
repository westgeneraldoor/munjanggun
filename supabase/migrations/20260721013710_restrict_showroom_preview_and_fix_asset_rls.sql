-- Preview tokens are bearer capabilities. Preserve the narrow anonymous exchange
-- RPC, but require an administrator profile for direct table management.
DROP POLICY IF EXISTS auth_all_preview_tokens ON showroom.preview_tokens;
DROP POLICY IF EXISTS administrator_manage_preview_tokens ON showroom.preview_tokens;

REVOKE ALL ON showroom.preview_tokens FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.preview_tokens TO authenticated;

CREATE POLICY administrator_manage_preview_tokens
ON showroom.preview_tokens
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

-- Authenticated customer and sales-manager sessions receive the same public
-- showroom rows as anon. The existing administrator FOR ALL policies remain
-- additive, so administrators can still read and edit draft rows.
REVOKE ALL ON showroom.nodes FROM anon, authenticated;
REVOKE ALL ON showroom.hero_media FROM anon, authenticated;
REVOKE ALL ON showroom.gallery_photos FROM anon, authenticated;

GRANT SELECT ON showroom.nodes, showroom.hero_media, showroom.gallery_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE
ON showroom.nodes, showroom.hero_media, showroom.gallery_photos
TO authenticated;

DROP POLICY IF EXISTS authenticated_read_nodes ON showroom.nodes;
DROP POLICY IF EXISTS authenticated_read_visible_nodes ON showroom.nodes;
CREATE POLICY authenticated_read_visible_nodes
ON showroom.nodes
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND private.is_node_visible(id)
);

DROP POLICY IF EXISTS authenticated_read_hero_media ON showroom.hero_media;
DROP POLICY IF EXISTS authenticated_read_visible_hero_media ON showroom.hero_media;
CREATE POLICY authenticated_read_visible_hero_media
ON showroom.hero_media
FOR SELECT
TO authenticated
USING (private.is_node_visible(node_id));

DROP POLICY IF EXISTS authenticated_read_gallery_photos ON showroom.gallery_photos;
DROP POLICY IF EXISTS authenticated_read_visible_gallery_photos ON showroom.gallery_photos;
CREATE POLICY authenticated_read_visible_gallery_photos
ON showroom.gallery_photos
FOR SELECT
TO authenticated
USING (private.is_node_visible(node_id));

-- Evaluate the published usage/media relationship with definer privileges so
-- public callers do not need SELECT grants on private blog_media linkage
-- columns. The helper schema is not exposed by PostgREST.
CREATE OR REPLACE FUNCTION private.is_published_content_asset_usage(
  p_asset_id UUID,
  p_usage_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM showroom.content_asset_usages AS asset_usage
    WHERE asset_usage.id = p_usage_id
      AND asset_usage.asset_id = p_asset_id
      AND (
        (
          asset_usage.usage_context = 'blog_post'::showroom.content_asset_usage_context
          AND asset_usage.ref_table = 'showroom.blog_posts'
          AND EXISTS (
            SELECT 1
            FROM showroom.blog_posts AS blog_post
            JOIN showroom.blog_media AS asset_media
              ON asset_media.post_id = blog_post.id
             AND asset_media.content_asset_id = p_asset_id
            WHERE blog_post.id = asset_usage.ref_id
              AND blog_post.status = 'published'::showroom.blog_post_status
              AND asset_media.usage_status = 'published'::showroom.blog_media_usage_status
              AND asset_media.privacy_checked
              AND asset_media.promotion_consent_checked
              AND asset_media.public_url IS NOT NULL
          )
        )
        OR (
          asset_usage.usage_context = 'blog_block'::showroom.content_asset_usage_context
          AND asset_usage.ref_table = 'showroom.blog_blocks'
          AND EXISTS (
            SELECT 1
            FROM showroom.blog_blocks AS blog_block
            JOIN showroom.blog_posts AS blog_post
              ON blog_post.id = blog_block.post_id
            JOIN showroom.blog_media AS block_media
              ON block_media.id = blog_block.media_id
             AND block_media.content_asset_id = p_asset_id
            WHERE blog_block.id = asset_usage.ref_id
              AND blog_post.status = 'published'::showroom.blog_post_status
              AND block_media.usage_status = 'published'::showroom.blog_media_usage_status
              AND block_media.privacy_checked
              AND block_media.promotion_consent_checked
              AND block_media.public_url IS NOT NULL
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_published_content_asset_usage(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_published_content_asset_usage(UUID, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION private.is_published_content_asset_usage(UUID, UUID) FROM service_role;
GRANT EXECUTE ON FUNCTION private.is_published_content_asset_usage(UUID, UUID) TO anon;

DROP POLICY IF EXISTS content_assets_public_select_published_usage ON showroom.content_assets;
CREATE POLICY content_assets_public_select_published_usage
ON showroom.content_assets
FOR SELECT
TO anon
USING (
  library_state = 'available'
  AND privacy_checked
  AND promotion_consent_checked
  AND EXISTS (
    SELECT 1
    FROM showroom.content_asset_usages AS u
    WHERE u.asset_id = showroom.content_assets.id
      AND private.is_published_content_asset_usage(showroom.content_assets.id, u.id)
  )
);

COMMENT ON POLICY content_assets_public_select_published_usage ON showroom.content_assets IS
  'anon can read allowlisted asset metadata only when this exact asset has a privacy/consent-complete published media usage.';

-- Preserve the anonymous bearer-token exchange as the sole non-admin preview
-- entry point. Its UUID, expiry and field allowlist stay in the prior function.
REVOKE ALL ON FUNCTION showroom.get_preview_payload(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION showroom.get_preview_payload(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION showroom.get_preview_payload(TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION showroom.get_preview_payload(TEXT) TO anon;
