import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  normalizeOfficialAssetPlacementResult,
  validateOfficialAssetPlacementOptions,
} from '../src/lib/content-assets/official-brand-blog-placement.mjs'

const postId = 'c77f01db-3adf-46cd-b76e-dc07da211754'
const mediaId = 'f8ae3701-1ae3-491b-aa05-c8f95817699e'
const blockId = '7276fa47-20a0-4717-b419-27c53533aeae'

assert.deepEqual(
  validateOfficialAssetPlacementOptions({ postId, cover: true }),
  { postId, cover: true, blockId: null, insertAfterBlockId: null },
)
assert.deepEqual(
  validateOfficialAssetPlacementOptions({ postId, insertAfterBlockId: blockId }),
  { postId, cover: false, blockId: null, insertAfterBlockId: blockId },
)
assert.throws(
  () => validateOfficialAssetPlacementOptions({ cover: true }),
  /require --post-id/,
)
assert.throws(
  () => validateOfficialAssetPlacementOptions({ postId, blockId, insertAfterBlockId: blockId }),
  /mutually exclusive/,
)

assert.deepEqual(normalizeOfficialAssetPlacementResult({
  mediaId,
  blockId,
  createdMedia: true,
  cover: false,
  insertedBlock: true,
  shiftedBlocks: 21,
  eventsCreated: 1,
}), {
  mediaId,
  blockId,
  createdMedia: true,
  cover: false,
  insertedBlock: true,
  shiftedBlocks: 21,
  eventsCreated: 1,
})
assert.throws(
  () => normalizeOfficialAssetPlacementResult({ mediaId: 'not-a-uuid' }),
  /valid media ID/,
)
assert.throws(
  () => normalizeOfficialAssetPlacementResult({
    mediaId,
    blockId: null,
    createdMedia: false,
    cover: false,
    insertedBlock: false,
    shiftedBlocks: -1,
    eventsCreated: 0,
  }),
  /shiftedBlocks/,
)

const commandSource = await readFile(new URL('./register-official-brand-asset.mjs', import.meta.url), 'utf8')
const migrationSource = await readFile(
  new URL('../supabase/migrations/20260720005052_atomic_official_asset_blog_placement.sql', import.meta.url),
  'utf8',
)
const adapterSource = await readFile(new URL('../docs/brand/PROJECT_BRAND_ADAPTER.md', import.meta.url), 'utf8')
const schemaSource = await readFile(new URL('../docs/platform/CONTENT_ASSET_LIBRARY_SCHEMA.md', import.meta.url), 'utf8')
const editorActionSource = await readFile(new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url), 'utf8')
const editorClientSource = await readFile(new URL('../src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', import.meta.url), 'utf8')
const leaseReconciliationSource = await readFile(new URL('./reconcile-blog-editor-save-lease.mjs', import.meta.url), 'utf8')

for (const requiredFlag of ['--cover', '--insert-after-block-id']) {
  assert.ok(commandSource.includes(requiredFlag), `command must document ${requiredFlag}`)
}
const attachStart = commandSource.indexOf('async function attachToBlog')
const attachEnd = commandSource.indexOf('async function main()', attachStart)
assert.ok(attachStart >= 0 && attachEnd > attachStart, 'atomic attachment function must exist')
const attachSource = commandSource.slice(attachStart, attachEnd)
assert.match(attachSource, /\.rpc\('attach_official_asset_to_reviewing_post'/)
assert.doesNotMatch(attachSource, /\.from\('(blog_posts|blog_media|blog_blocks|content_asset_usages|content_asset_events)'\)/)
assert.match(commandSource, /cleanupCreatedAssetIfUnreferenced/)
assert.match(commandSource, /retained for reconciliation because committed references exist/)
assert.match(commandSource, /\.rpc\('delete_unreferenced_official_asset'/)
assert.match(commandSource, /metadata was deleted safely/)
assert.doesNotMatch(commandSource, /from\('content_assets'\)\.delete/)
assert.doesNotMatch(commandSource, /execute_sql|storage\.objects/i)

assert.match(migrationSource, /CREATE OR REPLACE FUNCTION showroom\.attach_official_asset_to_reviewing_post/)
assert.match(migrationSource, /SECURITY INVOKER/)
assert.match(migrationSource, /SET search_path = ''/)
assert.match(migrationSource, /FROM showroom\.blog_posts[\s\S]*FOR UPDATE/)
assert.match(migrationSource, /v_post_status IS DISTINCT FROM 'reviewing'/)
assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS showroom\.blog_editor_save_leases/)
assert.match(migrationSource, /CREATE OR REPLACE FUNCTION showroom\.acquire_blog_editor_save_lease/)
assert.match(migrationSource, /CREATE OR REPLACE FUNCTION showroom\.release_blog_editor_save_lease/)
assert.match(migrationSource, /CREATE OR REPLACE FUNCTION showroom\.reconcile_blog_editor_save_lease/)
assert.match(migrationSource, /INTERVAL '15 minutes'/)
assert.match(migrationSource, /editor_save_lease_reconciled/)
assert.match(migrationSource, /blog editor save is in progress/)
assert.match(migrationSource, /SET updated_at = clock_timestamp\(\)/)
assert.match(migrationSource, /privacyStatus}' = 'official_reviewed'/)
assert.match(migrationSource, /ORDER BY block\.display_order DESC/)
assert.match(migrationSource, /INSERT INTO showroom\.blog_media/)
assert.match(migrationSource, /INSERT INTO showroom\.blog_blocks/)
assert.match(migrationSource, /INSERT INTO showroom\.content_asset_usages/)
assert.match(migrationSource, /INSERT INTO showroom\.content_asset_events/)
assert.match(migrationSource, /attached_to_blog_cover/)
assert.match(migrationSource, /inserted_into_blog_body/)
assert.match(migrationSource, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/)
assert.match(migrationSource, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/)
assert.match(migrationSource, /CREATE OR REPLACE FUNCTION showroom\.delete_unreferenced_official_asset/)
assert.match(migrationSource, /FROM showroom\.content_assets AS asset[\s\S]*FOR UPDATE/)
assert.match(migrationSource, /DELETE FROM showroom\.content_assets AS asset/)
assert.match(migrationSource, /'storageFiles', v_storage_files/)

assert.match(editorActionSource, /\.rpc\('acquire_blog_editor_save_lease'/)
assert.match(editorActionSource, /finally \{/)
assert.match(editorActionSource, /\.rpc\('release_blog_editor_save_lease'/)
assert.match(editorClientSource, /useState\(initialPost\.updatedAt\)/)
assert.match(
  editorClientSource,
  /expectedUpdatedAt: currentRevision/,
  'subsequent saves must use the latest server-acknowledged editor revision',
)
assert.match(leaseReconciliationSource, /CODEX_AUDIT_ACTOR_ID/)
assert.match(leaseReconciliationSource, /\.rpc\('reconcile_blog_editor_save_lease'/)
assert.doesNotMatch(leaseReconciliationSource, /execute_sql|storage\.objects/i)

assert.match(adapterSource, /--cover/)
assert.match(adapterSource, /--insert-after-block-id/)
assert.match(adapterSource, /단일 DB 트랜잭션/)
assert.match(schemaSource, /attach_official_asset_to_reviewing_post/)

console.log('official brand asset atomic placement contract passed')
