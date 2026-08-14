import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
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

function extractSqlFunctionBody(statement) {
  return statement.match(/\bAS\s+\$\$([\s\S]*?)\$\$\s*;\s*$/i)?.[1] ?? ''
}

function extractNamedFunctionBody(source, functionName) {
  const functionMatch = new RegExp(`\\b(?:export\\s+)?(?:async\\s+)?function\\s+${functionName}\\b`).exec(source)
  assert.ok(functionMatch, `${functionName} must be declared`)

  const openingBraceIndex = source.indexOf('{', functionMatch.index)
  assert.ok(openingBraceIndex >= 0, `${functionName} must have a function body`)

  let depth = 0
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const character = source[index]
    const nextCharacter = source[index + 1]

    if (lineComment) {
      if (character === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (character === '\\') {
        index += 1
      } else if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === '/' && nextCharacter === '/') {
      lineComment = true
      index += 1
      continue
    }
    if (character === '/' && nextCharacter === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (character === '\'' || character === '"' || character === '`') {
      quote = character
      continue
    }
    if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1
      if (depth === 0) return source.slice(openingBraceIndex + 1, index)
    }
  }

  assert.fail(`${functionName} must close its function body`)
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
const blogStatusTransitions = await readWorkspaceFile('src/lib/content-os/blog-status-transitions.ts')
const editorPage = await readWorkspaceFile('src/app/admin/platform/blog/[id]/page.tsx')
const editorLoading = await readWorkspaceFile('src/app/admin/platform/blog/[id]/loading.tsx')
const publicSafety = await readWorkspaceFile('scripts/verify-blog-public-safety.mjs')
const migrationEntries = await Promise.all(
  (await readdir(workspaceFile('supabase/migrations')))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()
    .map(async (fileName) => ({
      fileName,
      contents: await readWorkspaceFile(`supabase/migrations/${fileName}`),
    })),
)
const migration = migrationEntries.find(({ contents }) => contents.includes('register_approved_manuscript'))?.contents ?? ''
const databaseTypes = await readWorkspaceFile('src/types/database.ts')

assert.ok(migration, 'approved manuscript intake requires a register_approved_manuscript migration')
const registerApprovedManuscriptStatement = migration.match(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+showroom\.register_approved_manuscript\s*\([\s\S]*?\)\s*RETURNS[\s\S]*?\bAS\s+\$\$[\s\S]*?\$\$\s*;/i,
 )?.[0] ?? ''
const registerApprovedManuscriptBody = extractSqlFunctionBody(registerApprovedManuscriptStatement)
assert.ok(registerApprovedManuscriptStatement, 'migration must define CREATE OR REPLACE FUNCTION showroom.register_approved_manuscript(...)')
assert.ok(registerApprovedManuscriptBody, 'register_approved_manuscript must have a dollar-quoted body')
assert.match(registerApprovedManuscriptStatement, /SECURITY\s+INVOKER/i, 'register_approved_manuscript must use SECURITY INVOKER')
assert.match(registerApprovedManuscriptStatement, /SET\s+search_path\s*=\s*''/i, 'register_approved_manuscript must set an empty search_path')
assert.match(registerApprovedManuscriptBody, /INSERT\s+INTO\s+showroom\.blog_posts\b/i, 'register_approved_manuscript must insert into showroom.blog_posts')
assert.match(registerApprovedManuscriptBody, /INSERT\s+INTO\s+showroom\.blog_blocks\b/i, 'register_approved_manuscript must insert into showroom.blog_blocks')
assert.match(registerApprovedManuscriptBody, /INSERT\s+INTO\s+showroom\.blog_post_events\b/i, 'register_approved_manuscript must insert into showroom.blog_post_events')
assert.doesNotMatch(registerApprovedManuscriptBody, /\bEXCEPTION\s+WHEN\b/i, 'register_approved_manuscript must not include an exception handler that could swallow rollback errors')
assert.match(registerApprovedManuscriptBody, /jsonb_typeof\s*\(\s*p_post\s*\)\s+IS\s+DISTINCT\s+FROM\s+'object'/i, 'register_approved_manuscript must require an object post payload')
assert.match(registerApprovedManuscriptBody, /jsonb_typeof\s*\(\s*p_event\s*\)\s+IS\s+DISTINCT\s+FROM\s+'object'/i, 'register_approved_manuscript must require an object event payload')
assert.match(registerApprovedManuscriptBody, /jsonb_typeof\s*\(\s*p_blocks\s*\)\s+IS\s+DISTINCT\s+FROM\s+'array'/i, 'register_approved_manuscript must require an array block payload')
assert.match(registerApprovedManuscriptBody, /jsonb_array_length\s*\(\s*p_blocks\s*\)\s*=\s*0/i, 'register_approved_manuscript must reject an empty block array')
assert.match(registerApprovedManuscriptBody, /v_actor_id\s+IS\s+NULL/i, 'register_approved_manuscript must reject a missing actor')

const blogBlocksInsert = registerApprovedManuscriptBody.match(/INSERT\s+INTO\s+showroom\.blog_blocks\b[\s\S]*?;/i)?.[0] ?? ''
assert.ok(blogBlocksInsert, 'register_approved_manuscript must contain a showroom.blog_blocks INSERT statement')
assert.match(blogBlocksInsert, /\bdisplay_order\b/i, 'showroom.blog_blocks INSERT must set display_order')
const ordinalityMatch = /WITH\s+ORDINALITY\s+AS\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/i.exec(blogBlocksInsert)
assert.ok(ordinalityMatch, 'showroom.blog_blocks INSERT must define a WITH ORDINALITY alias')
const ordinalityTableAlias = ordinalityMatch[1]
const ordinalityColumnAlias = ordinalityMatch[2].split(',').at(-1)?.trim()
assert.ok(ordinalityColumnAlias, 'WITH ORDINALITY must name its ordinality column')
const ordinalityIsBoundToDisplayOrder = ordinalityColumnAlias.toLowerCase() === 'display_order'
  ? new RegExp(`\\b${ordinalityTableAlias}\\.${ordinalityColumnAlias}\\b`, 'i').test(blogBlocksInsert)
  : new RegExp(`\\b${ordinalityTableAlias}\\.${ordinalityColumnAlias}\\s+AS\\s+display_order\\b`, 'i').test(blogBlocksInsert)
assert.ok(ordinalityIsBoundToDisplayOrder, 'showroom.blog_blocks INSERT must bind its WITH ORDINALITY alias to display_order')

const normalizeFunctionSignature = (signature) => signature.replace(/\s+/g, ' ').trim()
const declaredFunctionSignature = normalizeFunctionSignature(
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(showroom\.register_approved_manuscript\s*\([^)]*\))/i.exec(registerApprovedManuscriptStatement)?.[1] ?? '',
)
assert.ok(declaredFunctionSignature, 'register_approved_manuscript must expose a declared function signature')
const publicRevoke = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+(showroom\.register_approved_manuscript\s*\([^;]*?\))\s+FROM\s+PUBLIC\s*;/i.exec(migration)
const clientRevoke = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+(showroom\.register_approved_manuscript\s*\([^;]*?\))\s+FROM\s+anon\s*,\s*authenticated\s*;/i.exec(migration)
const serviceRoleGrant = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(showroom\.register_approved_manuscript\s*\([^;]*?\))\s+TO\s+service_role\s*;/i.exec(migration)
assert.ok(publicRevoke, 'register_approved_manuscript must revoke PUBLIC access')
assert.ok(clientRevoke, 'register_approved_manuscript must revoke anon and authenticated access')
assert.ok(serviceRoleGrant, 'register_approved_manuscript must grant execution to service_role')
assert.equal(normalizeFunctionSignature(publicRevoke[1]), declaredFunctionSignature, 'PUBLIC revoke must use the declared register_approved_manuscript function signature')
assert.equal(normalizeFunctionSignature(clientRevoke[1]), declaredFunctionSignature, 'anon and authenticated revoke must use the declared register_approved_manuscript function signature')
assert.equal(normalizeFunctionSignature(serviceRoleGrant[1]), declaredFunctionSignature, 'service_role grant must use the declared register_approved_manuscript function signature')
assert.equal(normalizeFunctionSignature(clientRevoke[1]), normalizeFunctionSignature(publicRevoke[1]), 'anon and authenticated revoke must use the exact PUBLIC revoke function signature')
assert.equal(normalizeFunctionSignature(serviceRoleGrant[1]), normalizeFunctionSignature(publicRevoke[1]), 'service_role grant must use the exact PUBLIC revoke function signature')
assert.match(databaseTypes, /\bregister_approved_manuscript\b/, 'database types must declare register_approved_manuscript')

