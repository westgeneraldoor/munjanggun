import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function importTypeScriptModule(url) {
  const source = await readFile(url, 'utf8').catch(() => '')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
  }).outputText
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
  return import(moduleUrl)
}

const rendering = await readFile(new URL('../src/lib/content-os/blog-rendering.ts', import.meta.url), 'utf8')
const blogPostPage = await readFile(new URL('../src/app/blog/[slug]/page.tsx', import.meta.url), 'utf8')
const blogPostRenderer = await readFile(new URL('../src/components/blog/BlogPostRenderer.tsx', import.meta.url), 'utf8')
const sitemap = await readFile(new URL('../src/app/sitemap.ts', import.meta.url), 'utf8')
const robots = await readFile(new URL('../src/app/robots.ts', import.meta.url), 'utf8')
const editorActions = await readFile(new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url), 'utf8')
const editorClient = await readFile(new URL('../src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', import.meta.url), 'utf8')
const contentAssetActions = await readFile(new URL('../src/app/admin/platform/assets/actions.ts', import.meta.url), 'utf8')
const contentAssetClient = await readFile(new URL('../src/app/admin/platform/assets/ContentAssetsClient.tsx', import.meta.url), 'utf8')
const uploadReviewModule = await importTypeScriptModule(new URL('../src/lib/content-assets/upload-review-checks.ts', import.meta.url))
const mediaPolicyModule = await importTypeScriptModule(new URL('../src/lib/content-os/blog-media-policy.ts', import.meta.url))
const presentationModule = await importTypeScriptModule(new URL('../src/lib/content-os/blog-public-presentation.ts', import.meta.url))

const { readUploadReviewChecks } = uploadReviewModule
const { hasCoverOrRecordedMediaException } = mediaPolicyModule
const { resolvePublicBlogPresentation } = presentationModule

assert.equal(typeof readUploadReviewChecks, 'function', 'upload review parser should be exported')
assert.equal(typeof hasCoverOrRecordedMediaException, 'function', 'cover-or-exception policy should be exported')
assert.equal(typeof resolvePublicBlogPresentation, 'function', 'public presentation resolver should be exported')

for (const [label, privacyChecked, promotionConsentChecked] of [
  ['neither confirmation', null, null],
  ['privacy confirmation only', 'on', null],
  ['promotion confirmation only', null, 'on'],
  ['non-checkbox values', 'true', 'true'],
]) {
  const formData = new FormData()
  if (privacyChecked) formData.set('privacyChecked', privacyChecked)
  if (promotionConsentChecked) formData.set('promotionConsentChecked', promotionConsentChecked)
  assert.equal(readUploadReviewChecks(formData), null, `${label} must be rejected`)
}

{
  const formData = new FormData()
  formData.set('privacyChecked', 'on')
  formData.set('promotionConsentChecked', 'on')
  assert.deepEqual(readUploadReviewChecks(formData), {
    privacyChecked: true,
    promotionConsentChecked: true,
  })
}

assert.equal(
  hasCoverOrRecordedMediaException({ mediaMissingReason: null }, []),
  false,
  'a post without a cover or reason must fail the media policy',
)
assert.equal(
  hasCoverOrRecordedMediaException({ mediaMissingReason: '   ' }, []),
  false,
  'a whitespace-only media exception must fail the media policy',
)
assert.equal(
  hasCoverOrRecordedMediaException({ mediaMissingReason: null }, [{ usedAsCover: true }]),
  true,
  'a selected cover must satisfy the media policy',
)
assert.equal(
  hasCoverOrRecordedMediaException({ mediaMissingReason: '현장 사진을 확보하지 못한 사유를 기록함' }, []),
  true,
  'a recorded nonblank exception must satisfy the media policy',
)

{
  const presentation = resolvePublicBlogPresentation({
    post: {
      title: '우리 집 중문 선택 기준',
      slug: 'entry-door-guide',
      seoTitle: '중문 선택 가이드 | 문장군',
      metaDescription: '검색 결과와 구조화 데이터에 사용하는 설명입니다.',
      excerpt: '본문에서 먼저 확인할 핵심입니다.',
      summaryAnswer: '현장 구조와 생활 동선을 함께 확인해야 합니다.',
      canonicalUrl: null,
      publishedAt: '2026-07-10T03:00:00.000Z',
      updatedAt: '2026-07-14T06:00:00.000Z',
    },
    media: [
      { id: 'body-image', url: 'https://cdn.example/body.webp', usedAsCover: false },
      { id: 'cover-image', url: 'https://cdn.example/cover.webp', usedAsCover: true },
    ],
  }, path => `https://munjanggun.example${path}`)

  assert.equal(presentation.headline, '우리 집 중문 선택 기준', 'authored title must remain the visible and structured headline')
  assert.equal(presentation.metadataTitle, '중문 선택 가이드 | 문장군', 'SEO title must be reserved for metadata')
  assert.equal(presentation.description, '검색 결과와 구조화 데이터에 사용하는 설명입니다.')
  assert.equal(presentation.summaryAnswer, '현장 구조와 생활 동선을 함께 확인해야 합니다.')
  assert.equal(presentation.canonicalUrl, 'https://munjanggun.example/blog/entry-door-guide')
  assert.equal(presentation.primaryImage?.id, 'cover-image', 'only the selected cover may become the public presentation image')
  assert.equal(presentation.publishedAt, '2026-07-10T03:00:00.000Z')
  assert.equal(presentation.modifiedAt, '2026-07-14T06:00:00.000Z')
  assert.deepEqual(presentation.breadcrumbs.map(item => item.name), ['홈', '블로그', '우리 집 중문 선택 기준'])
}

