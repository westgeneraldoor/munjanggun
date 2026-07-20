import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const [barrel, checkbox, checkboxCss, chip, chipCss, statusBadge, editor, editorCss, fixture, tokenPolicy, publicSafety] = await Promise.all([
  source('src/components/platform/ui/index.ts'),
  source('src/components/platform/ui/PlatformCheckbox.tsx'),
  source('src/components/platform/ui/PlatformCheckbox.module.css'),
  source('src/components/platform/ui/PlatformChip.tsx'),
  source('src/components/platform/ui/PlatformChip.module.css'),
  source('src/components/platform/ui/PlatformStatusBadge.tsx'),
  source('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx'),
  source('src/app/admin/platform/blog/[id]/blog-editor.module.css'),
  source('src/app/test-fixtures/admin-choice/page.tsx'),
  source('scripts/ui-token-policy.config.mjs'),
  source('scripts/verify-blog-public-safety.mjs'),
])

for (const primitive of ['PlatformCheckbox', 'PlatformChip']) {
  assert.match(barrel, new RegExp(`export \\{ ${primitive} \\}`), `${primitive} must be exported from the shared UI barrel`)
  assert.match(editor, new RegExp(`\\b${primitive}\\b`), `blog editor must use ${primitive}`)
}

assert.match(checkbox, /React\.forwardRef<HTMLInputElement/)
assert.match(checkbox, /type=["']checkbox["']/)
assert.match(checkbox, /<input[\s\S]*?\{\.\.\.props\}/)
assert.doesNotMatch(checkbox, /role=["']checkbox["']/)
assert.match(checkboxCss, /\.control:focus-visible/)
assert.match(checkboxCss, /\.control:disabled/)
assert.match(fixture, /disabled/)
assert.match(chip, /<span/)
assert.match(chip, /data-platform-chip/)
assert.doesNotMatch(chip, /role=["']status["']/)
assert.match(chip, /'neutral' \| 'accent' \| 'selected'/)
assert.doesNotMatch(chip, /'success'|'warning'|'danger'|'info'/)
assert.doesNotMatch(chipCss, /\.(?:success|warning|danger|info)\b/)
assert.doesNotMatch(statusBadge, /role=["']status["']/)

assert.equal((editor.match(/<PlatformCheckbox\b/g) ?? []).length, 2)
assert.match(editor, /name=["']privacyChecked["']/)
assert.match(editor, /name=["']promotionConsentChecked["']/)
assert.doesNotMatch(editor, /type=["']checkbox["']/)
assert.match(editor, /<PlatformChip\b/)
assert.match(editor, /<PlatformChip tone=["']accent["']/)
assert.match(editor, /<PlatformStatusBadge\b/)
assert.match(editor, /getPostStatusTone/)
assert.match(editor, /getQuestionStatusTone/)
assert.doesNotMatch(editor, /styles\.(?:assetPickerCheck|blockType|statusBadge|questionStatus)\b/)
assert.doesNotMatch(editorCss, /\.(?:assetPickerCheck|blockType|statusBadge|status_[a-z_]+|questionStatus(?:_[a-z_]+)?)\b/)
assert.doesNotMatch(editorCss, /\.assetUploadReview\s+(?:label|input)\b/)

for (const cssFile of ['PlatformCheckbox.module.css', 'PlatformChip.module.css']) {
  assert.match(tokenPolicy, new RegExp(cssFile.replace('.', '\\.')), `${cssFile} must be governed by the raw-token policy`)
}

for (const fieldName of ['privacyChecked', 'promotionConsentChecked']) {
  assert.match(publicSafety, new RegExp(`name=["']${fieldName}["']`), `${fieldName} public safety contract must remain enforced`)
}

console.log('blog editor choice primitive contract passed')
