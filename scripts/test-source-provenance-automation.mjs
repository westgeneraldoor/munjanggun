import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

const migrationNames = (await readdir(path.join(projectRoot, 'supabase/migrations')))
  .filter(name => name.endsWith('_automate_blog_source_provenance.sql'))
assert.equal(migrationNames.length, 1, 'the source provenance change must have one migration')

const [
  approvedManuscript,
  intake,
  queue,
  queuePage,
  editor,
  editorPage,
  editorActions,
  claimSafety,
  migration,
  routine,
  adminUx,
  strategy,
  readiness,
  editorUx,
] = await Promise.all([
  source('src/lib/content-os/approved-manuscript.ts'),
  source('src/app/admin/platform/blog/new/ApprovedManuscriptIntakeClient.tsx'),
  source('src/app/admin/platform/blog/BlogDraftQueueClient.tsx'),
  source('src/app/admin/platform/blog/page.tsx'),
  source('src/app/admin/platform/blog/[id]/BlogEditorClient.tsx'),
  source('src/app/admin/platform/blog/[id]/page.tsx'),
  source('src/app/admin/platform/blog/[id]/actions.ts'),
  source('src/lib/content-os/blog-claim-safety.ts'),
  source(`supabase/migrations/${migrationNames[0]}`),
  source('docs/platform/BLOG_CONTENT_OPERATING_ROUTINE.md'),
  source('docs/platform/CONTENT_OS_ADMIN_UX.md'),
  source('docs/platform/CONTENT_OS_STRATEGY.md'),
  source('docs/platform/BLOG_PRODUCTION_READINESS.md'),
  source('docs/platform/BLOG_EDITOR_UX_V2.md'),
])

const payloadType = approvedManuscript.match(/export type ApprovedManuscriptPayload = \{[\s\S]*?\r?\n\}/)?.[0] ?? ''
assert.ok(payloadType, 'ApprovedManuscriptPayload must remain declared')
assert.doesNotMatch(payloadType, /sourceEvidence:/)
assert.match(approvedManuscript, /source_kind:\s*['"]approved_manuscript_intake['"]/)
assert.match(approvedManuscript, /source_id:\s*`approved-manuscript:\$\{slug\}`/)
assert.match(approvedManuscript, /recorded_at:\s*now/)
assert.match(approvedManuscript, /visibility:\s*['"]internal['"]/)

for (const forbidden of ['sourceEvidence', 'evidenceRows', 'EditableEvidence', '근거 ID', '근거 상태', '확인일']) {
  assert.equal(intake.includes(forbidden), false, `approved intake must not expose ${forbidden}`)
}

assert.doesNotMatch(queue, /evidenceNeeded|근거확인/)
assert.doesNotMatch(queuePage, /last_fact_checked_at|evidenceNeeded/)

for (const forbidden of ['lastFactCheckedAt', 'factCheckedLocal', 'factCheckedRef', 'sourceEvidenceCount', '사실 확인일']) {
  assert.equal(editor.includes(forbidden), false, `editor must not expose ${forbidden}`)
}
assert.doesNotMatch(editorPage, /summarizeSourceEvidence|sourceEvidenceCount|lastFactCheckedAt/)
assert.doesNotMatch(editorActions, /hasSourceEvidence|사실 확인 날짜가 필요합니다|출처 근거가 필요합니다|lastFactCheckedAt/)

for (const removedGate of [
  'missing_source_evidence',
  'evidence_missing_ref',
  'claim_status_missing',
  'claim_status_candidate',
  'volatile_claim_missing_status',
  'volatile_claim_missing_checked_at',
  'high_risk_claim_not_cleared',
]) {
  assert.equal(claimSafety.includes(removedGate), false, `${removedGate} must not remain a warning or publish gate`)
}
assert.match(claimSafety, /private_source_type/, 'private provenance payloads must remain blocked')

assert.match(migration, /DROP CONSTRAINT IF EXISTS blog_posts_ready_required_fields_check/i)
assert.match(migration, /ADD CONSTRAINT blog_posts_ready_required_fields_check/i)
assert.doesNotMatch(migration, /last_fact_checked_at/i)

assert.match(routine, /source_evidence.*서버.*자동/is)
assert.match(routine, /관리자.*근거.*입력하지 않는다/is)

for (const [documentName, document, removedContract] of [
  ['admin UX', adminUx, /필수 입력:[^\n]*근거|사실관계 확인일 없음/],
  ['strategy', strategy, /입력:[^\n]*추적 가능한 근거|사실관계 확인일 입력/],
  ['production readiness', readiness, /본문 블록, 근거|본문 블록·근거 검증|완성 원고와 근거를 등록|본문 블록, 근거와 금지표현/],
  ['editor UX', editorUx, /Last fact checked at/i],
]) {
  assert.doesNotMatch(document, removedContract, `${documentName} must not require manual evidence or a fact-check date`)
}
assert.match(readiness, /provenance.*서버.*자동|서버.*자동.*provenance/is)

console.log('source provenance automation contract passed')
