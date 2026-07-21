import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [migration, page, databaseTypes] = await Promise.all([
  readFile(new URL('../supabase/migrations/20260720075020_harden_showroom_preview_payload.sql', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/preview/[token]/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/types/database.ts', import.meta.url), 'utf8'),
])

assert.match(migration, /FUNCTION showroom\.get_preview_payload\(p_token TEXT\)[\s\S]*?RETURNS JSONB/i)
assert.match(migration, /SECURITY DEFINER[\s\S]*?SET search_path = ''/i)
assert.match(migration, /length\(p_token\) <> 36[\s\S]*?p_token !~\*/i)
assert.match(migration, /preview\.token = p_token/i)
assert.match(migration, /v_expires_at <= clock_timestamp\(\)/i)
assert.doesNotMatch(migration, /to_jsonb\s*\(/i, 'preview payload fields must not expand when table columns are added')
for (const field of ['expired', 'node', 'heroMedia', 'childNodes', 'galleryPhotos']) {
  assert.ok(migration.includes(`'${field}'`), `preview payload must explicitly include ${field}`)
}
assert.match(migration, /DROP POLICY IF EXISTS anon_read_preview_tokens/i)
assert.match(migration, /REVOKE ALL ON showroom\.preview_tokens FROM anon/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.get_preview_payload\(TEXT\) FROM PUBLIC/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.get_preview_payload\(TEXT\) FROM authenticated/i)
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.get_preview_payload\(TEXT\) FROM service_role/i)
assert.match(migration, /GRANT EXECUTE ON FUNCTION showroom\.get_preview_payload\(TEXT\) TO anon/i)

assert.match(page, /createPublicShowroomClient\(\)/)
assert.match(page, /previewClient\.rpc\('get_preview_payload', \{ p_token: token \}\)/)
assert.doesNotMatch(page, /\.from\('preview_tokens'\)/)
assert.doesNotMatch(page, /\.from\('(nodes|hero_media|gallery_photos)'\)/)
assert.match(databaseTypes, /get_preview_payload:[\s\S]*?p_token: string[\s\S]*?Returns: Json/)

console.log('showroom preview payload contract passed')
