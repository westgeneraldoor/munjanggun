import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const migrationNames = await readdir(new URL('../supabase/migrations/', import.meta.url))
const migrationName = migrationNames.find(name => name.endsWith('_content_asset_library_server_query.sql'))
const migration = migrationName
  ? await readFile(new URL(`../supabase/migrations/${migrationName}`, import.meta.url), 'utf8')
  : ''

assert.ok(migrationName, 'a dedicated content asset library server-query migration must exist')
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.list_content_assets_admin/i)
assert.match(migration, /COUNT\(\*\)/i, 'the database must calculate the complete result count')
assert.match(migration, /library_sort_name/i, 'file-name sorting must use an asset-row projection, not a per-row event lookup')
assert.match(migration, /library_sort_size_bytes/i, 'file-size sorting must use an asset-row projection, not correlated file aggregates')
assert.match(migration, /library_search_text/i, 'search must use a maintained asset-row projection')
assert.match(migration, /refresh_content_asset_library_projection/i, 'file, metadata, and tag writes must refresh the asset projection')
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.refresh_content_asset_library_projection\(\s*p_asset_id UUID[\s\S]*?SECURITY INVOKER/i, 'the projection helper remains service-role-only and does not broaden direct caller privileges')
for (const triggerFunction of [
  'refresh_content_asset_library_projection_from_asset',
  'refresh_content_asset_library_projection_from_file',
  'refresh_content_asset_library_projection_from_event',
  'refresh_content_asset_library_projection_from_tag_link',
  'refresh_content_asset_library_projection_from_tag',
]) {
  assert.match(
    migration,
    new RegExp(`CREATE OR REPLACE FUNCTION showroom\\.${triggerFunction}\\(\\)[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`, 'i'),
    `${triggerFunction} must recompute protected projections with the function owner when an authorized authenticated write fires its trigger`,
  )
}
assert.match(migration, /gin_trgm_ops/i, 'the search projection must receive a trigram index when the extension is available')
assert.match(migration, /ORDER BY[\s\S]*asset_id/i, 'every sort must include a deterministic asset-id tie breaker')
assert.match(migration, /LIMIT[\s\S]*OFFSET/i, 'the database must return bounded pages')
assert.match(migration, /content_assets_library_active_created_desc_idx[\s\S]*WHERE library_state <>/i, 'the active view must have a direct deterministic-order index')
assert.match(migration, /content_asset_tag_links_tag_asset_idx/i, 'tag filters must avoid scanning links by asset-first primary key')
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.archive_content_asset_search_results_safely/i)
assert.match(migration, /p_expected_count/i, 'full-result destructive actions must compare the confirmed target count')
assert.match(migration, /p_expected_token/i, 'full-result destructive actions must compare the confirmed result-set token')
assert.match(migration, /prepare_content_asset_search_results_selection/i, 'full-result membership tokens must be prepared only for explicit all-results selection')
assert.doesNotMatch(migration, /'selectionToken'\s*,\s*md5\(COALESCE\([\s\S]*list_content_assets_admin/s, 'ordinary list requests must not aggregate every matching id into a selection token')
assert.match(migration, /v_current_token\s*(?:IS DISTINCT FROM|<>).*p_expected_token/i, 'destructive RPC must reject same-count result-set replacements')
assert.match(migration, /archive_content_assets_safely/i, 'full-result archive must reuse the reference-locking RPC')
assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/i)
assert.match(migration, /FROM matching[\s\S]*categories[\s\S]*productTypes[\s\S]*spaceTypes[\s\S]*regions[\s\S]*usagePurposes/s, 'facet values must be derived from the current server matching set')

console.log('content asset library server-query contract passed')
