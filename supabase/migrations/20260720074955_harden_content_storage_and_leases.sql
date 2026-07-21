-- Public bucket delivery uses the object URL endpoint and does not require
-- Data API object listing. Remove the two bucket-wide anon SELECT policies.
DROP POLICY IF EXISTS blog_media_public_select ON storage.objects;
DROP POLICY IF EXISTS content_assets_public_select ON storage.objects;

-- The lease table remains an internal service-role coordination primitive.
-- RLS is intentionally enabled without an end-user policy; service_role owns
-- only the operations required by the lease RPCs.
CREATE INDEX IF NOT EXISTS blog_editor_save_leases_actor_idx
  ON showroom.blog_editor_save_leases(actor_id);

ALTER TABLE showroom.blog_editor_save_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON showroom.blog_editor_save_leases FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON showroom.blog_editor_save_leases TO service_role;

COMMENT ON INDEX showroom.blog_editor_save_leases_actor_idx IS
  'Covers the actor_id foreign key for service-role-only editor save lease coordination.';
