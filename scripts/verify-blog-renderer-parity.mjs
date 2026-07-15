import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

async function readWorkspaceFile(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8')
}

const renderer = await readWorkspaceFile('src/components/blog/BlogPostRenderer.tsx')
const editor = await readWorkspaceFile('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx')
const previewData = await readWorkspaceFile('src/lib/content-os/blog-editor-preview.ts')
const editorPage = await readWorkspaceFile('src/app/admin/platform/blog/[id]/page.tsx')
const previewRenderer = await readWorkspaceFile('src/lib/content-os/blog-rendering.ts')
const privateMediaRoute = await readWorkspaceFile('src/app/admin/platform/blog/media/[mediaId]/route.ts')
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
assert.match(renderer, /function LinkButtonBlock\(\{ block, preview = false \}/, 'link-button blocks must receive the renderer mode')
assert.match(renderer, /<LinkButtonBlock block=\{block\} preview=\{mode === 'preview'\}/, 'editor preview must render link-button blocks without navigation')
assert.match(renderer, /preview \? \([\s\S]*?previewLinkAction[\s\S]*?\) : \([\s\S]*?<Link href=\{link\.href\}>/, 'preview link-button action must be inert while public mode keeps the real link')
assert.match(previewData, /export function toBlogEditorPreviewData\b/, 'unsaved editor state needs an explicit presentation adapter')
assert.doesNotMatch(previewData, /private_object_path|privateObjectPath/, 'browser preview data must not include private storage paths')
assert.match(editorPage, /signedPreviewUrl: item\.private_bucket && item\.private_object_path \? `\/admin\/platform\/blog\/media\/\$\{item\.id\}` : null/, 'editor must use an opaque admin media URL for private previews')
assert.match(previewRenderer, /\? `\/admin\/platform\/blog\/media\/\$\{media\.id\}`/, 'saved admin preview must use the same opaque media URL')
assert.doesNotMatch(editorPage, /createSignedUrl/, 'editor page must not pass signed storage URLs to the browser')
assert.match(privateMediaRoute, /platform\.auth\.getUser\(\)/, 'private media route must require an authenticated user')
assert.match(privateMediaRoute, /profile\?\.role !== 'administrator'/, 'private media route must require the administrator role')
for (const source of homeCtaFiles) {
  assert.match(source, /['"]\/measure['"]/, 'generic blog home CTA must use the public /measure landing')
  assert.doesNotMatch(source, /['"]\/portal\/measure\/new['"]/, 'generic blog home CTA must not bypass the public consultation landing')
}

console.log('blog renderer parity verification passed')
