import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const queue = await readFile(new URL('../src/app/admin/platform/AdminQueueClient.tsx', import.meta.url), 'utf8')
const actions = await readFile(new URL('../src/app/admin/platform/UnifiedQueueActions.tsx', import.meta.url), 'utf8')
const legacyActions = await readFile(new URL('../src/app/admin/platform/AdminQueueActions.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/app/admin/platform/platform-admin.module.css', import.meta.url), 'utf8')
const fixture = await readFile(new URL('../src/app/test-fixtures/admin-queue/page.tsx', import.meta.url), 'utf8')

for (const primitive of [
  'PlatformButton',
  'PlatformLinkButton',
  'PlatformPageHeader',
  'PlatformPanel',
  'PlatformSegmentedControl',
  'PlatformStatePanel',
  'PlatformStatusBadge',
]) {
  assert.match(queue, new RegExp(`\\b${primitive}\\b`), `${primitive} must be used in the queue route`)
}

assert.match(queue, /aria-pressed=\{row\.key === selectedKey\}/, 'queue selection controls must expose selection state')
assert.match(queue, /autoFocus/, 'mobile queue detail must receive focus when the list is hidden')
assert.match(queue, /requestAnimationFrame\(\(\) => returnTarget\?\.focus\(\)\)/, 'mobile queue close must restore trigger focus')
assert.match(queue, /data-queue-summary/, 'queue completion must have a stable focus target')
assert.match(queue, /data-queue-status/, 'queue completion must announce its result')
assert.match(queue, /event\.target.*closest\('button'\)/s, 'desktop queue rows must preserve pointer selection outside controls')
assert.match(queue, /aria-sort=/, 'sortable table headers must expose sort direction')
assert.doesNotMatch(actions, /\balert\(/, 'queue mutations must use inline feedback instead of alert')
assert.match(actions, /role="alert"/, 'queue mutation errors must be announced')
assert.match(actions, /PlatformButton/, 'queue mutation must use the shared button contract')
assert.doesNotMatch(legacyActions, /\balert\(/, 'legacy queue mutations must use inline feedback instead of alert')
assert.match(legacyActions, /PlatformButton/, 'legacy queue mutations must use the shared button contract')
assert.doesNotMatch(styles, /#[\da-f]{3,8}\b|rgba?\(/i, 'queue route styles must not contain raw colors')
assert.match(fixture, /process\.env\.NODE_ENV === 'production'/, 'queue fixture must be disabled in production')
assert.match(fixture, /notFound\(\)/, 'queue fixture must return a production 404')

console.log('admin queue primitive contract passed')
