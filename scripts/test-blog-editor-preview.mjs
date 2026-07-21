import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const adapterPath = new URL('../src/lib/content-os/blog-editor-preview.ts', import.meta.url)
const rendererPath = new URL('../src/components/blog/BlogPostRenderer.tsx', import.meta.url)
const rendererCssPath = new URL('../src/components/blog/BlogPostRenderer.module.css', import.meta.url)
const editorPath = new URL('../src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', import.meta.url)
const editorCssPath = new URL('../src/app/admin/platform/blog/[id]/blog-editor.module.css', import.meta.url)
const platformModalPath = new URL('../src/components/platform/ui/PlatformModal.tsx', import.meta.url)
const e2ePath = new URL('../tests/blog-editor-unsaved-navigation.spec.ts', import.meta.url)
const actionsPath = new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url)
const renderingPath = new URL('../src/lib/content-os/blog-rendering.ts', import.meta.url)

async function readRequiredFile(url, label) {
  try {
    return await readFile(url, 'utf8')
  } catch (error) {
    throw new Error(`${label} does not exist: ${url.pathname}`, { cause: error })
  }
}

async function importAdapter() {
  const source = await readRequiredFile(adapterPath, 'blog editor preview adapter')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: adapterPath.pathname,
  }).outputText

  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const {
  BLOG_ADMIN_PREVIEW_MEDIA_STATUSES,
  buildBlogEditorPreviewData,
  createStableEditorSignature,
} = await importAdapter()

assert.deepEqual(
  BLOG_ADMIN_PREVIEW_MEDIA_STATUSES,
  ['candidate', 'approved', 'published'],
  'saved and embedded admin previews must share the same visible-media policy',
)

const post = {
  id: 'post-1',
  title: '현재 제목',
  slug: 'current-title',
  excerpt: '현재 발취',
  status: 'reviewing',
  category: 'field_guide',
  seoTitle: '현재 SEO',
  metaDescription: '현재 설명',
  canonicalUrl: null,
  primaryKeyword: '현재 키워드',
  targetQuestion: '현재 질문',
  summaryAnswer: '현재 답변',
  relatedQuestions: ['현재 연관 질문'],
  serviceArea: '수도권',
  productType: '중문',
  publishedAt: null,
  updatedAt: '2026-07-15T00:00:00.000Z',
}

const blocks = [
  {
    id: 'db-block-1',
    clientId: 'client-db-block-1',
    type: 'paragraph',
    headingLevel: null,
    text: '저장된 문단',
    mediaId: null,
    metadata: {},
    displayOrder: 99,
  },
  {
    id: '',
    clientId: 'tmp-first',
    type: 'paragraph',
    headingLevel: null,
    text: '저장 전 첫 번째 문단',
    mediaId: null,
    metadata: {},
    displayOrder: 99,
  },
  {
    id: '',
    clientId: 'tmp-second',
    type: 'paragraph',
    headingLevel: null,
    text: '저장 전 두 번째 문단',
    mediaId: null,
    metadata: {},
    displayOrder: 99,
  },
]

const media = [
  {
    id: 'media-1',
    usageStatus: 'candidate',
    signedPreviewUrl: '/admin/platform/blog/media/media-1',
    publicUrl: 'https://raw-public.example/media-1.webp',
    altText: '현장 사진',
    caption: '캡션',
    sourceLabel: '현장',
    usedAsCover: true,
  },
  {
    id: 'media-approved',
    usageStatus: 'approved',
    signedPreviewUrl: '/admin/platform/blog/media/media-approved',
    publicUrl: null,
    altText: null,
    caption: null,
    sourceLabel: null,
    usedAsCover: false,
  },
  {
    id: 'media-published',
    usageStatus: 'published',
    signedPreviewUrl: '/admin/platform/blog/media/media-published',
    publicUrl: null,
    altText: null,
    caption: null,
    sourceLabel: null,
    usedAsCover: false,
  },
  {
    id: 'media-no-opaque-url',
    usageStatus: 'candidate',
    signedPreviewUrl: null,
    publicUrl: 'https://raw-public.example/must-not-pass-through.webp',
    altText: null,
    caption: null,
    sourceLabel: null,
    usedAsCover: false,
  },
  {
    id: 'media-rejected',
    usageStatus: 'rejected',
    signedPreviewUrl: '/admin/platform/blog/media/media-rejected',
    publicUrl: null,
    altText: null,
    caption: null,
    sourceLabel: null,
    usedAsCover: false,
  },
]

const preview = buildBlogEditorPreviewData({ post, blocks, media })
assert.equal(preview.post.title, '현재 제목', 'the embedded preview must receive current post state')
assert.equal(preview.blocks[1].text, '저장 전 첫 번째 문단', 'the embedded preview must receive current block state')
assert.deepEqual(preview.blocks.map(block => block.id), ['db-block-1', 'tmp-first', 'tmp-second'])
assert.equal(preview.blocks[0].id, 'db-block-1', 'persisted database block IDs must be preserved')
assert.equal(new Set(preview.blocks.map(block => block.id)).size, 3, 'unsaved blocks must keep distinct preview IDs')
assert.deepEqual(preview.blocks.map(block => block.displayOrder), [0, 1, 2], 'preview order follows current editor order')
assert.deepEqual(
  preview.media.map(item => item.usageStatus),
  ['candidate', 'approved', 'published', 'candidate'],
  'admin previews include candidate, approved, and published media while excluding rejected media',
)
assert.equal(preview.media[0].url, '/admin/platform/blog/media/media-1', 'opaque media URLs pass through unchanged')
assert.equal(preview.media[3].url, null, 'raw public URLs must never be used as an embedded-preview fallback')

