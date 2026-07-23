import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const migration = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260723060901_atomic_blog_editor_publish_and_trash.sql'),
  'utf8',
)
const actions = await readFile(
  path.join(projectRoot, 'src/app/admin/platform/blog/[id]/actions.ts'),
  'utf8',
)

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.save_and_publish_blog_post\s*\(/i)
assert.match(migration, /LANGUAGE plpgsql\s+SECURITY INVOKER\s+SET search_path = ''/i)
assert.match(
  migration,
  /FROM showroom\.blog_posts AS post[\s\S]*?WHERE post\.id = p_post_id[\s\S]*?FOR UPDATE/i,
  'publication must lock the post before checking the editor revision',
)
assert.match(migration, /v_post_updated_at IS DISTINCT FROM p_expected_updated_at/i)
assert.match(migration, /FROM showroom\.blog_editor_save_leases AS lease[\s\S]*?p_post_id/i)
assert.match(migration, /FROM showroom\.blog_media AS media[\s\S]*?FOR UPDATE/i)
assert.match(migration, /DELETE FROM showroom\.content_asset_usages/i)
assert.match(migration, /DELETE FROM showroom\.blog_blocks/i)
assert.match(migration, /INSERT INTO showroom\.blog_blocks/i)
assert.match(migration, /UPDATE showroom\.blog_media/i)
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

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.permanently_delete_blog_post\s*\(/i)
assert.match(migration, /p_confirmation IS DISTINCT FROM v_post_title/)
assert.match(migration, /v_post_status IS DISTINCT FROM 'archived'::showroom\.blog_post_status/i)
assert.match(migration, /DROP POLICY IF EXISTS blog_posts_admin_delete ON showroom\.blog_posts/i)
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
assert.match(actions, /const publicationAttemptId = randomUUID\(\)/)
assert.match(actions, /cleanupPublicObjects\(uploadedPaths\)/)
assert.match(actions, /export async function permanentlyDeleteBlogPost\s*\(/)
assert.match(actions, /\.rpc\('permanently_delete_blog_post'/)
assert.match(actions, /\.rpc\('transition_blog_post_trash'/)

console.log('atomic blog publish and destructive-action RPC contracts passed')