{
  const presentation = resolvePublicBlogPresentation({
    post: {
      title: '대표 사진 없는 글',
      slug: 'no-cover',
      seoTitle: null,
      metaDescription: null,
      excerpt: null,
      summaryAnswer: '요약 답변',
      canonicalUrl: 'https://example.com/custom-canonical',
      publishedAt: null,
      updatedAt: '2026-07-14T06:00:00.000Z',
    },
    media: [{ id: 'body-image', url: 'https://cdn.example/body.webp', usedAsCover: false }],
  }, path => `https://munjanggun.example${path}`)

  assert.equal(presentation.metadataTitle, '대표 사진 없는 글')
  assert.equal(presentation.description, '요약 답변')
  assert.equal(presentation.canonicalUrl, 'https://example.com/custom-canonical')
  assert.equal(presentation.primaryImage, null, 'body images must not silently replace a missing cover')
}

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

for (const source of [contentAssetClient, editorClient]) {
  assert.ok(source.includes('name="privacyChecked"'), 'both upload surfaces must collect the privacy confirmation')
  assert.ok(source.includes('name="promotionConsentChecked"'), 'both upload surfaces must collect the promotion confirmation')
}

assert.ok(
  contentAssetActions.includes('readUploadReviewChecks(formData)'),
  'the upload server action must validate review confirmations',
)
assert.ok(
  !contentAssetActions.includes('privacy_checked: true') && !contentAssetActions.includes('promotion_consent_checked: true'),
  'content asset uploads must not auto-approve review fields',
)

const publishGate = editorActions.match(/function validatePublishGate[\s\S]*?\r?\n}\r?\n\r?\nfunction validateReadyGate/)?.[0] ?? ''
const readyGate = editorActions.match(/function validateReadyGate[\s\S]*?\r?\n}\r?\n\r?\nexport async function updateBlogPostStatus/)?.[0] ?? ''

for (const [name, gate] of [['publish', publishGate], ['ready', readyGate]]) {
  assert.ok(
    gate.includes('hasCoverOrRecordedMediaException'),
    `${name} gate must require a selected cover or recorded exception`,
  )
}

assert.ok(
  editorClient.includes("mediaMissingReason: emptyToNull(post.mediaMissingReason ?? '')"),
  'the editor must include the media exception in its save payload',
)
assert.ok(
  editorActions.includes('media_missing_reason: cleanText(payload.post.mediaMissingReason)'),
  'the save action must persist the media exception',
)
assert.ok(
  editorClient.includes('label="대표사진이 없을 때 사유"'),
  'the editor must provide an operator-facing media exception field',
)

assert.ok(
  !editorActions.includes('requiredMediaSlotIssues'),
  'current manual CMS gates must not depend on removed hidden media-slot metadata',
)

assert.ok(
  blogPostPage.includes('resolvePublicBlogPresentation(data, absoluteUrl)'),
  'metadata and JSON-LD must use the public presentation resolver',
)
assert.ok(
  blogPostRenderer.includes('resolvePublicBlogPresentation(data, absoluteUrl)'),
  'the visible article must use the public presentation resolver',
)
assert.ok(
  blogPostPage.includes('title: presentation.metadataTitle') && blogPostPage.includes('headline: presentation.headline'),
  'metadata title and structured headline must keep their distinct roles',
)
assert.ok(
  blogPostPage.includes('presentation.primaryImage') && !blogPostPage.includes('function getCoverImages'),
  'Open Graph and JSON-LD must use only the selected cover',
)
assert.ok(
  blogPostRenderer.includes('<h1>{presentation.headline}</h1>') && blogPostRenderer.includes('presentation.summaryAnswer'),
  'the visible hero must keep the authored title and summary answer',
)
assert.ok(
  !blogPostRenderer.includes('presentation.description'),
  'metadata description must not be duplicated into the visible hero',
)
assert.ok(
  blogPostRenderer.includes('aria-label="breadcrumb"') && blogPostRenderer.includes('presentation.breadcrumbs'),
  'structured breadcrumbs must have a matching visible trail',
)
assert.ok(
  blogPostRenderer.includes('presentation.modifiedAt'),
  'the structured modified date must have a matching visible date',
)

console.log('blog public safety verification passed')
