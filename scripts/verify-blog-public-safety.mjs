import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rendering = await readFile(new URL('../src/lib/content-os/blog-rendering.ts', import.meta.url), 'utf8')
const blogPostPage = await readFile(new URL('../src/app/blog/[slug]/page.tsx', import.meta.url), 'utf8')
const blogPostRenderer = await readFile(new URL('../src/components/blog/BlogPostRenderer.tsx', import.meta.url), 'utf8')
const sitemap = await readFile(new URL('../src/app/sitemap.ts', import.meta.url), 'utf8')
const robots = await readFile(new URL('../src/app/robots.ts', import.meta.url), 'utf8')
const aiDraftAction = await readFile(new URL('../src/app/admin/platform/blog/actions.ts', import.meta.url), 'utf8')
const editorActions = await readFile(new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url), 'utf8')
const editorClient = await readFile(new URL('../src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', import.meta.url), 'utf8')
const contentAssetActions = await readFile(new URL('../src/app/admin/platform/assets/actions.ts', import.meta.url), 'utf8')
const contentAssetClient = await readFile(new URL('../src/app/admin/platform/assets/ContentAssetsClient.tsx', import.meta.url), 'utf8')

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

const publicPresentationResolver = rendering.match(/export function resolvePublicBlogPresentation[\s\S]*?\r?\n}\r?\n/)?.[0] ?? ''
assert.ok(publicPresentationResolver, 'public blog rendering must expose one canonical presentation resolver')

for (const field of ['seoTitle', 'metaDescription', 'excerpt', 'canonicalUrl', 'usedAsCover', 'updatedAt', 'breadcrumbs']) {
  assert.ok(
    publicPresentationResolver.includes(field),
    `canonical public presentation resolver must own ${field}`,
  )
}

assert.ok(
  blogPostPage.includes('resolvePublicBlogPresentation(data)'),
  'metadata and JSON-LD must use the canonical public presentation resolver',
)

assert.ok(
  blogPostRenderer.includes('resolvePublicBlogPresentation(data)'),
  'visible article UI must use the canonical public presentation resolver',
)

assert.ok(
  blogPostPage.includes('presentation.primaryImage') && !blogPostPage.includes('function getCoverImages'),
  'JSON-LD and Open Graph must use the same single visible cover-image contract',
)

assert.ok(
  blogPostRenderer.includes('presentation.description') && blogPostRenderer.includes('presentation.modifiedAt'),
  'the metadata description and modified date must be visibly rendered from the canonical model',
)

assert.ok(
  blogPostRenderer.includes('aria-label="breadcrumb"') && blogPostRenderer.includes('presentation.breadcrumbs'),
  'BreadcrumbList JSON-LD must have a matching visible breadcrumb trail',
)

assert.ok(
  sitemap.includes('getPublishedBlogPosts()'),
  'sitemap should derive blog URLs from published blog posts only',
)

for (const path of ['/admin/', '/api/', '/preview/', '/drafts/', '/private/']) {
  assert.ok(robots.includes(`'${path}'`), `robots must disallow ${path}`)
}

assert.ok(
  aiDraftAction.includes("status: 'ai_draft'"),
  'AI draft action must force status ai_draft',
)

assert.ok(
  aiDraftAction.includes('published_at: null'),
  'AI draft action must not set published_at',
)

assert.ok(
  !aiDraftAction.includes("from('blog_media')"),
  'AI draft action must not create or mutate blog_media',
)

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

const readyGate = editorActions.match(/function validateReadyGate[\s\S]*?\r?\n}\r?\n\r?\nexport async function updateBlogPostStatus/)?.[0] ?? ''
const publishGate = editorActions.match(/function validatePublishGate[\s\S]*?\r?\n}\r?\n\r?\nfunction validateReadyGate/)?.[0] ?? ''

for (const [name, gate] of [['ready', readyGate], ['publish', publishGate]]) {
  assert.ok(gate.includes('requiredMediaSlotIssues'), `${name} gate must block unresolved required_media slots`)
  assert.ok(gate.includes('hasCoverOrRecordedMediaException'), `${name} gate must require a cover image or a recorded no-media reason`)
}

assert.ok(
  editorActions.includes('post.media_missing_reason'),
  'the cover-or-exception gate must inspect the recorded no-media reason',
)

assert.ok(
  contentAssetActions.includes('validateUploadReviewChecks(formData)'),
  'content asset upload must require explicit privacy and promotion review checks on the server',
)

assert.ok(
  contentAssetActions.includes('privacy_checked: reviewChecks.privacyChecked') &&
    contentAssetActions.includes('promotion_consent_checked: reviewChecks.promotionConsentChecked'),
  'content asset upload must persist the operator review inputs instead of auto-approving them',
)

assert.ok(
  contentAssetClient.includes('name="privacyChecked"') && contentAssetClient.includes('name="promotionConsentChecked"'),
  'content asset upload UI must collect explicit privacy and promotion review confirmations',
)

assert.ok(
  editorClient.includes('name="privacyChecked"') && editorClient.includes('name="promotionConsentChecked"'),
  'the editor inline asset upload must collect the same explicit review confirmations',
)

console.log('blog public safety verification passed')
