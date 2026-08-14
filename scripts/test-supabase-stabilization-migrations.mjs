import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationNames = await readdir(path.join(projectRoot, 'supabase', 'migrations'))

const expectedRemoteAlignedMigrations = [
  '20260602073000_colorbook_schema_bootstrap.sql',
  '20260604020221_platform_category_images.sql',
  '20260604023543_add_measurement_referrer.sql',
  '20260604090635_measurement_contact_region_flow.sql',
  '20260605081647_platform_as_requests_mvp07.sql',
  '20260609073158_platform_request_queue_statuses.sql',
  '20260609073521_platform_as_address_fields.sql',
  '20260610001818_platform_processed_by_indexes.sql',
  '20260702011815_platform_blog_reader_activity.sql',
  '20260715090227_official_asset_gif_support.sql',
  '20260715233310_official_asset_provenance_hardening.sql',
  '20260715235109_private_candidate_derivatives.sql',
  '20260715235349_fix_private_derivative_rpc_role_cast.sql',
  '20260720005042_automate_blog_source_provenance.sql',
  '20260720005052_atomic_official_asset_blog_placement.sql',
  '20260720074000_showroom_schema_bootstrap.sql',
  '20260720074812_atomic_node_reorder.sql',
  '20260720074843_atomic_site_settings_save.sql',
  '20260720074917_atomic_node_save.sql',
  '20260720074955_harden_content_storage_and_leases.sql',
  '20260720075020_harden_showroom_preview_payload.sql',
  '20260720075047_detach_unused_official_asset_from_reviewing_post.sql',
  '20260720075242_fix_detach_unused_official_asset_uuid_selection.sql',
  '20260721013710_restrict_showroom_preview_and_fix_asset_rls.sql',
  '20260721015552_enforce_content_asset_public_derivative_boundary.sql',
  '20260721044929_restrict_showroom_image_storage_to_administrators.sql',
  '20260721044937_restore_search_index_view.sql',
  '20260721044938_secure_search_index_view.sql',
  '20260721044952_add_missing_blog_body_block_types.sql',
]
for (const name of expectedRemoteAlignedMigrations) {
  assert.ok(migrationNames.includes(name), `missing exact remote-aligned migration ${name}`)
}
for (const staleName of [
  '20260715090000_official_asset_gif_support.sql',
  '20260715092000_official_asset_provenance_hardening.sql',
  '20260715100000_private_candidate_derivatives.sql',
  '20260715101000_fix_private_derivative_rpc_role_cast.sql',
  '20260716011034_automate_blog_source_provenance.sql',
  '20260716093000_atomic_node_reorder.sql',
  '20260716153000_atomic_site_settings_save.sql',
  '20260716170000_atomic_node_save.sql',
  '20260720000313_atomic_official_asset_blog_placement.sql',
  '20260720073724_atomic_node_reorder.sql',
  '20260720073728_atomic_site_settings_save.sql',
  '20260720073732_atomic_node_save.sql',
  '20260720073737_harden_content_storage_and_leases.sql',
  '20260720073740_harden_showroom_preview_payload.sql',
  '20260720074055_detach_unused_official_asset_from_reviewing_post.sql',
  '20260720075140_fix_detach_unused_official_asset_uuid_selection.sql',
  '20260604093000_platform_category_images.sql',
  '20260604113000_add_measurement_referrer.sql',
  '20260604152000_measurement_contact_region_flow.sql',
  '20260605093000_platform_as_requests_mvp07.sql',
  '20260609093000_platform_request_queue_statuses.sql',
  '20260609094500_platform_as_address_fields.sql',
  '20260610093000_platform_processed_by_indexes.sql',
  '20260702002856_platform_blog_reader_activity.sql',
  '20260630052000_blog_body_blocks_pr19.sql',
]) {
  assert.equal(migrationNames.includes(staleName), false, `stale migration version must not remain: ${staleName}`)
}

