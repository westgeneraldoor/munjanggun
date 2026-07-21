import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').catch(() => '')

const [
  modal,
  modalStyles,
  uiIndex,
  confirm,
  nodeAdd,
  nodeAddStyles,
  nodeMove,
  nodeMoveStyles,
  tokenPolicy,
  fixture,
] = await Promise.all([
  read('src/components/platform/ui/PlatformModal.tsx'),
  read('src/components/platform/ui/PlatformModal.module.css'),
  read('src/components/platform/ui/index.ts'),
  read('src/components/admin/ConfirmModal.tsx'),
  read('src/components/admin/NodeAddModal.tsx'),
  read('src/components/admin/NodeAddModal.module.css'),
  read('src/components/admin/NodeMoveModal.tsx'),
  read('src/components/admin/NodeMoveModal.module.css'),
  read('scripts/ui-token-policy.config.mjs'),
  read('src/app/test-fixtures/admin-modal/page.tsx'),
])

assert.match(uiIndex, /export \{ PlatformModal \}/, 'the shared modal must be exported')
assert.match(modal, /role="dialog"/, 'the shared modal must expose a dialog role')
assert.match(modal, /aria-modal="true"/, 'the shared modal must be announced as modal')
assert.match(modal, /aria-labelledby=\{titleId\}/, 'the dialog title must label the modal')
assert.match(modal, /event\.key === 'Escape'/, 'Escape must close an enabled modal')
assert.match(modal, /event\.key !== 'Tab'/, 'Tab must remain trapped in the modal')
assert.match(modal, /previousActiveElement/, 'closing must restore focus to the opener')
assert.match(modal, /document\.body\.style\.overflow/, 'an open modal must lock background scroll')
assert.match(modalStyles, /prefers-reduced-motion:\s*reduce/, 'modal motion must respect reduced-motion')
assert.doesNotMatch(modalStyles, /#[\da-f]{3,8}\b|rgba?\(|(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/i, 'shared modal styles must use canonical tokens')

for (const [name, source] of [
  ['ConfirmModal', confirm],
  ['NodeAddModal', nodeAdd],
  ['NodeMoveModal', nodeMove],
]) {
  assert.match(source, /\bPlatformModal\b/, `${name} must use the shared modal shell`)
  assert.match(source, /\bPlatformButton\b/, `${name} must use shared action buttons`)
  assert.doesNotMatch(source, /styles\.(?:overlay|modal|cancelBtn|confirmBtn|submitBtn)/, `${name} must not retain a bespoke modal/action shell`)
}

assert.match(nodeAdd, /\bPlatformField\b/, 'node creation must use shared fields')
assert.match(nodeAdd, /\bPlatformSelect\b/, 'node creation must use the shared select')
assert.match(nodeAdd, /useState\(parentId === null \? 'listing' : 'detail'\)/, 'child node creation must preserve the detail default')
assert.match(modal, /\bPlatformIconButton\b/, 'the shared modal must use a shared close control')
assert.match(modal, /\[data-modal-initial-focus\]:not\(\[disabled\]\)/, 'disabled initial controls must not retain focus behind a modal')
assert.match(nodeMove, /\bloadError\b/, 'node move must expose candidate loading failures')
assert.match(nodeMove, /disabled=\{isLoading \|\| Boolean\(loadError\)/, 'node move must block mutations until candidate loading succeeds')
assert.doesNotMatch(nodeAdd, /<(?:button|input|select)\b/, 'node creation controls must use shared primitives')
assert.doesNotMatch(nodeMove, /style=\{\{/, 'node move layout must not bypass scoped token styles')

for (const [name, styles] of [
  ['NodeAddModal', nodeAddStyles],
  ['NodeMoveModal', nodeMoveStyles],
]) {
  assert.doesNotMatch(styles, /#[\da-f]{3,8}\b|rgba?\(|(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/i, `${name} styles must use canonical tokens`)
}

for (const governedFile of [
  'src/components/platform/ui/PlatformModal.module.css',
  'src/components/admin/NodeAddModal.module.css',
  'src/components/admin/NodeMoveModal.module.css',
]) {
  assert.ok(tokenPolicy.includes(governedFile), `${governedFile} must be governed by the UI token policy`)
}

assert.match(fixture, /process\.env\.NODE_ENV === 'production'/, 'the modal fixture must be disabled in production')
assert.match(fixture, /notFound\(\)/, 'the modal fixture must return a production 404')

console.log('admin modal primitive contract passed')
