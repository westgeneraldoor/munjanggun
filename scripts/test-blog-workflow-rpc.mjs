import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const migration = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260723070030_admin_cms_atomic_publish_trash_and_revision.sql'),
  'utf8',
)
const actions = await readFile(
  path.join(projectRoot, 'src/app/admin/platform/blog/[id]/actions.ts'),
  'utf8',
)

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.save_and_publish_blog_post\s*\(/i)
assert.match(migration, /CREATE TABLE IF NOT EXISTS showroom\.blog_publication_attempts/i)
assert.match(migration, /CREATE TABLE IF NOT EXISTS showroom\.blog_public_media_objects/i)
assert.match(
  migration,
  /post_id UUID REFERENCES showroom\.blog_posts\(id\) ON DELETE SET NULL/i,
  'publication attempts must survive post deletion until their storage reconciliation is complete',
)
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.create_blog_publication_attempt\s*\(/i)
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.heartbeat_blog_publication_attempt\s*\(/i)
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.claim_expired_blog_publication_attempt\s*\(/i)
assert.match(
  migration,
  /create_blog_publication_attempt[\s\S]*?FROM showroom\.blog_posts AS post[\s\S]*?FOR UPDATE[\s\S]*?INSERT INTO showroom\.blog_publication_attempts/i,
  'attempt creation must validate and lock the post before staging begins',
)
assert.match(migration, /LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = ''/i)
assert.match(
  migration,
  /FROM showroom\.blog_posts AS post[\s\S]*?WHERE post\.id = p_post_id[\s\S]*?FOR UPDATE/i,
  'publication must lock the post before checking the editor revision',
)
assert.match(migration, /v_post_updated_at IS DISTINCT FROM p_expected_updated_at/i)
assert.match(migration, /attempt\.status = 'staged'[\s\S]*?FOR UPDATE/i)
assert.match(migration, /FROM showroom\.blog_editor_save_leases AS lease[\s\S]*?p_post_id/i)
assert.match(migration, /FROM showroom\.blog_media AS media[\s\S]*?FOR UPDATE/i)
assert.equal(
  (migration.match(/SELECT usage\.asset_id[\s\S]*?FROM showroom\.content_asset_usages AS usage/g) ?? []).length,
  2,
  'publication and permanent deletion must lock usage-only assets before deleting usage rows',
)
assert.match(migration, /DELETE FROM showroom\.content_asset_usages/i)
assert.match(migration, /DELETE FROM showroom\.blog_blocks/i)
assert.match(migration, /INSERT INTO showroom\.blog_blocks/i)
assert.match(migration, /UPDATE showroom\.blog_media/i)
assert.match(migration, /INSERT INTO showroom\.blog_public_media_objects/i)
assert.match(migration, /'retired_blog_publication:' \|\| p_publication_attempt_id::TEXT/i)
assert.match(migration, /retired_cleanup_job_id = v_retired_cleanup_job_id/i)
assert.match(migration, /status = 'published'[\s\S]*?WHERE attempt\.id = p_publication_attempt_id/i)
assert.match(migration, /status = 'published'::showroom\.blog_post_status/i)
assert.match(migration, /INSERT INTO showroom\.blog_post_events/i)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION showroom\.save_and_publish_blog_post[\s\S]*?FROM PUBLIC, anon, authenticated/i,
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION showroom\.save_and_publish_blog_post[\s\S]*?TO service_role/i,
)

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.transition_blog_post_trash\s*\(/i)
assert.match(migration, /FROM showroom\.blog_media AS media[\s\S]*?FOR UPDATE/i)
assert.match(
  migration,
  /usage_status = 'approved'::showroom\.blog_media_usage_status[\s\S]*?usage_status = 'published'::showroom\.blog_media_usage_status/i,
  'moving a published post to trash must make its media eligible for a later reviewed re-publication',
)
assert.match(migration, /'moved_to_trash'/i)
assert.match(migration, /'restored_from_trash'/i)
assert.match(migration, /state = 'trash_pending'/i)
assert.match(migration, /'trashed_blog_post:' \|\| p_post_id::TEXT/i)
assert.equal(
  (migration.match(/a publication attempt is still in progress/g) ?? []).length,
  2,
  'trash and permanent deletion must both reject staged or reconcile publication attempts',
)

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.permanently_delete_blog_post\s*\(/i)
assert.match(migration, /p_confirmation IS DISTINCT FROM v_post_title/)
assert.match(migration, /v_post_status IS DISTINCT FROM 'archived'::showroom\.blog_post_status/i)
assert.match(
  migration,
  /DELETE FROM showroom\.blog_blocks AS block[\s\S]*?DELETE FROM showroom\.blog_media AS media/,
  'image blocks must be deleted before media to satisfy the image media_id check constraint',
)
assert.match(migration, /DROP POLICY IF EXISTS blog_posts_admin_delete ON showroom\.blog_posts/i)
assert.match(migration, /REVOKE UPDATE ON showroom\.blog_posts FROM authenticated/i)
assert.doesNotMatch(
  migration.match(/GRANT UPDATE \([\s\S]*?\) ON showroom\.blog_posts TO authenticated/i)?.[0] ?? '',
  /\bstatus\b|\bpublished_at\b|\bpublished_by\b/i,
  'authenticated column updates must not bypass publication state RPCs',
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION showroom\.permanently_delete_blog_post[\s\S]*?FROM PUBLIC, anon, authenticated/i,
)
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION showroom\.permanently_delete_blog_post[\s\S]*?TO service_role/i,
)

