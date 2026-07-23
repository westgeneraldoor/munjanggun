import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const migration = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260723070034_preserve_content_asset_trash_state_v2.sql'),
  'utf8',
)

assert.match(migration, /ADD COLUMN IF NOT EXISTS library_state_before_archive/i)
assert.match(migration, /ADD COLUMN IF NOT EXISTS trashed_at/i)
assert.match(migration, /CREATE OR REPLACE FUNCTION showroom\.archive_content_assets_safely/i)
assert.match(migration, /library_state_before_archive = v_current_state/i)
assert.match(migration, /library_state = COALESCE\(\s*v_previous_state/i)
assert.match(migration, /v_previous_state,[\s\S]*'hidden'::showroom\.content_asset_library_state/i)
assert.match(migration, /library_state_before_archive = NULL/i)
assert.match(migration, /trashed_at = NULL/i)
assert.match(migration, /FROM showroom\.blog_media[\s\S]*?FOR UPDATE/i)
assert.match(migration, /FROM showroom\.content_asset_usages[\s\S]*?FOR UPDATE/i)
assert.match(migration, /DROP POLICY IF EXISTS content_assets_admin_delete/i)
assert.match(migration, /REVOKE DELETE ON showroom\.content_assets FROM authenticated/i)
assert.match(migration, /REVOKE UPDATE ON showroom\.content_assets FROM authenticated/i)
assert.doesNotMatch(
  migration.match(/GRANT UPDATE \([\s\S]*?\) ON showroom\.content_assets TO authenticated/i)?.[0] ?? '',
  /\blibrary_state\b|\btrashed_at\b|\bused_count\b/i,
  'authenticated column updates must not bypass the asset trash RPC',
)
assert.match(
  migration,
  /REVOKE ALL ON FUNCTION showroom\.archive_content_assets_safely[\s\S]*?FROM PUBLIC, anon, authenticated/i,
)

console.log('content asset trash state and direct-delete boundary contracts passed')
