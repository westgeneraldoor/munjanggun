import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const [barrel, tabs, tabPanel, previewFrame, editor, editorCss, tokenPolicy] = await Promise.all([
  source('src/components/platform/ui/index.ts'),
  source('src/components/platform/ui/PlatformTabs.tsx'),
  source('src/components/platform/ui/PlatformTabPanel.tsx'),
  source('src/components/platform/ui/PlatformPreviewFrame.tsx'),
  source('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx'),
  source('src/app/admin/platform/blog/[id]/blog-editor.module.css'),
  source('scripts/ui-token-policy.config.mjs'),
])

for (const primitive of ['PlatformTabs', 'PlatformTabPanel', 'PlatformPreviewFrame']) {
  assert.match(barrel, new RegExp(`export \\{ ${primitive} \\}`), `${primitive} must be exported from the shared UI barrel`)
  assert.match(editor, new RegExp(`\\b${primitive}\\b`), `blog editor must use ${primitive}`)
}

assert.match(tabs, /role=["']tablist["']/)
assert.match(tabs, /role=["']tab["']/)
assert.match(tabs, /aria-selected=\{selected\}/)
assert.match(tabs, /aria-controls=\{`\$\{id\}-panel-\$\{item\.value\}`\}/)
assert.match(tabs, /const focusValue =/)
assert.match(tabs, /tabIndex=\{item\.value === focusValue \? 0 : -1\}/)
for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
  assert.match(tabs, new RegExp(`["']${key}["']`), `tabs must handle ${key}`)
}

assert.match(tabPanel, /role=["']tabpanel["']/)
assert.match(tabPanel, /hidden=\{!active\}/)
assert.match(tabPanel, /aria-labelledby=\{`\$\{tabsId\}-tab-\$\{value\}`\}/)
assert.match(previewFrame, /data-platform-preview-frame/)
assert.match(previewFrame, /data-platform-preview-viewport/)

assert.doesNotMatch(editor, /aria-pressed=\{editorMode ===/)
assert.doesNotMatch(editor, /styles\.editorModeActive/)
assert.match(editor, /id=["']blog-editor-mode["']/)
assert.match(editor, /surface=["']embedded-preview["']/)
assert.match(editor, /<PlatformPreviewFrame[\s\S]*?<BlogPostRenderer/)
assert.match(editor, /<PlatformPreviewFrame[\s\S]*?className=\{styles\.mobilePreviewFrame\}/)
assert.doesNotMatch(editorCss, /\.(?:editorModeActive|mobilePreviewShell|mobilePreviewChrome|mobilePreviewArticle)\b/)
assert.match(editorCss, /\.editorModeTabs\s*\{\s*border-radius: var\(--radius-lg\)/)
assert.match(editorCss, /\.editorModeTabs > :global\(button\[role='tab'\]\)\s*\{\s*border-radius: var\(--radius-md\)/)

for (const cssFile of ['PlatformTabs.module.css', 'PlatformPreviewFrame.module.css']) {
  assert.match(tokenPolicy, new RegExp(cssFile.replace('.', '\\.')), `${cssFile} must be governed by the raw-token policy`)
}

console.log('blog editor frame primitive contract passed')
