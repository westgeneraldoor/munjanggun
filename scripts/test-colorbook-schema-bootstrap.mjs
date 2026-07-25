import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDirectory = path.join(projectRoot, 'supabase', 'migrations')
const migrationName = '20260602073000_colorbook_schema_bootstrap.sql'
const postgrestSchemaMigration = '20260602073953_include_platform_in_postgrest_schemas.sql'
const migrationNames = (await readdir(migrationsDirectory)).sort()

assert.ok(migrationNames.includes(migrationName), `missing colorbook bootstrap migration ${migrationName}`)
assert.ok(
  migrationNames.indexOf(migrationName) < migrationNames.indexOf(postgrestSchemaMigration),
  'colorbook bootstrap must precede the migration that configures it for PostgREST',
)

const migration = await readFile(path.join(migrationsDirectory, migrationName), 'utf8')
assert.match(
  migration,
  /CREATE SCHEMA IF NOT EXISTS colorbook/i,
  'colorbook bootstrap must create the required PostgREST schema idempotently',
)

console.log('Colorbook schema bootstrap contract passed')