const [
  reorder,
  settings,
  nodeSave,
  hardening,
  contentOsPolicies,
  assetPolicies,
  showroomImagePolicies,
  searchIndexView,
  blogBlockTypes,
] = await Promise.all([
  readFile(path.join(projectRoot, 'supabase/migrations/20260720074812_atomic_node_reorder.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/migrations/20260720074843_atomic_site_settings_save.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/migrations/20260720074917_atomic_node_save.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/migrations/20260720074955_harden_content_storage_and_leases.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/storage-policies/content_os_storage_policies.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/storage-policies/content_asset_library_storage_policies.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/migrations/20260721044929_restrict_showroom_image_storage_to_administrators.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/migrations/20260721044938_secure_search_index_view.sql'), 'utf8'),
  readFile(path.join(projectRoot, 'supabase/migrations/20260721044952_add_missing_blog_body_block_types.sql'), 'utf8'),
])

for (const [source, signature] of [
  [reorder, 'showroom.reorder_nodes(UUID, UUID[])'],
  [settings, 'showroom.save_site_settings(JSONB, JSONB)'],
  [nodeSave, 'showroom.save_node(UUID, JSONB, JSONB, JSONB)'],
]) {
  const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert.match(source, new RegExp(`REVOKE ALL ON FUNCTION ${escaped} FROM PUBLIC`, 'i'))
  assert.match(source, new RegExp(`REVOKE ALL ON FUNCTION ${escaped} FROM anon`, 'i'))
  assert.match(source, new RegExp(`REVOKE ALL ON FUNCTION ${escaped} FROM service_role`, 'i'))
  assert.match(source, new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped} TO authenticated`, 'i'))
}

assert.match(reorder, /profile\.id = auth\.uid\(\)[\s\S]*?administrator/i)
assert.match(hardening, /DROP POLICY IF EXISTS blog_media_public_select ON storage\.objects/i)
assert.match(hardening, /DROP POLICY IF EXISTS content_assets_public_select ON storage\.objects/i)
assert.match(hardening, /CREATE INDEX IF NOT EXISTS blog_editor_save_leases_actor_idx[\s\S]*?actor_id/i)
assert.match(hardening, /ALTER TABLE showroom\.blog_editor_save_leases ENABLE ROW LEVEL SECURITY/i)
assert.match(hardening, /REVOKE ALL ON showroom\.blog_editor_save_leases FROM PUBLIC, anon, authenticated, service_role/i)
assert.match(hardening, /GRANT SELECT, INSERT, DELETE ON showroom\.blog_editor_save_leases TO service_role/i)
assert.doesNotMatch(hardening, /CREATE POLICY[\s\S]*?blog_editor_save_leases/i, 'lease hardening must not create an end-user RLS policy')

assert.doesNotMatch(contentOsPolicies, /CREATE POLICY blog_media_public_select/i)
assert.doesNotMatch(assetPolicies, /CREATE POLICY content_assets_public_select/i)
assert.match(contentOsPolicies, /DROP POLICY IF EXISTS blog_media_public_select/i)
assert.match(assetPolicies, /DROP POLICY IF EXISTS content_assets_public_select/i)

for (const operation of ['select', 'insert', 'update', 'delete']) {
  assert.match(showroomImagePolicies, new RegExp(`create policy showroom_images_administrator_${operation}`, 'i'))
}
assert.doesNotMatch(showroomImagePolicies, /to anon|to public/i)
assert.match(showroomImagePolicies, /to authenticated[\s\S]*?platform_private\.is_admin\(\)/i)

assert.match(searchIndexView, /alter view public\.vw_search_index[\s\S]*?security_invoker\s*=\s*true/i)
assert.match(searchIndexView, /revoke all on public\.vw_search_index[\s\S]*?from public, anon, authenticated, service_role/i)
assert.match(searchIndexView, /grant select on public\.vw_search_index[\s\S]*?to anon, authenticated, service_role/i)

assert.match(blogBlockTypes, /add value if not exists 'link_button'/i)
assert.match(blogBlockTypes, /add value if not exists 'guide_box'/i)

console.log('Supabase stabilization migration contracts passed')
