-- Recovery baseline for showroom objects that existed in Production before the
-- repository began tracking its migrations. Keep this migration before the
-- first dependent migration (20260720074812) and safe for already-provisioned
-- Production databases.
--
-- Column names and nullability come from src/types/database.ts. Constraints,
-- defaults, and indexes below are limited to the published showroom PRD, app
-- behavior, and recoverable Git history. Unknown Production-only details are
-- recorded in docs/platform/MIGRATION_CHAIN_VALIDATION.md rather than guessed.

CREATE SCHEMA IF NOT EXISTS showroom;

CREATE TABLE IF NOT EXISTS showroom.site_settings (
  id TEXT PRIMARY KEY,
  site_title TEXT NOT NULL,
  site_description TEXT,
  og_image_url TEXT,
  reservation_url TEXT,
  store_url TEXT,
  hero_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  hero_video_url TEXT,
  hero_mobile_video_url TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_description TEXT,
  hero_slide_interval INTEGER NOT NULL DEFAULT 5,
  hero_slide_transition TEXT,
  card_text_position TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton_check CHECK (id = 'singleton')
);

CREATE TABLE IF NOT EXISTS showroom.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES showroom.nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('listing', 'detail')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  display_order INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  card_subtitle TEXT,
  hero_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  hero_video_url TEXT,
  hero_mobile_video_url TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_description TEXT,
  hero_slide_interval INTEGER NOT NULL DEFAULT 5,
  hero_slide_transition TEXT,
  tagline TEXT,
  description TEXT,
  card_text_position TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS showroom.hero_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES showroom.nodes(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  device_type TEXT NOT NULL DEFAULT 'desktop',
  media_type TEXT NOT NULL DEFAULT 'image',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS showroom.site_hero_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  device_type TEXT NOT NULL DEFAULT 'desktop',
  media_type TEXT NOT NULL DEFAULT 'image',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS showroom.gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES showroom.nodes(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS showroom.preview_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES showroom.nodes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE showroom.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.hero_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.site_hero_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.preview_tokens ENABLE ROW LEVEL SECURITY;

-- Recover the only source-controlled legacy indexes. The partial uniqueness
-- indexes are the published showroom navigation constraint.
CREATE UNIQUE INDEX IF NOT EXISTS showroom_nodes_root_slug_key
  ON showroom.nodes (slug)
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS showroom_nodes_sibling_slug_key
  ON showroom.nodes (parent_id, slug)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_showroom_gallery_photos_node_id
  ON showroom.gallery_photos (node_id);

CREATE INDEX IF NOT EXISTS idx_showroom_hero_media_node_id
  ON showroom.hero_media (node_id);

CREATE INDEX IF NOT EXISTS idx_showroom_preview_tokens_node_id
  ON showroom.preview_tokens (node_id);

CREATE INDEX IF NOT EXISTS idx_showroom_nodes_parent_slug_status
  ON showroom.nodes (parent_id, slug, status);

CREATE INDEX IF NOT EXISTS idx_showroom_nodes_parent_status_order
  ON showroom.nodes (parent_id, status, display_order);

CREATE INDEX IF NOT EXISTS idx_showroom_site_hero_media_display_order
  ON showroom.site_hero_media (display_order);

-- This exact helper previously existed in a missing 202605200003 migration.
-- It must be present before later policies reference it.
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_node_visible(target_node_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  all_published BOOLEAN;
BEGIN
  WITH RECURSIVE ancestor_chain AS (
    SELECT id, parent_id, status
    FROM showroom.nodes
    WHERE id = target_node_id

    UNION ALL

    SELECT node.id, node.parent_id, node.status
    FROM showroom.nodes AS node
    INNER JOIN ancestor_chain AS ancestor ON node.id = ancestor.parent_id
  )
  SELECT bool_and(status = 'published')
  INTO all_published
  FROM ancestor_chain;

  RETURN coalesce(all_published, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION private.is_node_visible(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_node_visible(UUID) TO anon, authenticated;

-- These anonymous policies are recoverable from the missing historic
-- 202605200003 migration. Subsequent migrations intentionally replace or add
-- authenticated policies without replacing these public visibility rules.
DROP POLICY IF EXISTS anon_read_visible_nodes ON showroom.nodes;
CREATE POLICY anon_read_visible_nodes
ON showroom.nodes
FOR SELECT
TO anon
USING (status = 'published' AND private.is_node_visible(id));

DROP POLICY IF EXISTS anon_read_hero_media ON showroom.hero_media;
CREATE POLICY anon_read_hero_media
ON showroom.hero_media
FOR SELECT
TO anon
USING (private.is_node_visible(node_id));

DROP POLICY IF EXISTS anon_read_gallery_photos ON showroom.gallery_photos;
CREATE POLICY anon_read_gallery_photos
ON showroom.gallery_photos
FOR SELECT
TO anon
USING (private.is_node_visible(node_id));
