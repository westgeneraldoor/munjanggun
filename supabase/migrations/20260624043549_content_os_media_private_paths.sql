-- MVP-CONTENTOS-01 / PR-01 hardening: separate private candidate paths
-- from public promoted paths before the admin media slot UI is built.

ALTER TABLE showroom.blog_media
  ADD COLUMN IF NOT EXISTS private_bucket TEXT,
  ADD COLUMN IF NOT EXISTS private_object_path TEXT;

COMMENT ON COLUMN showroom.blog_media.private_bucket IS
  'Private candidate/original bucket used before public promotion, normally blog-media-private.';

COMMENT ON COLUMN showroom.blog_media.private_object_path IS
  'Private candidate/original object path used before public promotion. Never expose this to anon clients.';

COMMENT ON COLUMN showroom.blog_media.public_bucket IS
  'Public promoted bucket used only after publish, normally blog-media.';

COMMENT ON COLUMN showroom.blog_media.public_object_path IS
  'Public promoted object path used only after publish.';

ALTER TABLE showroom.blog_media
  DROP CONSTRAINT IF EXISTS blog_media_approved_fields_check,
  DROP CONSTRAINT IF EXISTS blog_media_published_fields_check,
  ADD CONSTRAINT blog_media_private_candidate_path_check CHECK (
    usage_status NOT IN ('candidate', 'approved')
    OR source_type IN ('external_reference', 'showroom_asset')
    OR (
      length(btrim(coalesce(private_bucket, ''))) > 0
      AND length(btrim(coalesce(private_object_path, ''))) > 0
    )
  ),
  ADD CONSTRAINT blog_media_approved_fields_check CHECK (
    usage_status NOT IN ('approved', 'published')
    OR (
      length(btrim(coalesce(alt_text, ''))) > 0
      AND privacy_checked
      AND promotion_consent_checked
      AND approved_by IS NOT NULL
      AND approved_at IS NOT NULL
    )
  ),
  ADD CONSTRAINT blog_media_published_fields_check CHECK (
    usage_status <> 'published'
    OR (
      length(btrim(coalesce(public_bucket, ''))) > 0
      AND length(btrim(coalesce(public_object_path, ''))) > 0
      AND published_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS blog_media_private_object_idx
  ON showroom.blog_media(private_bucket, private_object_path)
  WHERE private_bucket IS NOT NULL
    AND private_object_path IS NOT NULL;

-- Do not grant private_bucket/private_object_path to anon. They are admin-only
-- candidate/original references and must not leak through the Data API.
NOTIFY pgrst, 'reload schema';
