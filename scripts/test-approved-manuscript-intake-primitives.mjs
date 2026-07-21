import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const [barrel, editorSection, toolbar, intake] = await Promise.all([
  source('src/components/platform/ui/index.ts'),
  source('src/components/platform/ui/PlatformEditorSection.tsx'),
  source('src/components/platform/ui/PlatformToolbar.tsx'),
  source('src/app/admin/platform/blog/new/ApprovedManuscriptIntakeClient.tsx'),
])

for (const primitive of ['PlatformEditorSection', 'PlatformToolbar']) {
  assert.match(barrel, new RegExp(`export \\{ ${primitive} \\}`), `${primitive} must be exported from the shared UI barrel`)
}

assert.match(editorSection, /<fieldset/)
assert.match(editorSection, /<legend/)
assert.match(editorSection, /disabled=\{disabled\}/)
assert.match(editorSection, /const describedBy = \[callerDescribedBy, descriptionId\]/)
assert.match(editorSection, /aria-describedby=\{describedBy\}/)

assert.match(toolbar, /role=["']toolbar["']/)
assert.match(toolbar, /aria-label=\{label\}/)
for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
  assert.match(toolbar, new RegExp(`["']${key}["']`), `toolbar must handle ${key}`)
}
assert.match(toolbar, /event\.preventDefault\(\)/)
assert.match(toolbar, /item\.tabIndex = item === activeItem \? 0 : -1/)
assert.match(toolbar, /onFocusCapture=\{handleFocusCapture\}/)
assert.match(toolbar, /focusWithinRef/)
assert.match(toolbar, /event\.key === ['"]Tab['"]/)
assert.match(toolbar, /activeItem\.focus\(\)/)

for (const primitive of [
  'PlatformButton',
  'PlatformEditorSection',
  'PlatformField',
  'PlatformIconButton',
  'PlatformLinkButton',
  'PlatformSelect',
  'PlatformToolbar',
]) {
  assert.match(intake, new RegExp(`\\b${primitive}\\b`), `approved manuscript intake must use ${primitive}`)
}

assert.doesNotMatch(intake, /<(?:button|input|select|textarea)\b/, 'approved manuscript intake must not own native control styling')
assert.equal((intake.match(/<PlatformEditorSection\b/g) ?? []).length, 3)
assert.equal((intake.match(/disabled=\{isPending\}/g) ?? []).length, 4, 'three sections and submit button must preserve the pending lock')
assert.match(intake, /pattern=["']\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*["']/)
assert.match(intake, /rows=\{block\.type === ["']paragraph["'] \? 5 : 3\}/)
assert.match(intake, /aria-label=\{`\$\{index \+ 1\}번 블록 위로 이동`\}/)
assert.match(intake, /aria-label=\{`\$\{index \+ 1\}번 블록 아래로 이동`\}/)
assert.match(intake, /aria-label=\{`\$\{index \+ 1\}번 블록 삭제`\}/)

console.log('approved manuscript intake primitive contract passed')