assert.match(actions, /export async function publishBlogEditor\s*\(\s*payload: SaveBlogEditorPayload/)
assert.match(actions, /\.rpc\('save_and_publish_blog_post'/)
assert.match(actions, /publicationAttemptId = randomUUID\(\)/)
assert.match(actions, /createPublicationAttempt\(/)
assert.match(actions, /\.rpc\('create_blog_publication_attempt'/)
assert.match(actions, /\.rpc\('heartbeat_blog_publication_attempt'/)
assert.match(actions, /\.rpc\(\s*'claim_expired_blog_publication_attempt'/)
assert.match(actions, /recordPublicationAttemptPaths\(/)
assert.match(
  actions,
  /await recordPublicationAttemptPaths\([\s\S]*?for \(const \{ media, publicObjectPath, prepared \} of preparedMedia\)[\s\S]*?\.upload\(/,
  'every public object path must be durably reserved before the first upload',
)
assert.match(actions, /updatedRows\.length !== 1/)
assert.match(actions, /\.rpc\('resolve_blog_publication_attempt'/)
assert.match(
  actions,
  /if \(publishError\)[\s\S]*?resolveAmbiguousPublication[\s\S]*?resolution\.kind === 'published'/,
  'an ambiguous RPC error must resolve the attempt before any staged object cleanup',
)
assert.match(actions, /공개 사진은 삭제하지 않았습니다/)
assert.match(actions, /export async function permanentlyDeleteBlogPost\s*\(/)
assert.match(actions, /export async function retryPendingBlogMediaCleanup\s*\(/)
const cleanupRetrySource = actions.match(
  /export async function retryPendingBlogMediaCleanup[\s\S]*?export async function|export async function retryPendingBlogMediaCleanup[\s\S]*$/,
)?.[0] ?? ''
assert.match(cleanupRetrySource, /\.eq\('status', 'reconcile'\)/)
assert.match(cleanupRetrySource, /\.eq\('status', 'staged'\)[\s\S]*?\.lte\('staging_expires_at', now\)/)
assert.match(
  cleanupRetrySource,
  /cleanupTrackedPublicObjects\([\s\S]*?job\.attempts \+ 1/,
  'manual cleanup retries must surface ledger and cleanup-job update failures',
)
assert.doesNotMatch(
  cleanupRetrySource,
  /\.in\('status', \['staged', 'reconcile'\]\)/,
  'a generic cleanup retry must not abandon a publication process that is still staging external uploads',
)
assert.match(actions, /reason\.like\.trashed_blog_post:%/)
assert.match(actions, /reason\.like\.retired_blog_publication:%/)
assert.match(actions, /\.rpc\('permanently_delete_blog_post'/)
assert.match(actions, /\.rpc\('transition_blog_post_trash'/)

console.log('atomic blog publish and destructive-action RPC contracts passed')