assert.equal(
  createStableEditorSignature({ z: 1, nested: { b: 2, a: 1 }, list: [{ y: 2, x: 1 }] }),
  createStableEditorSignature({ list: [{ x: 1, y: 2 }], nested: { a: 1, b: 2 }, z: 1 }),
  'saved-state signatures must be stable across object key order',
)
assert.notEqual(
  createStableEditorSignature({ title: 'before' }),
  createStableEditorSignature({ title: 'after' }),
  'saved-state signatures must change with editor content',
)

const [rendererSource, rendererCss, editorSource, editorCss, platformModalSource, e2eSource, actionsSource, renderingSource] = await Promise.all([
  readRequiredFile(rendererPath, 'shared blog renderer'),
  readRequiredFile(rendererCssPath, 'shared blog renderer styles'),
  readRequiredFile(editorPath, 'blog editor client'),
  readRequiredFile(editorCssPath, 'blog editor styles'),
  readRequiredFile(platformModalPath, 'shared platform modal'),
  readRequiredFile(e2ePath, 'blog editor navigation Playwright coverage'),
  readRequiredFile(actionsPath, 'blog editor server actions'),
  readRequiredFile(renderingPath, 'saved blog preview loader'),
])

assert.match(rendererSource, /export type BlogRenderSurface\s*=\s*['"]public-page['"]\s*\|\s*['"]saved-preview['"]\s*\|\s*['"]embedded-preview['"]/)
assert.match(rendererSource, /surface:\s*BlogRenderSurface/)
assert.match(rendererSource, /const RootElement = isEmbeddedPreview \? ['"]div['"] : ['"]main['"]/, 'embedded preview must not add a second main landmark')
assert.match(rendererSource, /styles\.heroNoMedia/, 'the no-media hero needs an explicit class')
assert.match(rendererSource, /aria-disabled=['"]true['"]/, 'preview actions must be rendered inert')
assert.doesNotMatch(editorSource, /function EditorMobilePreview\s*\(/, 'legacy duplicate preview JSX must be removed')
assert.match(editorSource, /buildBlogEditorPreviewData\s*\(/, 'the embedded renderer must consume current editor state')
assert.match(editorSource, /<BlogPostRenderer[\s\S]*surface=['"]embedded-preview['"]/, 'the editor must use the shared embedded renderer')
assert.match(rendererCss, /container-type:\s*inline-size/, 'embedded preview must establish an inline-size container')
assert.match(rendererCss, /@container[\s\S]*\.hero/, 'embedded preview layout must respond to its container')
assert.match(rendererCss, /\.heroNoMedia\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'no-media hero must always be one column')
assert.match(rendererCss, /\.embeddedPreview[\s\S]*min-height:\s*0/, 'embedded preview must unset page min-height')

assert.match(editorSource, /createStableEditorSignature/)
assert.match(editorSource, /setSavedEditorSignature/, 'the saved signature must update after a successful save')
assert.match(editorSource, /addEventListener\(['"]beforeunload['"]/, 'reload and tab close must be guarded')
assert.match(editorSource, /onNavigate=\{handlePreviewNavigate\}/, 'Next Link navigation must use an explicit guard')
assert.match(editorSource, /<PlatformModal[\s\S]*isOpen=\{discardDialogOpen\}/, 'the unsaved navigation guard must reuse the shared modal')
assert.match(editorCss, /\.discardDialogActions/)
assert.match(platformModalSource, /role=['"]dialog['"]/, 'the shared modal must expose dialog semantics')
assert.match(platformModalSource, /aria-modal=['"]true['"]/, 'the shared modal must expose modal semantics')
assert.match(platformModalSource, /event\.key === ['"]Escape['"]/, 'the shared modal must handle Escape')
assert.match(platformModalSource, /event\.key !== ['"]Tab['"]/, 'the shared modal must trap Tab navigation')
assert.match(platformModalSource, /previousActiveElement\?\.focus/, 'closing the shared modal must restore focus')
assert.match(platformModalSource, /document\.body\.style\.overflow = ['"]hidden['"]/, 'the shared modal must lock page scroll')

for (const scenario of ['cancel', 'confirm', 'beforeunload', 'Escape', 'Tab', 'focus']) {
  assert.match(e2eSource, new RegExp(scenario, 'i'), `Playwright coverage must include ${scenario}`)
}
assert.doesNotMatch(e2eSource, /test\.skip\s*\(/, 'missing authenticated editor fixtures must fail instead of silently skipping CI')

assert.match(
  actionsSource,
  /function toAttachedMedia\([\s\S]*?previewUrl:\s*`\/admin\/platform\/blog\/media\/\$\{media\.id\}`/,
  'attached Content Asset media must return only the same-origin opaque media route',
)
assert.doesNotMatch(
  actionsSource,
  /const previewUrl\s*=\s*[^\n]*public_url/,
  'attached Content Asset media must not derive preview URLs from raw public_url values',
)
assert.match(
  renderingSource,
  /\.in\('usage_status',\s*\[\.\.\.BLOG_ADMIN_PREVIEW_MEDIA_STATUSES\]\)/,
  'saved preview must use the shared candidate/approved/published media policy',
)

console.log('blog editor preview contract passed')
