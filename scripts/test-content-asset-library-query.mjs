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
assert.match(migration, /content_asset_files/i, 'file-size sorting must be computed from the complete file dataset')
assert.match(migration, /file_role\s*=\s*'original'/i, 'file-size sorting must prefer the original uploaded file size')
assert.match(migration, /metadata\s*->>\s*'file_name'/i, 'file-name sorting and search must use the preserved original upload name')
assert.match(migration, /content_asset_tag_links/i, 'tag search and filtering must run in the database')
assert.match(migration, /ORDER BY[\s\S]*asset_id/i, 'every sort must include a deterministic asset-id tie breaker')
assert.match(migration, /LIMIT[\s\S]*OFFSET/i, 'the database must return bounded pages')
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.archive_content_asset_search_results_safely/i)
assert.match(migration, /p_expected_count/i, 'full-result destructive actions must compare the confirmed target count')
assert.match(migration, /p_expected_token/i, 'full-result destructive actions must compare the confirmed result-set token')
assert.match(migration, /'selectionToken'/i, 'list RPC must return a deterministic token for the complete matching result set')
assert.match(migration, /v_current_token\s*(?:IS DISTINCT FROM|<>).*p_expected_token/i, 'destructive RPC must reject same-count result-set replacements')
assert.match(migration, /archive_content_assets_safely/i, 'full-result archive must reuse the reference-locking RPC')
assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/i)

console.log('content asset library server-query contract passed')
