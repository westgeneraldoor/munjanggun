import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').catch(() => '')

const [nodeList, nodeListStyles, tokenPolicy, fixture, migration] = await Promise.all([
  read('src/components/admin/NodeList.tsx'),
  read('src/components/admin/NodeList.module.css'),
  read('scripts/ui-token-policy.config.mjs'),
  read('src/app/test-fixtures/admin-node-list/page.tsx'),
  read('supabase/migrations/20260720074812_atomic_node_reorder.sql'),
])

for (const primitive of [
  'PlatformButton',
  'PlatformIconButton',
  'PlatformLinkButton',
  'PlatformPageHeader',
  'PlatformStatePanel',
]) {
  assert.match(nodeList, new RegExp(`\\b${primitive}\\b`), `NodeList must use ${primitive}`)
}

assert.match(nodeList, /\bloadError\b/, 'node loading failures must have an explicit state')
assert.match(nodeList, /다시 시도/, 'node loading failures must offer retry')
assert.match(nodeList, /requestId !== fetchRequestRef\.current/, 'stale node requests must not replace the current list')
assert.match(nodeList, /\bisSessionRestored\b/, 'session navigation must restore after the hydration-safe first render')
assert.match(nodeList, /reorderClient\.rpc\('reorder_nodes'/, 'node order must use the atomic RPC boundary without losing the client binding')
assert.match(nodeList, /disabled=\{isReordering \|\| breadcrumb\.length === 0\}/, 'reorder must lock parent navigation until the atomic write finishes')
assert.match(nodeList, /previousDisplayOrder/, 'reorder rollback must preserve concurrent non-order fields')
assert.match(nodeList, /\bconst isListMutationBusy = isReordering \|\| statusUpdatingId !== null \|\| isDeleting\b/, 'list mutations must be serialized while reorder is pending')
assert.doesNotMatch(nodeList, /alert\(/, 'node-list mutations must use shared inline state instead of blocking alerts')
assert.doesNotMatch(nodeList, /<button\b/, 'NodeList controls must use shared button primitives')
assert.doesNotMatch(nodeList, /<Link\b/, 'NodeList links must use the shared link button primitive')
assert.doesNotMatch(nodeList, /style=\{\{/, 'NodeList layout must not bypass scoped token styles')
const governedStyles = nodeListStyles.replace(/@media\s*\(max-width:\s*639px\)/, '@media (max-width: named-breakpoint)')
assert.doesNotMatch(governedStyles, /#[\da-f]{3,8}\b|rgba?\(|(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/i, 'NodeList styles must use canonical tokens except the named breakpoint')
assert.ok(tokenPolicy.includes('src/components/admin/NodeList.module.css'), 'NodeList styles must be governed by the UI token policy')
assert.match(fixture, /process\.env\.NODE_ENV === 'production'/, 'the node-list fixture must be disabled in production')
assert.match(fixture, /notFound\(\)/, 'the node-list fixture must return a production 404')
assert.match(migration, /SECURITY INVOKER/i, 'node reorder must preserve caller permissions and RLS')
assert.match(migration, /FOR UPDATE/i, 'node reorder must lock the complete sibling set')
assert.match(migration, /current_node_ids IS DISTINCT FROM requested_node_ids/i, 'node reorder must reject partial or foreign node sets')
assert.match(migration, /updated_count <> cardinality\(p_ordered_node_ids\)/i, 'node reorder must verify the affected row count')
assert.match(migration, /FROM platform\.profiles[\s\S]*?profile\.id = auth\.uid\(\)[\s\S]*?administrator/i, 'node reorder must reject non-administrator callers before mutation')
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.reorder_nodes\(UUID, UUID\[\]\) FROM PUBLIC/i, 'node reorder must not retain public execute privileges')
assert.match(migration, /REVOKE ALL ON FUNCTION showroom\.reorder_nodes\(UUID, UUID\[\]\) FROM service_role/i, 'service-role callers must not bypass the administrator actor contract')
assert.match(migration, /GRANT EXECUTE ON FUNCTION showroom\.reorder_nodes\(UUID, UUID\[\]\) TO authenticated/i, 'authenticated admin callers must receive explicit execute access')

console.log('admin node-list primitive contract passed')
