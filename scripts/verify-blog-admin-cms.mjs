import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'

const root = new URL('../', import.meta.url)

function workspaceFile(relativePath) {
  return new URL(relativePath, root)
}

async function readWorkspaceFile(relativePath) {
  return readFile(workspaceFile(relativePath), 'utf8')
}

async function exists(relativePath) {
  try {
    await access(workspaceFile(relativePath), constants.F_OK)
    return true
  } catch {
    return false
  }
}

const queue = await readWorkspaceFile('src/app/admin/platform/blog/BlogDraftQueueClient.tsx')
const queuePage = await readWorkspaceFile('src/app/admin/platform/blog/page.tsx')
const queueLoading = await readWorkspaceFile('src/app/admin/platform/blog/loading.tsx')
const editor = await readWorkspaceFile('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx')
const editorActions = await readWorkspaceFile('src/app/admin/platform/blog/[id]/actions.ts')
const editorPage = await readWorkspaceFile('src/app/admin/platform/blog/[id]/page.tsx')
const editorLoading = await readWorkspaceFile('src/app/admin/platform/blog/[id]/loading.tsx')
const publicSafety = await readWorkspaceFile('scripts/verify-blog-public-safety.mjs')
const packageJson = JSON.parse(await readWorkspaceFile('package.json'))
const routine = await readWorkspaceFile('docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md')
const cmsDocs = await Promise.all([
  'docs/platform/CONTENT_OS_STRATEGY.md',
  'docs/platform/CONTENT_OS_PRD.md',
  'docs/platform/CONTENT_OS_SCHEMA.md',
  'docs/platform/CONTENT_OS_ADMIN_UX.md',
  'docs/platform/CONTENT_OS_SEO_AEO_SPEC.md',
  'docs/platform/CONTENT_OS_OPERATION_CHECKLIST.md',
  'docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md',
  'docs/brand/PROJECT_BRAND_ADAPTER.md',
  'docs/README.md',
].map(readWorkspaceFile))

for (const aiOnlyFile of [
  'src/app/admin/platform/blog/actions.ts',
  'src/lib/content-os/blog-ai-draft-engine.ts',
  'src/lib/content-os/blog-ai-draft-schema.ts',
  'scripts/verify-blog-ai-draft-schema.mjs',
]) {
  assert.equal(await exists(aiOnlyFile), false, `${aiOnlyFile} must be removed with the admin AI draft flow`)
}

for (const forbiddenReference of [
  'createBlogAiDraft',
  'BlogAiDraftConfigView',
  'CreateBlogAiDraftPayload',
  'aiDraftPanel',
  'AI 초안 생성',
  'AI 초안 만들기',
]) {
  assert.equal(queue.includes(forbiddenReference), false, `queue must not expose ${forbiddenReference}`)
}

assert.equal(queuePage.includes('getBlogAiDraftConfigView'), false, 'queue page must not load AI configuration')
assert.equal(queuePage.includes('aiDraftConfig'), false, 'queue page must not pass AI configuration to the client')
assert.equal(packageJson.scripts['verify:blog-ai-draft-schema'], undefined, 'AI draft schema verification script must be removed')

assert.match(queue, /type StatusFilter = 'all' \| 'needs_review' \| Exclude<BlogPostStatus, 'ai_draft'>/)
assert.match(queue, /\{ key: 'needs_review', label: '검토 필요' \}/)
assert.equal(queue.includes("{ key: 'ai_draft'"), false, 'legacy ai_draft must not be a visible filter')
assert.match(queue, /ai_draft: '검토 필요'/)
assert.match(editor, /ai_draft: '검토 필요'/)
assert.match(editorActions, /ai_draft: \['reviewing'\]/)

assert.match(queue, /<Link href=\{`\/admin\/platform\/blog\/\$\{row\.id\}`\}/)
assert.match(queue, /블로그 콘텐츠 큐/)
assert.match(queueLoading, /블로그 콘텐츠 큐/)
assert.match(editor, /미리보기/)
assert.match(editor, /발행/)
assert.equal(editor.includes('제목 없는 초안'), false, 'editor fallback must describe an external manuscript, not an AI draft')
assert.equal(editor.includes('초안 큐'), false, 'editor back link must use the CMS content queue label')
assert.match(editor, /제목 없는 원고/)
assert.match(editorPage, /블로그 콘텐츠 편집/)
assert.match(editorLoading, /블로그 콘텐츠 편집/)
assert.equal(publicSafety.includes("../src/app/admin/platform/blog/actions.ts"), false, 'public safety check must not depend on removed AI action')
assert.match(routine, /콘텐츠 초안은 Codex가 문장군_브랜드와 문장군블로그를 근거로 외부 작성한다\./)
assert.match(routine, /관리자 화면은 승인된 원고의 CMS 관리 표면이다\./)

for (const environmentVariable of [
  'CONTENT_OS_AI_DRAFTS_ENABLED',
  'OPENAI_API_KEY',
  'OPENAI_BLOG_DRAFT_MODEL',
]) {
  assert.equal(
    cmsDocs.some(document => document.includes(environmentVariable)),
    false,
    `active CMS docs must not reference removed AI draft environment variable ${environmentVariable}`,
  )
}

console.log('Blog admin CMS verification passed.')
