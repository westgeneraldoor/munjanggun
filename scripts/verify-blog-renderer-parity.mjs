import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8')
}

const renderer = await readWorkspaceFile('src/components/blog/BlogPostRenderer.tsx')
const editor = await readWorkspaceFile('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx')
const previewData = await readWorkspaceFile('src/lib/content-os/blog-editor-preview.ts')
const homeCtaFiles = await Promise.all([
  'src/app/blog/BlogHomeHero.tsx',
  'src/app/blog/BlogStoryStage.tsx',
  'src/app/blog/BlogFinalExperience.tsx',
].map(readWorkspaceFile))

assert.match(renderer, /data-mg-theme="blog"\s+data-mg-blog-experience="showroom"/, 'public article root must opt into the v5 showroom token scope')
assert.match(renderer, /href="\/measure"/, 'generic article consultation CTA must use the public /measure landing')
assert.match(editor, /import BlogPostRenderer from '@\/components\/blog\/BlogPostRenderer'/, 'live editor preview must reuse the public article renderer')
assert.doesNotMatch(editor, /<EditorMobilePreview\b/, 'live editor preview must not use a second hard-coded article renderer')
assert.match(editor, /<BlogPostRenderer\s+data=\{previewData\}\s+mode="preview"/, 'live editor preview must render the shared renderer in preview mode')
assert.match(previewData, /export function toBlogEditorPreviewData\b/, 'unsaved editor state needs an explicit presentation adapter')
assert.doesNotMatch(previewData, /private_object_path|privateObjectPath/, 'browser preview data must not include private storage paths')
for (const source of homeCtaFiles) {
  assert.match(source, /['"]\/measure['"]/, 'generic blog home CTA must use the public /measure landing')
  assert.doesNotMatch(source, /['"]\/portal\/measure\/new['"]/, 'generic blog home CTA must not bypass the public consultation landing')
}

console.log('blog renderer parity verification passed')