const createApprovedManuscriptBody = extractNamedFunctionBody(manuscriptActions, 'createApprovedManuscript')
const requireAdministratorIndex = createApprovedManuscriptBody.indexOf('requireAdministrator()')
const createShowroomAdminClientIndex = createApprovedManuscriptBody.indexOf('createShowroomAdminClient()')
const registerApprovedManuscriptRpcCalls = [...createApprovedManuscriptBody.matchAll(/\.rpc\s*\(\s*['"]register_approved_manuscript['"]\s*,/g)]
const registerApprovedManuscriptRpcIndex = registerApprovedManuscriptRpcCalls[0]?.index ?? -1
assert.ok(
  requireAdministratorIndex >= 0
    && registerApprovedManuscriptRpcIndex >= 0
    && requireAdministratorIndex < registerApprovedManuscriptRpcIndex,
  'registerApprovedManuscript must require an administrator before calling register_approved_manuscript',
)
assert.ok(
  createShowroomAdminClientIndex >= 0 && requireAdministratorIndex < createShowroomAdminClientIndex,
  'registerApprovedManuscript must require an administrator before creating the service-role client',
)
assert.equal(registerApprovedManuscriptRpcCalls.length, 1, 'createApprovedManuscript must call register_approved_manuscript exactly once')
for (const tableName of ['blog_posts', 'blog_blocks', 'blog_post_events']) {
  assert.doesNotMatch(
    createApprovedManuscriptBody,
    new RegExp(`\\.from\\s*\\(\\s*['\"](?:showroom\\.)?${tableName}['\"]\\s*\\)[\\s\\S]*?\\.(?:insert|update|delete)\\s*\\(`, 'i'),
    `createApprovedManuscript must not write directly to showroom.${tableName}`,
  )
}
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

assert.match(queue, /type StatusFilter = 'all' \| 'draft' \| 'published' \| 'archived'/)
for (const tab of [
  "{ key: 'all', label: '전체' }",
  "{ key: 'draft', label: '초안' }",
  "{ key: 'published', label: '발행' }",
  "{ key: 'archived', label: '휴지통' }",
]) {
  assert.ok(queue.includes(tab), `queue must expose the simplified ${tab} filter`)
}
assert.equal(queue.includes("{ key: 'needs_review'"), false, 'queue must not expose a separate needs_review filter')
assert.equal(queue.includes("{ key: 'ai_draft'"), false, 'legacy ai_draft must not be a visible filter')
assert.match(queue, /function getVisibleStatus\(status: BlogPostStatus\): Exclude<StatusFilter, 'all'>/)
assert.match(queue, /if \(status === 'published'\) return 'published'[\s\S]*?return 'draft'/)
assert.match(editor, /ai_draft: '초안'/)
assert.match(editorActions, /isAllowedManualBlogStatusTransition/)
for (const transition of [
  "ai_draft: ['reviewing']",
  "reviewing: ['needs_media', 'ready']",
  "needs_media: ['reviewing', 'ready']",
  "ready: ['reviewing', 'needs_media']",
  "published: ['archived']",
  "archived: ['reviewing']",
]) {
  assert.ok(blogStatusTransitions.includes(transition), `manual transition matrix must include ${transition}`)
}
assert.match(blogStatusTransitions, /toStatus === 'published'/, 'manual status changes must never publish')

assert.match(queue, /<IntentPrefetchLink[\s\S]*?href=\{`\/admin\/platform\/blog\/\$\{row\.id\}`\}[\s\S]*?에디터 열기/)
assert.doesNotMatch(queue, /<tr[^>]*\bonClick=/, 'queue rows themselves must not change state on click')
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
assert.equal(manuscriptIntakeClient.includes('sourceEvidence'), false, 'approved intake must not accept human-authored provenance')
assert.equal(manuscriptIntakeClient.includes('evidenceRows'), false, 'approved intake must not render evidence rows')
assert.equal(manuscriptIntakeClient.includes('근거 ID'), false, 'approved intake must not ask for evidence IDs')
assert.match(manuscriptIntakeLoading, /승인 원고 등록/)
assert.match(manuscriptActions, /registerApprovedManuscript/)
assert.match(approvedManuscriptDomain, /status: 'reviewing'/)
assert.match(approvedManuscriptDomain, /source_kind: 'approved_manuscript_intake'/)
assert.match(approvedManuscriptDomain, /visibility: 'internal'/)
assert.match(editor, /미리보기/)
assert.match(editor, /발행/)
assert.equal(editor.includes('사실 확인일'), false, 'editor must not expose a manual fact-check date gate')
assert.equal(editor.includes('제목 없는 초안'), false, 'editor fallback must describe an external manuscript, not an AI draft')
assert.equal(editor.includes('초안 큐'), false, 'editor back link must use the CMS content queue label')
assert.match(editor, /제목 없는 원고/)
assert.match(editorPage, /블로그 콘텐츠 편집/)
assert.match(editorLoading, /블로그 콘텐츠 편집/)
assert.equal(publicSafety.includes("../src/app/admin/platform/blog/actions.ts"), false, 'public safety check must not depend on removed AI action')
assert.match(routine, /콘텐츠 초안은 Codex가 중앙 문장군 브랜드 자료와 이 프로젝트의 CMS 데이터·발행 이력을 근거로 외부 작성한다\./)
assert.match(routine, /관리자 화면은 승인된 원고의 CMS 관리 표면이다\./)
for (const doc of cmsDocs) {
  assert.doesNotMatch(doc, /문장군블로그/, 'platform CMS docs must not connect to the separate blog operations repository')
}

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
assert.match(contentOsPrd, /새 승인 원고는 `?reviewing`?에서 시작(?:한다|하고)/)
assert.match(contentOsSchema, /`?ai_draft`?는 legacy-only 상태다/)
assert.match(contentOsSchema, /비파괴 migration으로 승인 원고 등록 전용 RPC를 추가한다/)
assert.match(contentOsSchema, /`?status = reviewing`?을 강제한다/)
assert.match(currentReadinessText, /RPC migration 적용·권한 확인 → 웹 배포 → Preview 등록 검증/)
assert.equal(currentReadinessText.includes('migration 또는 RLS 변경 없음'), false, 'readiness must not deny the required RPC migration')
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
