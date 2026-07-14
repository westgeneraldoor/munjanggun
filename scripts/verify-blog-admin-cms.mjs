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

const REQUIRED_MANUAL_INTAKE_FLOW = 'Codex 완성 원고 → 승인 원고 등록 → reviewing 콘텐츠 큐 → 사진·검수 → 미리보기 → 발행'

function extractNamedCurrentSections(markdown) {
  const headings = [...markdown.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    index: match.index ?? 0,
    level: match[1].length,
    title: match[2].trim(),
  }))

  const ancestorStack = []
  const headingContext = headings.map((heading) => {
    while (ancestorStack.at(-1)?.level >= heading.level) {
      ancestorStack.pop()
    }

    const context = {
      heading,
      isInsideHistorical: ancestorStack.some((ancestor) => /\bhistorical\b|과거/i.test(ancestor.title)),
    }
    ancestorStack.push(heading)

    return context
  })

  return headingContext.flatMap(({ heading, isInsideHistorical }, index) => {
    const isCurrent = /\bcurrent\b|현재/i.test(heading.title)
    const isHistorical = /\bhistorical\b|과거/i.test(heading.title)

    if (!isCurrent || isHistorical || isInsideHistorical) {
      return []
    }

    const nextBoundary = headings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level)

    return [{
      title: heading.title,
      body: markdown.slice(heading.index, nextBoundary?.index),
      index: heading.index,
    }]
  })
}

function findAffirmativeAiPrerequisiteLines(markdown) {
  return markdown.split(/\r?\n/).filter((line) => {
    const normalized = line.trim()
    const mentionsAi = /\b(?:openai|ai)\b|OPENAI_/i.test(normalized)
    const mentionsPrerequisite = /api\s*key|key|configuration|config|setup|environment variable|secret|model|키|설정|구성|준비/i.test(normalized)
    const requiresIt = /\brequired\b|\bmust\b|\bneeds?\b|\bnecessary\b|필요(?:하다|한)?|필수|요구|(?:설정|구성)해야/i.test(normalized)
    const explicitNegation = /\bnot\s+(?:required|necessary)\b|\b(?:do|does)\s+not\s+need\b|\bno\s+longer\s+needed\b|(?:필요|필수|요구).{0,12}(?:없|아(?:니|닙)|하지\s*않)|(?:설정|구성).{0,12}(?:없|하지\s*않)/i.test(normalized)

    return mentionsAi && mentionsPrerequisite && requiresIt && !explicitNegation
  })
}

function assertNoAffirmativeAiPrerequisites(markdown, label) {
  assert.deepEqual(
    findAffirmativeAiPrerequisiteLines(markdown),
    [],
    `${label} must not make an AI/OpenAI key, config, or setup a current prerequisite`,
  )
}

const syntheticReadiness = [
  '## Current intake policy',
  'An OpenAI API key is not necessary for manual manuscript intake.',
  '',
  '## Historical preview evidence',
  'An OpenAI API key is required for the retired preview setup.',
  '',
  '## Current release gate',
  'AI configuration is not required after historical evidence.',
].join('\n')
const syntheticCurrentSections = extractNamedCurrentSections(syntheticReadiness)
assert.equal(syntheticCurrentSections.length, 2, 'current-section parsing must exclude historical evidence and retain later current sections')
assert.match(syntheticCurrentSections[1].body, /after historical evidence/)
assert.doesNotThrow(() => assertNoAffirmativeAiPrerequisites(syntheticCurrentSections.map((section) => section.body).join('\n'), 'synthetic current policy'))

const syntheticNestedHistorical = [
  '## Historical release record',
  '### ordinary note',
  '#### Current wording at the time',
  'OpenAI API key is required for the retired setup.',
  '',
  '## Current intake policy',
  'AI configuration is not required for approved manuscript intake.',
].join('\n')
const syntheticNestedHistoricalSections = extractNamedCurrentSections(syntheticNestedHistorical)
assert.equal(syntheticNestedHistoricalSections.length, 1, 'current sections nested under historical records must be excluded at every heading depth')
assert.doesNotThrow(() => assertNoAffirmativeAiPrerequisites(syntheticNestedHistoricalSections.map((section) => section.body).join('\n'), 'synthetic nested historical policy'))

assert.throws(
  () => assertNoAffirmativeAiPrerequisites('## Current intake policy\nOpenAI API key is required for setup.', 'synthetic affirmative prerequisite'),
  /must not make an AI\/OpenAI key, config, or setup a current prerequisite/,
)
assert.throws(
  () => assertNoAffirmativeAiPrerequisites('## 현재 운영 정책\nAI 설정해야 한다.', 'synthetic Korean affirmative prerequisite'),
  /must not make an AI\/OpenAI key, config, or setup a current prerequisite/,
)
assert.doesNotThrow(() => assertNoAffirmativeAiPrerequisites('## 현재 운영 정책\nAI 설정은 필요 없다.', 'synthetic Korean negation'))
assert.doesNotThrow(() => assertNoAffirmativeAiPrerequisites('## 현재 운영 정책\nAI 키가 필요하지 않습니다.', 'synthetic Korean -ji anseumnida negation'))
assert.doesNotThrow(() => assertNoAffirmativeAiPrerequisites('## 현재 운영 정책\nAI 키는 필수가 아닙니다.', 'synthetic Korean pilsooga anibnida negation'))

