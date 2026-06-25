-- PR-08: Content Asset Library DB/Storage foundation.
-- Scope: shared asset schema, buckets, RLS, storage policy draft pointer,
-- and a nullable bridge from existing blog_media. No UI, editor modal,
-- publish flow, or existing blog_media behavior changes.

CREATE SCHEMA IF NOT EXISTS showroom;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'content_asset_library_state'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.content_asset_library_state AS ENUM (
      'available',
      'hidden',
      'archived'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'content_asset_file_role'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.content_asset_file_role AS ENUM (
      'original',
      'web',
      'thumbnail'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'content_asset_transform_status'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.content_asset_transform_status AS ENUM (
      'pending',
      'ready',
      'failed'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'content_asset_usage_context'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.content_asset_usage_context AS ENUM (
      'blog_post',
      'blog_block',
      'showroom_page',
      'area_page',
      'service_page',
      'instagram',
      'reels',
      'proposal',
      'other'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'content_asset_usage_role'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.content_asset_usage_role AS ENUM (
      'cover',
      'body',
      'inline',
      'before',
      'after',
      'detail',
      'thumbnail',
      'other'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS showroom.content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  category TEXT,
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_type TEXT,
  space_type TEXT,
  region TEXT,
  usage_purpose TEXT,
  library_state showroom.content_asset_library_state NOT NULL DEFAULT 'available',
  privacy_checked BOOLEAN NOT NULL DEFAULT FALSE,
  promotion_consent_checked BOOLEAN NOT NULL DEFAULT FALSE,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_assets_labels_shape_check CHECK (
    jsonb_typeof(labels) IN ('object', 'array')
  ),
  CONSTRAINT content_assets_used_count_check CHECK (used_count >= 0)
);

CREATE TABLE IF NOT EXISTS showroom.content_asset_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES showroom.content_assets(id) ON DELETE CASCADE,
  file_role showroom.content_asset_file_role NOT NULL,
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL,
  public_url TEXT,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  checksum_sha256 TEXT,
  storage_etag TEXT,
  transform_status showroom.content_asset_transform_status NOT NULL DEFAULT 'pending',
  transform_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_asset_files_role_unique UNIQUE (asset_id, file_role),
  CONSTRAINT content_asset_files_object_unique UNIQUE (bucket, object_path),
  CONSTRAINT content_asset_files_size_check CHECK (size_bytes IS NULL OR size_bytes >= 0),
  CONSTRAINT content_asset_files_width_check CHECK (width IS NULL OR width > 0),
  CONSTRAINT content_asset_files_height_check CHECK (height IS NULL OR height > 0),
  CONSTRAINT content_asset_files_checksum_check CHECK (
    checksum_sha256 IS NULL
    OR checksum_sha256 ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT content_asset_files_original_private_check CHECK (
    file_role <> 'original'
    OR (
      bucket = 'content-assets-private'
      AND public_url IS NULL
    )
  ),
  CONSTRAINT content_asset_files_public_derivative_check CHECK (
    file_role = 'original'
    OR bucket = 'content-assets-public'
  )
);

CREATE TABLE IF NOT EXISTS showroom.content_asset_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  tag_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_asset_tags_slug_unique UNIQUE (slug),
  CONSTRAINT content_asset_tags_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT content_asset_tags_slug_format_check CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS showroom.content_asset_tag_links (
  asset_id UUID NOT NULL REFERENCES showroom.content_assets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES showroom.content_asset_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE IF NOT EXISTS showroom.content_asset_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES showroom.content_assets(id) ON DELETE CASCADE,
  usage_context showroom.content_asset_usage_context NOT NULL,
  ref_table TEXT NOT NULL,
  ref_id UUID NOT NULL,
  role showroom.content_asset_usage_role NOT NULL DEFAULT 'body',
  caption_override TEXT,
  alt_text_override TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_asset_usages_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT content_asset_usages_ref_table_check CHECK (
    ref_table ~ '^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$'
  )
);

CREATE TABLE IF NOT EXISTS showroom.content_asset_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES showroom.content_assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT content_asset_events_event_type_check CHECK (length(btrim(event_type)) > 0),
  CONSTRAINT content_asset_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE showroom.blog_media
  ADD COLUMN IF NOT EXISTS content_asset_id UUID REFERENCES showroom.content_assets(id) ON DELETE SET NULL;

COMMENT ON COLUMN showroom.blog_media.content_asset_id IS
  'Nullable bridge to the shared Content Asset Library. Existing Content OS publish flow still uses blog_media and is not replaced in PR-08.';

CREATE OR REPLACE TRIGGER set_timestamp_content_assets
BEFORE UPDATE ON showroom.content_assets
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE OR REPLACE FUNCTION showroom.refresh_content_asset_used_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = showroom, public
AS $$
DECLARE
  target_asset_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.asset_id IS DISTINCT FROM NEW.asset_id THEN
    UPDATE showroom.content_assets
    SET used_count = (
      SELECT COUNT(*)::integer
      FROM showroom.content_asset_usages u
      WHERE u.asset_id = OLD.asset_id
    )
    WHERE id = OLD.asset_id;
  END IF;

  target_asset_id := COALESCE(NEW.asset_id, OLD.asset_id);

  UPDATE showroom.content_assets
  SET used_count = (
    SELECT COUNT(*)::integer
    FROM showroom.content_asset_usages u
    WHERE u.asset_id = target_asset_id
  )
  WHERE id = target_asset_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_content_asset_used_count_insert ON showroom.content_asset_usages;
CREATE TRIGGER refresh_content_asset_used_count_insert
AFTER INSERT ON showroom.content_asset_usages
FOR EACH ROW
EXECUTE FUNCTION showroom.refresh_content_asset_used_count();

DROP TRIGGER IF EXISTS refresh_content_asset_used_count_delete ON showroom.content_asset_usages;
CREATE TRIGGER refresh_content_asset_used_count_delete
AFTER DELETE ON showroom.content_asset_usages
FOR EACH ROW
EXECUTE FUNCTION showroom.refresh_content_asset_used_count();

DROP TRIGGER IF EXISTS refresh_content_asset_used_count_update ON showroom.content_asset_usages;
CREATE TRIGGER refresh_content_asset_used_count_update
AFTER UPDATE OF asset_id ON showroom.content_asset_usages
FOR EACH ROW
EXECUTE FUNCTION showroom.refresh_content_asset_used_count();

CREATE INDEX IF NOT EXISTS content_assets_library_state_idx
  ON showroom.content_assets(library_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS content_assets_category_idx
  ON showroom.content_assets(category);

CREATE INDEX IF NOT EXISTS content_assets_product_space_region_idx
  ON showroom.content_assets(product_type, space_type, region);

CREATE INDEX IF NOT EXISTS content_assets_created_by_idx
  ON showroom.content_assets(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_assets_updated_by_idx
  ON showroom.content_assets(updated_by)
  WHERE updated_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_assets_labels_gin_idx
  ON showroom.content_assets USING GIN (labels);

CREATE INDEX IF NOT EXISTS content_asset_files_asset_role_idx
  ON showroom.content_asset_files(asset_id, file_role);

CREATE INDEX IF NOT EXISTS content_asset_files_checksum_idx
  ON showroom.content_asset_files(checksum_sha256)
  WHERE checksum_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_asset_files_transform_status_idx
  ON showroom.content_asset_files(transform_status);

CREATE INDEX IF NOT EXISTS content_asset_tags_group_idx
  ON showroom.content_asset_tags(tag_group, name);

CREATE INDEX IF NOT EXISTS content_asset_tag_links_tag_idx
  ON showroom.content_asset_tag_links(tag_id);

CREATE INDEX IF NOT EXISTS content_asset_usages_asset_idx
  ON showroom.content_asset_usages(asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_asset_usages_created_by_idx
  ON showroom.content_asset_usages(created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_asset_usages_ref_idx
  ON showroom.content_asset_usages(ref_table, ref_id);

CREATE INDEX IF NOT EXISTS content_asset_usages_context_role_idx
  ON showroom.content_asset_usages(usage_context, role);

CREATE INDEX IF NOT EXISTS content_asset_events_asset_created_idx
  ON showroom.content_asset_events(asset_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_asset_events_actor_idx
  ON showroom.content_asset_events(actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_media_content_asset_idx
  ON showroom.blog_media(content_asset_id)
  WHERE content_asset_id IS NOT NULL;

ALTER TABLE showroom.content_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.content_asset_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.content_asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.content_asset_tag_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.content_asset_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.content_asset_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON showroom.content_assets FROM anon, authenticated;
REVOKE ALL ON showroom.content_asset_files FROM anon, authenticated;
REVOKE ALL ON showroom.content_asset_tags FROM anon, authenticated;
REVOKE ALL ON showroom.content_asset_tag_links FROM anon, authenticated;
REVOKE ALL ON showroom.content_asset_usages FROM anon, authenticated;
REVOKE ALL ON showroom.content_asset_events FROM anon, authenticated;

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
    FROM showroom.content_asset_usages u
    WHERE u.asset_id = id
      AND (
        (
          u.usage_context = 'blog_post'
          AND u.ref_table = 'showroom.blog_posts'
          AND EXISTS (
            SELECT 1
            FROM showroom.blog_posts p
            WHERE p.id = u.ref_id
              AND p.status = 'published'
          )
        )
        OR (
          u.usage_context = 'blog_block'
          AND u.ref_table = 'showroom.blog_blocks'
          AND EXISTS (
            SELECT 1
            FROM showroom.blog_blocks b
            JOIN showroom.blog_posts p ON p.id = b.post_id
            WHERE b.id = u.ref_id
              AND p.status = 'published'
          )
        )
      )
  )
);

DROP POLICY IF EXISTS content_asset_files_public_select_ready_derivatives ON showroom.content_asset_files;
CREATE POLICY content_asset_files_public_select_ready_derivatives
ON showroom.content_asset_files
FOR SELECT
TO anon
USING (
  file_role IN ('web', 'thumbnail')
  AND transform_status = 'ready'
  AND public_url IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM showroom.content_assets a
    WHERE a.id = asset_id
      AND a.library_state = 'available'
      AND a.privacy_checked
      AND a.promotion_consent_checked
      AND EXISTS (
        SELECT 1
        FROM showroom.content_asset_usages u
        WHERE u.asset_id = a.id
          AND (
            (
              u.usage_context = 'blog_post'
              AND u.ref_table = 'showroom.blog_posts'
              AND EXISTS (
                SELECT 1
                FROM showroom.blog_posts p
                WHERE p.id = u.ref_id
                  AND p.status = 'published'
              )
            )
            OR (
              u.usage_context = 'blog_block'
              AND u.ref_table = 'showroom.blog_blocks'
              AND EXISTS (
                SELECT 1
                FROM showroom.blog_blocks b
                JOIN showroom.blog_posts p ON p.id = b.post_id
                WHERE b.id = u.ref_id
                  AND p.status = 'published'
              )
            )
          )
      )
  )
);

DROP POLICY IF EXISTS content_asset_usages_public_select_published_blog ON showroom.content_asset_usages;
CREATE POLICY content_asset_usages_public_select_published_blog
ON showroom.content_asset_usages
FOR SELECT
TO anon
USING (
  (
    usage_context = 'blog_post'
    AND ref_table = 'showroom.blog_posts'
    AND EXISTS (
      SELECT 1
      FROM showroom.blog_posts p
      WHERE p.id = ref_id
        AND p.status = 'published'
    )
  )
  OR (
    usage_context = 'blog_block'
    AND ref_table = 'showroom.blog_blocks'
    AND EXISTS (
      SELECT 1
      FROM showroom.blog_blocks b
      JOIN showroom.blog_posts p ON p.id = b.post_id
      WHERE b.id = ref_id
        AND p.status = 'published'
    )
  )
);

DROP POLICY IF EXISTS content_assets_admin_select ON showroom.content_assets;
CREATE POLICY content_assets_admin_select
ON showroom.content_assets
FOR SELECT
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_assets_admin_insert ON showroom.content_assets;
CREATE POLICY content_assets_admin_insert
ON showroom.content_assets
FOR INSERT
TO authenticated
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_assets_admin_update ON showroom.content_assets;
CREATE POLICY content_assets_admin_update
ON showroom.content_assets
FOR UPDATE
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_assets_admin_delete ON showroom.content_assets;
CREATE POLICY content_assets_admin_delete
ON showroom.content_assets
FOR DELETE
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_files_admin_select ON showroom.content_asset_files;
CREATE POLICY content_asset_files_admin_select
ON showroom.content_asset_files
FOR SELECT
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_files_admin_insert ON showroom.content_asset_files;
CREATE POLICY content_asset_files_admin_insert
ON showroom.content_asset_files
FOR INSERT
TO authenticated
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_files_admin_update ON showroom.content_asset_files;
CREATE POLICY content_asset_files_admin_update
ON showroom.content_asset_files
FOR UPDATE
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_files_admin_delete ON showroom.content_asset_files;
CREATE POLICY content_asset_files_admin_delete
ON showroom.content_asset_files
FOR DELETE
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_tags_admin_all ON showroom.content_asset_tags;
CREATE POLICY content_asset_tags_admin_all
ON showroom.content_asset_tags
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_tag_links_admin_all ON showroom.content_asset_tag_links;
CREATE POLICY content_asset_tag_links_admin_all
ON showroom.content_asset_tag_links
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_usages_admin_all ON showroom.content_asset_usages;
CREATE POLICY content_asset_usages_admin_all
ON showroom.content_asset_usages
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS content_asset_events_admin_all ON showroom.content_asset_events;
CREATE POLICY content_asset_events_admin_all
ON showroom.content_asset_events
FOR ALL
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

GRANT USAGE ON SCHEMA showroom TO anon;
GRANT USAGE ON SCHEMA showroom TO authenticated;

GRANT SELECT (
  id,
  title,
  description,
  category,
  product_type,
  space_type,
  region,
  usage_purpose,
  created_at,
  updated_at
) ON showroom.content_assets TO anon;

GRANT SELECT (
  id,
  asset_id,
  file_role,
  public_url,
  mime_type,
  width,
  height,
  size_bytes,
  created_at
) ON showroom.content_asset_files TO anon;

GRANT SELECT (
  id,
  asset_id,
  usage_context,
  ref_table,
  ref_id,
  role,
  created_at
) ON showroom.content_asset_usages TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_tag_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_usages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_events TO authenticated;

GRANT USAGE ON SCHEMA showroom TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_tags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_tag_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_usages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.content_asset_events TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'content-assets-private',
    'content-assets-private',
    FALSE,
    104857600,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::TEXT[]
  ),
  (
    'content-assets-public',
    'content-assets-public',
    TRUE,
    20971520,
    ARRAY['image/webp']::TEXT[]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON TABLE showroom.content_assets IS
  'Shared Munjanggun photo asset ledger. Operator UI must call this the photo library and must not expose storage/status internals.';

COMMENT ON TABLE showroom.content_asset_files IS
  'Actual storage files and derivatives for shared content assets: original, web, and thumbnail.';

COMMENT ON TABLE showroom.content_asset_usages IS
  'Records where a shared content asset is used. This is the bridge toward blog, showroom, area pages, social assets, and proposals.';

COMMENT ON COLUMN showroom.content_asset_files.bucket IS
  'Internal storage bucket name. Do not expose this column in operator UI.';

COMMENT ON COLUMN showroom.content_asset_files.object_path IS
  'Internal storage object path. Do not expose this column in operator UI.';

COMMENT ON POLICY content_assets_public_select_published_usage ON showroom.content_assets IS
  'anon can see only minimal metadata for assets that are privacy/promotion checked and used by published blog content.';

COMMENT ON POLICY content_asset_files_public_select_ready_derivatives ON showroom.content_asset_files IS
  'anon can see only ready web/thumbnail derivative metadata for assets used by published blog content. Original private files are never exposed.';

COMMENT ON POLICY content_asset_usages_public_select_published_blog ON showroom.content_asset_usages IS
  'anon can see only minimal usage rows that connect assets to published blog content so public derivative RLS can resolve safely.';

-- Storage object policy draft lives in:
-- supabase/storage-policies/content_asset_library_storage_policies.sql
--
-- Keep storage.objects policy separate so it can be applied with a DB owner
-- or Supabase MCP/CLI context. Do not add UPDATE policies; public overwrite
-- and upsert are intentionally unsupported.

NOTIFY pgrst, 'reload schema';
