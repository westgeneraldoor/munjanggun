-- MVP-CONTENTOS-01 / PR-01: Content OS DB, RLS, and Storage foundation.
-- Scope: schema only. No admin UI, public blog routes, metadata, or publishing UI.

CREATE SCHEMA IF NOT EXISTS showroom;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'blog_post_status'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.blog_post_status AS ENUM (
      'ai_draft',
      'reviewing',
      'needs_media',
      'ready',
      'published',
      'archived'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'blog_content_category'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.blog_content_category AS ENUM (
      'case_study',
      'product_guide',
      'customer_qa',
      'field_knowhow',
      'price_guide',
      'area_guide'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'blog_block_type'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.blog_block_type AS ENUM (
      'heading',
      'paragraph',
      'image',
      'cta',
      'qa'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'blog_media_usage_status'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.blog_media_usage_status AS ENUM (
      'candidate',
      'approved',
      'published',
      'rejected'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'blog_media_source_type'
      AND typnamespace = 'showroom'::regnamespace
  ) THEN
    CREATE TYPE showroom.blog_media_source_type AS ENUM (
      'manual_upload',
      'measurement_media',
      'as_media',
      'external_reference',
      'showroom_asset'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS showroom.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  seo_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  status showroom.blog_post_status NOT NULL DEFAULT 'ai_draft',
  category showroom.blog_content_category NOT NULL,
  primary_keyword TEXT,
  target_question TEXT,
  summary_answer TEXT,
  related_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_area TEXT,
  product_type TEXT,
  source_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_check_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_model TEXT,
  source_prompt TEXT,
  ai_citation_ready BOOLEAN NOT NULL DEFAULT FALSE,
  last_fact_checked_at TIMESTAMPTZ,
  media_missing_reason TEXT,
  created_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  published_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_posts_slug_unique UNIQUE (slug),
  CONSTRAINT blog_posts_slug_format_check CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_posts_related_questions_array_check CHECK (jsonb_typeof(related_questions) = 'array'),
  CONSTRAINT blog_posts_source_evidence_array_check CHECK (jsonb_typeof(source_evidence) = 'array'),
  CONSTRAINT blog_posts_brand_check_object_check CHECK (jsonb_typeof(brand_check_result) = 'object'),
  CONSTRAINT blog_posts_ready_required_fields_check CHECK (
    status NOT IN ('ready', 'published')
    OR (
      length(btrim(title)) > 0
      AND length(btrim(slug)) > 0
      AND length(btrim(coalesce(meta_description, ''))) BETWEEN 50 AND 180
      AND length(btrim(coalesce(target_question, ''))) > 0
      AND length(btrim(coalesce(summary_answer, ''))) > 20
      AND last_fact_checked_at IS NOT NULL
    )
  ),
  CONSTRAINT blog_posts_published_fields_check CHECK (
    status <> 'published'
    OR (
      published_at IS NOT NULL
      AND published_by IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS showroom.blog_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES showroom.blog_posts(id) ON DELETE SET NULL,
  source_type showroom.blog_media_source_type NOT NULL,
  source_measurement_media_id UUID REFERENCES platform.measurement_media(id) ON DELETE SET NULL,
  source_as_media_id UUID REFERENCES platform.as_media(id) ON DELETE SET NULL,
  public_bucket TEXT,
  public_object_path TEXT,
  public_url TEXT,
  alt_text TEXT,
  caption TEXT,
  source_label TEXT,
  usage_status showroom.blog_media_usage_status NOT NULL DEFAULT 'candidate',
  privacy_checked BOOLEAN NOT NULL DEFAULT FALSE,
  promotion_consent_checked BOOLEAN NOT NULL DEFAULT FALSE,
  used_as_cover BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_media_measurement_source_check CHECK (
    source_type <> 'measurement_media'
    OR source_measurement_media_id IS NOT NULL
  ),
  CONSTRAINT blog_media_as_source_check CHECK (
    source_type <> 'as_media'
    OR source_as_media_id IS NOT NULL
  ),
  CONSTRAINT blog_media_approved_fields_check CHECK (
    usage_status NOT IN ('approved', 'published')
    OR (
      length(btrim(coalesce(alt_text, ''))) > 0
      AND privacy_checked
      AND promotion_consent_checked
      AND approved_by IS NOT NULL
      AND approved_at IS NOT NULL
    )
  ),
  CONSTRAINT blog_media_published_fields_check CHECK (
    usage_status <> 'published'
    OR (
      length(btrim(coalesce(public_bucket, ''))) > 0
      AND length(btrim(coalesce(public_object_path, ''))) > 0
      AND published_at IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS showroom.blog_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  type showroom.blog_block_type NOT NULL,
  heading_level INTEGER,
  text TEXT,
  media_id UUID REFERENCES showroom.blog_media(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_blocks_post_order_unique UNIQUE (post_id, display_order),
  CONSTRAINT blog_blocks_display_order_check CHECK (display_order >= 0),
  CONSTRAINT blog_blocks_heading_level_check CHECK (
    heading_level IS NULL
    OR heading_level BETWEEN 2 AND 4
  ),
  CONSTRAINT blog_blocks_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT blog_blocks_image_media_check CHECK (
    type <> 'image'
    OR media_id IS NOT NULL
  ),
  CONSTRAINT blog_blocks_text_or_metadata_check CHECK (
    type = 'image'
    OR length(btrim(coalesce(text, ''))) > 0
    OR metadata <> '{}'::jsonb
  )
);

CREATE TABLE IF NOT EXISTS showroom.blog_post_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES showroom.blog_posts(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES platform.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status showroom.blog_post_status,
  to_status showroom.blog_post_status,
  memo TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blog_post_events_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE OR REPLACE TRIGGER set_timestamp_blog_posts
BEFORE UPDATE ON showroom.blog_posts
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE OR REPLACE TRIGGER set_timestamp_blog_media
BEFORE UPDATE ON showroom.blog_media
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE OR REPLACE TRIGGER set_timestamp_blog_blocks
BEFORE UPDATE ON showroom.blog_blocks
FOR EACH ROW
EXECUTE FUNCTION platform.trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS blog_posts_status_updated_idx
  ON showroom.blog_posts(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx
  ON showroom.blog_posts(published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS blog_posts_category_published_idx
  ON showroom.blog_posts(category, published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS blog_posts_keyword_idx
  ON showroom.blog_posts(primary_keyword);

CREATE INDEX IF NOT EXISTS blog_posts_product_area_idx
  ON showroom.blog_posts(product_type, service_area);

CREATE INDEX IF NOT EXISTS blog_posts_related_questions_gin_idx
  ON showroom.blog_posts USING GIN (related_questions);

CREATE INDEX IF NOT EXISTS blog_posts_source_evidence_gin_idx
  ON showroom.blog_posts USING GIN (source_evidence);

CREATE INDEX IF NOT EXISTS blog_blocks_post_order_idx
  ON showroom.blog_blocks(post_id, display_order);

CREATE INDEX IF NOT EXISTS blog_blocks_media_idx
  ON showroom.blog_blocks(media_id)
  WHERE media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_media_post_status_idx
  ON showroom.blog_media(post_id, usage_status);

CREATE INDEX IF NOT EXISTS blog_media_source_measurement_idx
  ON showroom.blog_media(source_measurement_media_id)
  WHERE source_measurement_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS blog_media_source_as_idx
  ON showroom.blog_media(source_as_media_id)
  WHERE source_as_media_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS blog_media_one_cover_per_post_idx
  ON showroom.blog_media(post_id)
  WHERE used_as_cover;

CREATE INDEX IF NOT EXISTS blog_post_events_post_created_idx
  ON showroom.blog_post_events(post_id, created_at DESC);

ALTER TABLE showroom.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.blog_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.blog_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom.blog_post_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON showroom.blog_posts FROM anon, authenticated;
REVOKE ALL ON showroom.blog_blocks FROM anon, authenticated;
REVOKE ALL ON showroom.blog_media FROM anon, authenticated;
REVOKE ALL ON showroom.blog_post_events FROM anon, authenticated;

DROP POLICY IF EXISTS blog_posts_public_select_published ON showroom.blog_posts;
CREATE POLICY blog_posts_public_select_published
ON showroom.blog_posts
FOR SELECT
TO anon
USING (status = 'published');

DROP POLICY IF EXISTS blog_posts_admin_select ON showroom.blog_posts;
CREATE POLICY blog_posts_admin_select
ON showroom.blog_posts
FOR SELECT
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_posts_admin_insert_drafts ON showroom.blog_posts;
CREATE POLICY blog_posts_admin_insert_drafts
ON showroom.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT platform_private.is_admin())
  AND status <> 'published'
);

DROP POLICY IF EXISTS blog_posts_admin_update_unpublished ON showroom.blog_posts;
CREATE POLICY blog_posts_admin_update_unpublished
ON showroom.blog_posts
FOR UPDATE
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK (
  (SELECT platform_private.is_admin())
  AND status <> 'published'
);

DROP POLICY IF EXISTS blog_posts_admin_delete ON showroom.blog_posts;
CREATE POLICY blog_posts_admin_delete
ON showroom.blog_posts
FOR DELETE
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_blocks_public_select_published ON showroom.blog_blocks;
CREATE POLICY blog_blocks_public_select_published
ON showroom.blog_blocks
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM showroom.blog_posts p
    WHERE p.id = post_id
      AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS blog_blocks_admin_select ON showroom.blog_blocks;
CREATE POLICY blog_blocks_admin_select
ON showroom.blog_blocks
FOR SELECT
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_blocks_admin_insert ON showroom.blog_blocks;
CREATE POLICY blog_blocks_admin_insert
ON showroom.blog_blocks
FOR INSERT
TO authenticated
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_blocks_admin_update ON showroom.blog_blocks;
CREATE POLICY blog_blocks_admin_update
ON showroom.blog_blocks
FOR UPDATE
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_blocks_admin_delete ON showroom.blog_blocks;
CREATE POLICY blog_blocks_admin_delete
ON showroom.blog_blocks
FOR DELETE
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_media_public_select_published ON showroom.blog_media;
CREATE POLICY blog_media_public_select_published
ON showroom.blog_media
FOR SELECT
TO anon
USING (
  usage_status = 'published'
  AND EXISTS (
    SELECT 1
    FROM showroom.blog_posts p
    WHERE p.id = post_id
      AND p.status = 'published'
  )
);

DROP POLICY IF EXISTS blog_media_admin_select ON showroom.blog_media;
CREATE POLICY blog_media_admin_select
ON showroom.blog_media
FOR SELECT
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_media_admin_insert_candidates ON showroom.blog_media;
CREATE POLICY blog_media_admin_insert_candidates
ON showroom.blog_media
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT platform_private.is_admin())
  AND usage_status <> 'published'
);

DROP POLICY IF EXISTS blog_media_admin_update_non_published ON showroom.blog_media;
CREATE POLICY blog_media_admin_update_non_published
ON showroom.blog_media
FOR UPDATE
TO authenticated
USING ((SELECT platform_private.is_admin()))
WITH CHECK (
  (SELECT platform_private.is_admin())
  AND usage_status <> 'published'
);

DROP POLICY IF EXISTS blog_media_admin_delete ON showroom.blog_media;
CREATE POLICY blog_media_admin_delete
ON showroom.blog_media
FOR DELETE
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_post_events_admin_select ON showroom.blog_post_events;
CREATE POLICY blog_post_events_admin_select
ON showroom.blog_post_events
FOR SELECT
TO authenticated
USING ((SELECT platform_private.is_admin()));

DROP POLICY IF EXISTS blog_post_events_admin_insert ON showroom.blog_post_events;
CREATE POLICY blog_post_events_admin_insert
ON showroom.blog_post_events
FOR INSERT
TO authenticated
WITH CHECK ((SELECT platform_private.is_admin()));

GRANT USAGE ON SCHEMA showroom TO anon;
GRANT USAGE ON SCHEMA showroom TO authenticated;

GRANT SELECT (
  id,
  title,
  slug,
  excerpt,
  seo_title,
  meta_description,
  canonical_url,
  status,
  category,
  primary_keyword,
  target_question,
  summary_answer,
  service_area,
  product_type,
  ai_citation_ready,
  published_at,
  created_at,
  updated_at
) ON showroom.blog_posts TO anon;

GRANT SELECT (
  id,
  post_id,
  display_order,
  type,
  heading_level,
  text,
  media_id,
  metadata,
  created_at,
  updated_at
) ON showroom.blog_blocks TO anon;

GRANT SELECT (
  id,
  post_id,
  public_bucket,
  public_object_path,
  public_url,
  alt_text,
  caption,
  usage_status,
  used_as_cover,
  created_at,
  updated_at
) ON showroom.blog_media TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_media TO authenticated;
GRANT SELECT, INSERT ON showroom.blog_post_events TO authenticated;

GRANT USAGE ON SCHEMA showroom TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_posts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_blocks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_media TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON showroom.blog_post_events TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'blog-media-private',
    'blog-media-private',
    FALSE,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::TEXT[]
  ),
  (
    'blog-media',
    'blog-media',
    TRUE,
    52428800,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage object policy draft lives in:
-- supabase/storage-policies/content_os_storage_policies.sql
--
-- Some managed migration runners cannot alter storage.objects because that
-- relation is owned by the storage extension. Keep bucket creation here, and
-- apply object policies with a DB owner/Supabase CLI context.

COMMENT ON TABLE showroom.blog_posts IS
  'Content OS posts. TODO(PR-06): final published transition must be performed by a server action/service role after re-validating the publish gate.';

COMMENT ON POLICY blog_posts_admin_update_unpublished ON showroom.blog_posts IS
  'Authenticated admins can edit drafts and ready posts, but cannot directly set status=published from a client. PR-06 server-side publish must perform the final transition.';

COMMENT ON POLICY blog_media_admin_update_non_published ON showroom.blog_media IS
  'Authenticated admins can approve media, but cannot directly set usage_status=published from a client. PR-06 server-side publish must promote public media.';

NOTIFY pgrst, 'reload schema';
