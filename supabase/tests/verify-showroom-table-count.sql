-- The recovery contract is the 18 showroom tables exported in
-- src/types/database.ts. It deliberately does not reject tracked internal
-- tables such as showroom.blog_editor_save_leases.
DO $verification$
DECLARE
  expected_table TEXT;
BEGIN
  FOREACH expected_table IN ARRAY ARRAY[
    'site_settings',
    'nodes',
    'hero_media',
    'site_hero_media',
    'gallery_photos',
    'image_sources',
    'image_derivatives',
    'preview_tokens',
    'content_assets',
    'content_asset_files',
    'content_asset_tags',
    'content_asset_tag_links',
    'content_asset_usages',
    'content_asset_events',
    'blog_posts',
    'blog_media',
    'blog_blocks',
    'blog_post_events'
  ] LOOP
    IF to_regclass(format('showroom.%I', expected_table)) IS NULL THEN
      RAISE EXCEPTION 'missing showroom table: %', expected_table;
    END IF;
  END LOOP;

END;
$verification$;
