import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(relativePath) {
  try {
    return await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return ''
    throw error
  }
}

const [
  intentLink,
  sidebar,
  blogQueue,
  blogQueuePage,
  previewLoading,
  proxy,
  assetPreviewRoute,
] = await Promise.all([
  source('src/components/admin/IntentPrefetchLink.tsx'),
  source('src/components/admin/AdminSidebar.tsx'),
  source('src/app/admin/platform/blog/BlogDraftQueueClient.tsx'),
  source('src/app/admin/platform/blog/page.tsx'),
  source('src/app/admin/platform/blog/[id]/preview/loading.tsx'),
  source('src/proxy.ts'),
  source('src/app/admin/platform/assets/[assetId]/preview/route.ts'),
])

assert.match(intentLink, /useState\(false\)/, 'intent prefetch must start disabled')
assert.match(
  intentLink,
  /prefetch=\{hasIntent \? null : false\}/,
  'intent prefetch must restore the Next.js default only after intent',
)
assert.match(intentLink, /onMouseEnter=/, 'mouse hover must express navigation intent')
assert.match(intentLink, /onFocus=/, 'keyboard focus must express navigation intent')

assert.match(sidebar, /IntentPrefetchLink/, 'admin sidebar links must use intent prefetch')
assert.doesNotMatch(
  sidebar,
  /import Link from ['"]next\/link['"]/,
  'admin sidebar must not leave viewport-prefetched Next links behind',
)

assert.match(blogQueue, /IntentPrefetchLink/, 'blog queue row links must use intent prefetch')
assert.doesNotMatch(
  blogQueue,
  /import Link from ['"]next\/link['"]/,
  'blog queue must not leave edit or preview links on automatic viewport prefetch',
)

assert.match(
  blogQueuePage,
  /\.select\(['"]id, title, status, category, updated_at['"]\)/,
  'blog queue must fetch only fields rendered by the list',
)
for (const table of ['blog_media', 'blog_blocks', 'blog_post_events']) {
  assert.doesNotMatch(
    blogQueuePage,
    new RegExp(`\\.from\\(['"]${table}['"]\\)`),
    `blog queue must not bulk-fetch ${table}`,
  )
}

assert.match(previewLoading, /AdminRouteLoading/, 'blog preview must use the shared admin loading UI')
assert.match(previewLoading, /블로그 미리보기/, 'blog preview loading copy must match its destination')

assert.match(
  proxy,
  /const isAdminAssetPreviewRoute = \/\^\\\/admin\\\/platform\\\/assets\\\//,
  'proxy exclusion must be limited to the exact asset preview route shape',
)
assert.match(
  proxy,
  /const isAdminRoute = pathname\.startsWith\(['"]\/admin['"]\) && !isSelfAuthorizedAdminMediaRoute/,
  'self-authorized opaque media routes must avoid duplicate proxy auth',
)
assert.match(assetPreviewRoute, /platform\.auth\.getUser\(\)/, 'asset preview route must retain direct auth')
assert.match(
  assetPreviewRoute,
  /profile\?\.role !== ['"]administrator['"]/,
  'asset preview route must retain its administrator check',
)
assert.match(
  assetPreviewRoute,
  /private, no-store, max-age=0/,
  'asset preview must retain private no-store responses',
)

console.log('admin navigation performance contract passed')
