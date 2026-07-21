import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migration = await readFile(
  new URL('../supabase/migrations/20260720075242_fix_detach_unused_official_asset_uuid_selection.sql', import.meta.url),
  'utf8',
)

assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.detach_unused_official_asset_from_reviewing_post/)
assert.match(migration, /SECURITY INVOKER/)
assert.match(migration, /SET search_path = ''/)
assert.match(migration, /post\.status = 'reviewing'/)
assert.match(migration, /post\.published_at IS NULL/)
assert.match(migration, /asset\.privacy_checked = TRUE/)
assert.match(migration, /asset\.promotion_consent_checked = FALSE/)
assert.match(migration, /media\.used_as_cover = TRUE/)
assert.match(migration, /FROM showroom\.blog_blocks[\s\S]*block\.media_id = v_media_id/)
assert.match(migration, /SELECT count\(\*\)[\s\S]*SELECT media\.id[\s\S]*INTO STRICT v_media_id/)
assert.doesNotMatch(migration, /min\(media\.id\)/)
assert.match(migration, /DELETE FROM showroom\.content_asset_usages/)
assert.match(migration, /SET post_id = NULL,[\s\S]*usage_status = 'rejected'/)
assert.match(migration, /official_asset_detached_from_reviewing_post/)
assert.match(migration, /official_asset_detached/)
assert.match(migration, /asset_record_preserved/)
assert.match(migration, /storage_files_preserved/)
assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM anon/)
assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM authenticated/)
assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/)
assert.doesNotMatch(migration, /DELETE FROM showroom\.content_assets/)
assert.doesNotMatch(migration, /DELETE FROM showroom\.content_asset_files/)
assert.doesNotMatch(migration, /storage\.objects/)

console.log('Official asset detach migration contract passed')