const queue = await readWorkspaceFile('src/app/admin/platform/blog/BlogDraftQueueClient.tsx')
const queuePage = await readWorkspaceFile('src/app/admin/platform/blog/page.tsx')
const queueLoading = await readWorkspaceFile('src/app/admin/platform/blog/loading.tsx')
const manuscriptIntakePage = await readWorkspaceFile('src/app/admin/platform/blog/new/page.tsx')
const manuscriptIntakeClient = await readWorkspaceFile('src/app/admin/platform/blog/new/ApprovedManuscriptIntakeClient.tsx')
const manuscriptIntakeLoading = await readWorkspaceFile('src/app/admin/platform/blog/new/loading.tsx')
const manuscriptActions = await readWorkspaceFile('src/app/admin/platform/blog/manuscript-actions.ts')
const approvedManuscriptDomain = await readWorkspaceFile('src/lib/content-os/approved-manuscript.ts')
const adminSidebar = await readWorkspaceFile('src/components/admin/AdminSidebar.tsx')
const editor = await readWorkspaceFile('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx')
const editorActions = await readWorkspaceFile('src/app/admin/platform/blog/[id]/actions.ts')
const editorPage = await readWorkspaceFile('src/app/admin/platform/blog/[id]/page.tsx')
const editorLoading = await readWorkspaceFile('src/app/admin/platform/blog/[id]/loading.tsx')
const publicSafety = await readWorkspaceFile('scripts/verify-blog-public-safety.mjs')
const packageJson = JSON.parse(await readWorkspaceFile('package.json'))
const readinessPath = 'docs/platform/BLOG_PRODUCTION_READINESS.md'
assert.equal(await exists(readinessPath), true, 'manual manuscript intake requires BLOG_PRODUCTION_READINESS.md')
const readiness = await readWorkspaceFile(readinessPath)
const routine = await readWorkspaceFile('docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md')
const contentOsPrd = await readWorkspaceFile('docs/platform/CONTENT_OS_PRD.md')
const contentOsSchema = await readWorkspaceFile('docs/platform/CONTENT_OS_SCHEMA.md')
const contentOsAdminUx = await readWorkspaceFile('docs/platform/CONTENT_OS_ADMIN_UX.md')
const brandSyncAudit = await readWorkspaceFile('docs/brand/BRAND_SYNC_AUDIT_2026-06-25.md')
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
assert.match(queue, /href="\/admin\/platform\/blog\/new"/)
assert.match(queue, /승인 원고 등록/)
assert.match(queueLoading, /블로그 콘텐츠 큐/)
assert.match(adminSidebar, /블로그 콘텐츠/)
assert.equal(adminSidebar.includes('블로그 초안'), false, 'sidebar must use the stable blog content label')
assert.match(manuscriptIntakePage, /createPlatformClient/)
assert.match(manuscriptIntakePage, /if \(!user\) redirect\('\/admin\/login'\)/)
assert.match(manuscriptIntakePage, /profile\.role !== 'administrator'/)
assert.match(manuscriptIntakePage, /redirect\('\/portal'\)/)
assert.match(manuscriptIntakeClient, /createApprovedManuscript/)
assert.match(manuscriptIntakeClient, /aria-live="polite"/)
assert.match(manuscriptIntakeClient, /제목/)
assert.match(manuscriptIntakeClient, /본문 블록/)
assert.match(manuscriptIntakeClient, /근거 ID/)
assert.match(manuscriptIntakeClient, /evidenceRows\.map/)
assert.match(manuscriptIntakeClient, /근거 추가/)
assert.equal(manuscriptIntakeClient.includes('<option value="candidate">'), false, 'approved intake must not create an unpublishable candidate evidence state')
assert.equal(manuscriptIntakeClient.includes('등록 뒤 에디터에서 이어서 보완'), false, 'intake must not claim the editor can change source evidence')
assert.match(manuscriptIntakeLoading, /승인 원고 등록/)
assert.match(manuscriptActions, /registerApprovedManuscript/)
assert.match(approvedManuscriptDomain, /status: 'reviewing'/)
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

const currentReadinessSections = extractNamedCurrentSections(readiness)
const currentReadinessText = currentReadinessSections.map((section) => section.body).join('\n')
const historicalEvidenceIndex = readiness.search(/^#{1,6}\s+.*\bHistorical\b|^#{1,6}\s+.*과거/im)
assert.ok(currentReadinessSections.length >= 2, 'readiness must name at least two current sections')
assert.ok(historicalEvidenceIndex >= 0, 'readiness must retain a named historical evidence section')
assert.ok(
  currentReadinessSections.some((section) => section.index > historicalEvidenceIndex),
  'readiness must inspect a named current section that appears after historical evidence',
)
assert.ok(currentReadinessText.includes(REQUIRED_MANUAL_INTAKE_FLOW), `readiness current policy must include: ${REQUIRED_MANUAL_INTAKE_FLOW}`)
assertNoAffirmativeAiPrerequisites(currentReadinessText, 'readiness current policy')

assert.ok(contentOsPrd.includes(REQUIRED_MANUAL_INTAKE_FLOW), `Content OS PRD must include: ${REQUIRED_MANUAL_INTAKE_FLOW}`)
assert.ok(routine.includes(REQUIRED_MANUAL_INTAKE_FLOW), `operating routine must include: ${REQUIRED_MANUAL_INTAKE_FLOW}`)
assert.match(contentOsPrd, /새 승인 원고는 `?reviewing`?에서 시작한다/)
assert.match(contentOsSchema, /`?ai_draft`?는 legacy-only 상태다/)
assert.match(contentOsSchema, /DB migration 없이 `?status = reviewing`?을 명시해 INSERT한다/)
assert.match(contentOsAdminUx, /메뉴명:\s*```text\s*블로그 콘텐츠\s*```/s)
assert.match(contentOsAdminUx, /승인 원고 등록/)
assert.match(brandSyncAudit, /2026-07-14 현재 정책/)
assert.match(brandSyncAudit, /과거 AI 초안.*historical evidence.*current policy가 아니다/s)

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
