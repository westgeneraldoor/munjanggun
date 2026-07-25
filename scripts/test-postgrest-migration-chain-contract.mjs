import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workflow = await readFile(path.join(projectRoot, '.github', 'workflows', 'ci.yml'), 'utf8')

const migrationChainJob = workflow.match(/  migration-chain:[\s\S]*?(?=\n  [a-z-]+:|$)/)?.[0]
assert.ok(migrationChainJob, 'CI must define the migration-chain job')
assert.doesNotMatch(
  migrationChainJob,
  /(?:--exclude|-x)[^\n]*\bpostgrest\b/i,
  'migration-chain must start PostgREST instead of excluding it',
)
assert.doesNotMatch(
  migrationChainJob,
  /(?:--exclude|-x)[^\n]*\bkong\b/i,
  'migration-chain must start the API gateway for the REST verification',
)
assert.doesNotMatch(
  migrationChainJob,
  /(?:--exclude|-x)[^\n]*\bgotrue\b/i,
  'migration-chain must start Auth so the local anonymous API key is available',
)
assert.match(
  migrationChainJob,
  /node scripts\/verify-postgrest-migration-chain\.mjs/,
  'migration-chain must verify a real PostgREST REST request',
)
assert.match(
  migrationChainJob,
  /docker logs --tail 250/,
  'migration-chain must emit PostgREST logs when the verification fails',
)
assert.match(
  migrationChainJob,
  /grep -q "Schema cache loaded"/,
  'migration-chain must assert that PostgREST loaded its schema cache',
)

console.log('PostgREST migration-chain CI contract passed')
