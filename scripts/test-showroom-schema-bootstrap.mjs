import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDirectory = path.join(projectRoot, 'supabase', 'migrations')
const migrationName = '20260720074000_showroom_schema_bootstrap.sql'
const firstDependentMigration = '20260720074812_atomic_node_reorder.sql'
const searchViewMigrationName = '20260721044937_restore_search_index_view.sql'
const searchViewHardeningMigrationName = '20260721044938_secure_search_index_view.sql'
const migrationNames = (await readdir(migrationsDirectory)).sort()

assert.ok(
  migrationNames.includes(migrationName),
  `missing showroom bootstrap migration ${migrationName}`,
)
assert.ok(
  migrationNames.indexOf(migrationName) < migrationNames.indexOf(firstDependentMigration),
  'showroom bootstrap migration must precede its first dependent migration',
)

const bootstrap = await readFile(path.join(migrationsDirectory, migrationName), 'utf8')
const databaseTypes = await readFile(path.join(projectRoot, 'src', 'types', 'database.ts'), 'utf8')

const recoveredTables = [
  'site_settings',
  'nodes',
  'hero_media',
  'site_hero_media',
  'gallery_photos',
  'preview_tokens',
]

function columnsInTypeRow(table) {
  const rowDefinition = databaseTypes.match(
    new RegExp(`^ {6}${table}: \\{\\r?\\n {8}Row: \\{([\\s\\S]*?)^ {8}\\}`, 'm'),
  )?.[1]
  assert.ok(rowDefinition, `src/types/database.ts must define showroom.${table}.Row`)

  return rowDefinition
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^([a-z_][a-z0-9_]*):\s/i)?.[1])
    .filter(Boolean)
}

function columnsInCreateTable(table) {
  const tableDefinition = bootstrap.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS showroom\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'),
  )?.[1]
  assert.ok(tableDefinition, `bootstrap must define showroom.${table}`)

  return tableDefinition
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('CONSTRAINT '))
    .map((line) => line.match(/^([a-z_][a-z0-9_]*)\s/i)?.[1])
    .filter(Boolean)
}

for (const table of recoveredTables) {
  const expectedColumns = columnsInTypeRow(table)
  assert.match(
    bootstrap,
    new RegExp(`CREATE TABLE IF NOT EXISTS showroom\\.${table}\\s*\\(`, 'i'),
    `bootstrap must create showroom.${table} idempotently`,
  )
  assert.match(
    bootstrap,
    new RegExp(`ALTER TABLE showroom\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'),
    `bootstrap must enable RLS on showroom.${table}`,
  )
  assert.deepEqual(
    columnsInCreateTable(table),
    expectedColumns,
    `showroom.${table} columns must exactly match src/types/database.ts Row`,
  )
}

assert.match(
  bootstrap,
  /CREATE OR REPLACE FUNCTION private\.is_node_visible\(target_node_id UUID\)/i,
  'bootstrap must restore the visibility helper required by later RLS migrations',
)
assert.match(
  bootstrap,
  /CREATE POLICY anon_read_visible_nodes[\s\S]*?private\.is_node_visible\(id\)/i,
  'bootstrap must restore the known public node visibility policy',
)
assert.match(
  bootstrap,
  /CREATE INDEX IF NOT EXISTS idx_showroom_preview_tokens_node_id/i,
  'bootstrap must restore the known preview-token lookup index',
)

assert.ok(
  migrationNames.includes(searchViewMigrationName),
  `missing search-index compatibility migration ${searchViewMigrationName}`,
)
assert.ok(
  migrationNames.indexOf(searchViewMigrationName) < migrationNames.indexOf(searchViewHardeningMigrationName),
  'search-index compatibility migration must precede its hardening migration',
)

const searchViewRecovery = await readFile(path.join(migrationsDirectory, searchViewMigrationName), 'utf8')
assert.match(
  searchViewRecovery,
  /to_regclass\('public\.vw_search_index'\)\s+IS NULL/i,
  'search-index recovery must preserve an existing Production view',
)
assert.match(
  searchViewRecovery,
  /CREATE VIEW public\.vw_search_index/i,
  'search-index recovery must create a compatibility view for an empty database',
)

console.log('Showroom schema bootstrap contracts passed')
