import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260723060411_allow_hidden_content_asset_draft_references.sql', import.meta.url),
  'utf8',
)

for (const functionName of [
  'reject_archived_content_asset_reference',
  'reject_archived_content_asset_usage',
]) {
  assert.match(
    migration,
    new RegExp(`CREATE OR REPLACE FUNCTION showroom\\.${functionName}\\(\\)[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`, 'i'),
    `${functionName} must retain its hardened execution boundary`,
  )
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON FUNCTION showroom\\.${functionName}\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated`, 'i'),
    `${functionName} must not become directly executable by clients`,
  )
  assert.match(
    migration,
    new RegExp(`CREATE OR REPLACE FUNCTION showroom\\.${functionName}\\(\\)[\\s\\S]*?FOR KEY SHARE`, 'i'),
    `${functionName} must serialize references against concurrent archive`,
  )
}

assert.match(
  migration,
  /asset\.library_state IN\s*\(\s*'available'::showroom\.content_asset_library_state,\s*'hidden'::showroom\.content_asset_library_state\s*\)/i,
  'private hidden draft assets must remain referenceable',
)
assert.equal(
  migration.match(/asset\.library_state IN\s*\(\s*'available'::showroom\.content_asset_library_state,\s*'hidden'::showroom\.content_asset_library_state\s*\)/gi)?.length,
  2,
  'both blog_media and usage-ledger boundaries must allow private hidden drafts',
)
assert.doesNotMatch(
  migration,
  /'archived'::showroom\.content_asset_library_state[\s\S]{0,120}IN\s*\(/i,
  'archived assets must not be admitted by the allowlist',
)
assert.match(
  migration,
  /RAISE EXCEPTION 'archived content assets cannot be referenced'/i,
  'archived writes must remain fail-closed',
)
assert.doesNotMatch(
  migration,
  /\b(CREATE|ALTER|DROP)\s+POLICY\b/i,
  'this draft-write repair must not widen public read policies',
)

console.log('Hidden draft content-asset reference contract passed.')
