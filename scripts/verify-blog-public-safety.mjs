import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rendering = await readFile(new URL('../src/lib/content-os/blog-rendering.ts', import.meta.url), 'utf8')
const sitemap = await readFile(new URL('../src/app/sitemap.ts', import.meta.url), 'utf8')
const robots = await readFile(new URL('../src/app/robots.ts', import.meta.url), 'utf8')
const editorActions = await readFile(new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url), 'utf8')

assert.ok(
  rendering.includes(".eq('status', 'published')"),
  'public blog queries must filter posts to published status',
)

assert.ok(
  rendering.includes(".eq('usage_status', 'published')"),
  'public blog queries must filter media to published usage_status',
)

const publicMediaSelect = rendering.match(/const PUBLIC_MEDIA_SELECT = \[([\s\S]*?)\]\.join/)?.[1] ?? ''
assert.ok(publicMediaSelect, 'public media projection should be declared')

assert.ok(
  !publicMediaSelect.includes('source_label'),
  'public media projection should not expose internal source labels',
)

assert.ok(
  sitemap.includes('getPublishedBlogPosts()'),
  'sitemap should derive blog URLs from published blog posts only',
)

for (const path of ['/admin/', '/api/', '/preview/', '/drafts/', '/private/']) {
  assert.ok(robots.includes(`'${path}'`), `robots must disallow ${path}`)
}

const attachContentAssetFunction = editorActions.match(/export async function attachContentAssetToBlogMedia[\s\S]*?\nexport async function updateBlogMedia/)?.[0] ?? ''
assert.ok(attachContentAssetFunction, 'attachContentAssetToBlogMedia should be inspected')

assert.ok(
  attachContentAssetFunction.includes("editablePost.post.status === 'published'"),
  'content asset attachment must reject published posts before media mutation',
)

assert.ok(
  !attachContentAssetFunction.includes('attachAsPublished'),
  'content asset attachment must not have a direct published attach path',
)

assert.ok(
  !attachContentAssetFunction.includes("usage_status: 'published'"),
  'content asset attachment must not mark media as published',
)

assert.ok(
  !attachContentAssetFunction.includes('published_at: now'),
  'content asset attachment must not stamp published_at',
)

console.log('blog public safety verification passed')
