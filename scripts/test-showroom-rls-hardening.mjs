import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDirectory = path.join(projectRoot, 'supabase', 'migrations')
const migrationNameSuffix = '_restrict_showroom_preview_and_fix_asset_rls.sql'
const assetBoundaryMigrationSuffix = '_enforce_content_asset_public_derivative_boundary.sql'
const migrationNames = await readdir(migrationsDirectory)
const matchingMigrations = migrationNames.filter((name) => name.endsWith(migrationNameSuffix))
const matchingAssetBoundaryMigrations = migrationNames.filter((name) => name.endsWith(assetBoundaryMigrationSuffix))

assert.equal(
  matchingMigrations.length,
  1,
  `expected exactly one forward migration ending in ${migrationNameSuffix}`,
)

const migration = await readFile(path.join(migrationsDirectory, matchingMigrations[0]), 'utf8')

assert.equal(
  matchingAssetBoundaryMigrations.length,
  1,
  `expected exactly one forward migration ending in ${assetBoundaryMigrationSuffix}`,
)

const assetBoundaryMigration = await readFile(
  path.join(migrationsDirectory, matchingAssetBoundaryMigrations[0]),
  'utf8',
)

assert.match(migration, /DROP POLICY IF EXISTS auth_all_preview_tokens ON showroom\.preview_tokens/i)
assert.match(migration, /REVOKE ALL ON showroom\.preview_tokens FROM authenticated/i)
assert.match(
  migration,
  /GRANT SELECT, INSERT, UPDATE, DELETE ON showroom\.preview_tokens TO authenticated/i,
)
assert.match(
  migration,
  /CREATE POLICY administrator_manage_preview_tokens[\s\S]*?TO authenticated[\s\S]*?platform_private\.is_admin\(\)[\s\S]*?WITH CHECK[\s\S]*?platform_private\.is_admin\(\)/i,
)

for (const [table, oldPolicy, publicPolicy, publicPredicate] of [
  ['nodes', 'authenticated_read_nodes', 'authenticated_read_visible_nodes', "status = 'published'"],
  ['hero_media', 'authenticated_read_hero_media', 'authenticated_read_visible_hero_media', 'private.is_node_visible(node_id)'],
  ['gallery_photos', 'authenticated_read_gallery_photos', 'authenticated_read_visible_gallery_photos', 'private.is_node_visible(node_id)'],
]) {
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON showroom\\.${table} FROM anon, authenticated`, 'i'),
  )
  assert.match(
    migration,
    new RegExp(`DROP POLICY IF EXISTS ${oldPolicy} ON showroom\\.${table}`, 'i'),
  )
  assert.match(
    migration,
    new RegExp(`CREATE POLICY ${publicPolicy}[\\s\\S]*?ON showroom\\.${table}[\\s\\S]*?TO authenticated`, 'i'),
  )
  assert.ok(
    migration.includes(publicPredicate),
    `${table} authenticated public policy must preserve the anon visibility predicate`,
  )
}

assert.match(
  migration,
  /DROP POLICY IF EXISTS content_assets_public_select_published_usage ON showroom\.content_assets/i,
)
assert.match(
  migration,
  /CREATE POLICY content_assets_public_select_published_usage[\s\S]*?u\.asset_id = showroom\.content_assets\.id/i,
)
assert.doesNotMatch(migration, /u\.asset_id\s*=\s*id\b/i)
assert.match(migration, /asset_media\.content_asset_id = p_asset_id/i)
assert.match(migration, /asset_media\.usage_status = 'published'/i)
assert.match(migration, /asset_media\.privacy_checked/i)
assert.match(migration, /asset_media\.promotion_consent_checked/i)
assert.match(migration, /asset_media\.public_url IS NOT NULL/i)
assert.match(migration, /block_media\.id = blog_block\.media_id/i)
assert.match(migration, /block_media\.content_asset_id = p_asset_id/i)
assert.match(migration, /block_media\.usage_status = 'published'/i)
assert.match(migration, /block_media\.privacy_checked/i)
assert.match(migration, /block_media\.promotion_consent_checked/i)
assert.match(migration, /block_media\.public_url IS NOT NULL/i)
assert.match(migration, /blog_post\.status = 'published'/i)
for (const role of ['PUBLIC', 'authenticated', 'service_role']) {
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON FUNCTION private\\.is_published_content_asset_usage\\(UUID, UUID\\) FROM ${role}`, 'i'),
  )
}
assert.match(
  migration,
  /GRANT EXECUTE ON FUNCTION private\.is_published_content_asset_usage\(UUID, UUID\) TO anon/i,
)

assert.match(
  assetBoundaryMigration,
  /CREATE OR REPLACE FUNCTION private\.is_public_content_asset\(\s*p_asset_id UUID\s*\)/i,
)
assert.match(assetBoundaryMigration, /SECURITY DEFINER[\s\S]*?SET search_path = ''/i)
assert.match(assetBoundaryMigration, /asset\.id = p_asset_id/i)
assert.match(assetBoundaryMigration, /asset\.library_state = 'available'/i)
assert.match(assetBoundaryMigration, /asset\.privacy_checked/i)
assert.match(assetBoundaryMigration, /asset\.promotion_consent_checked/i)
assert.match(assetBoundaryMigration, /usage\.asset_id = asset\.id/i)
assert.match(
  assetBoundaryMigration,
  /private\.is_published_content_asset_usage\(asset\.id, usage\.id\)/i,
)
for (const role of ['PUBLIC', 'authenticated', 'service_role']) {
  assert.match(
    assetBoundaryMigration,
    new RegExp(`REVOKE ALL ON FUNCTION private\\.is_public_content_asset\\(UUID\\) FROM ${role}`, 'i'),
  )
}
assert.match(
  assetBoundaryMigration,
  /GRANT EXECUTE ON FUNCTION private\.is_public_content_asset\(UUID\) TO anon/i,
)
for (const policy of [
  'content_assets_public_select_published_usage',
  'content_asset_files_public_select_ready_derivatives',
  'content_asset_usages_public_select_published_blog',
]) {
  assert.match(assetBoundaryMigration, new RegExp(`DROP POLICY IF EXISTS ${policy}`, 'i'))
  assert.match(assetBoundaryMigration, new RegExp(`CREATE POLICY ${policy}`, 'i'))
}
assert.match(
  assetBoundaryMigration,
  /content_asset_files_public_select_ready_derivatives[\s\S]*?file_role IN \('web', 'thumbnail'\)[\s\S]*?transform_status = 'ready'[\s\S]*?public_url IS NOT NULL[\s\S]*?private\.is_public_content_asset\(asset_id\)/i,
)
assert.match(
  assetBoundaryMigration,
  /content_asset_usages_public_select_published_blog[\s\S]*?private\.is_published_content_asset_usage\(asset_id, id\)/i,
)

assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.get_preview_payload\(TEXT\) FROM PUBLIC/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.get_preview_payload\(TEXT\) FROM authenticated/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.get_preview_payload\(TEXT\) FROM service_role/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION showroom\.get_preview_payload\(TEXT\) TO anon/i)

console.log('showroom RLS hardening migration contract passed')
