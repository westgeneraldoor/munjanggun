import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const sourceUrl = new URL('../src/lib/content-os/approved-manuscript.ts', import.meta.url)
const source = await readFile(sourceUrl, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
}).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const {
  requireApprovedManuscriptAdministrator,
  registerApprovedManuscript,
} = await import(moduleUrl)

const now = '2026-07-14T09:00:00.000Z'

function validPayload(overrides = {}) {
  return {
    title: '  현관 중문 설치 전 확인할 조건  ',
    slug: 'entry-door-install-checklist',
    category: 'field_knowhow',
    excerpt: '현관 구조와 사용 환경을 먼저 확인하면 설치 방향을 더 안전하게 판단할 수 있습니다.',
    seoTitle: '현관 중문 설치 전 확인할 조건',
    metaDescription: '현관 중문 설치 전 문틀, 바닥 단차, 동선과 실측 조건을 차분히 확인하는 방법을 정리했습니다.',
    primaryKeyword: '현관 중문 설치',
    keywords: ['현관 중문', '방문 실측'],
    targetQuestion: '현관 중문 설치 전에 무엇을 확인해야 하나요?',
    summaryAnswer: '문틀 상태와 바닥 단차, 가족의 출입 동선을 함께 확인한 뒤 현장 실측으로 설치 가능 여부를 판단하는 편이 안전합니다.',
    relatedQuestions: ['방문 실측은 언제 필요한가요?'],
    serviceArea: '고양시',
    productType: '현관 중문',
    sourceEvidence: [{
      claim_id: 'claim-entry-1',
      status: 'vetted',
      note: '현장 조건은 실측으로 최종 확인합니다.',
    }],
    blocks: [{
      type: 'paragraph',
      text: '  문틀과 바닥 단차를 먼저 살펴보세요.  ',
      metadata: { description: '현장 구조에 따라 검토가 필요합니다.' },
    }],
    ...overrides,
  }
}

function createRepository({ failPostCode = null, failBlocks = false, failEvent = false } = {}) {
  const calls = {
    posts: [],
    blocks: [],
    events: [],
    deletedPostIds: [],
    safetyInputs: [],
  }

  return {
    calls,
    repository: {
      validateClaimSafety(input) {
        calls.safetyInputs.push(input)
        const text = [input.title, ...input.textSegments].join('\n')
        const blocked = /010-1234-5678|최저가/.test(text)
        return {
          passed: !blocked,
          status: blocked ? 'blocked' : 'passed',
          evidenceCount: input.sourceEvidence.length,
          blockers: blocked ? ['개인정보 또는 확정 가격 표현은 등록할 수 없습니다.'] : [],
          warnings: [],
          issues: [],
          forbiddenTerms: blocked ? ['개인정보 또는 확정 가격 표현'] : [],
        }
      },
      async insertPost(post) {
        calls.posts.push(post)
        if (failPostCode) {
          throw Object.assign(new Error('post insert failed'), { code: failPostCode })
        }
        return { id: 'post-1' }
      },
      async insertBlocks(blocks) {
        calls.blocks.push(...blocks)
        if (failBlocks) throw new Error('blocks failed')
      },
      async insertEvent(event) {
        calls.events.push(event)
        if (failEvent) throw new Error('event failed')
      },
      async deletePost(postId) {
        calls.deletedPostIds.push(postId)
      },
    },
  }
}

{
  const { calls, repository } = createRepository()
  const result = await registerApprovedManuscript(validPayload(), 'admin-1', repository, now)

  assert.equal(result.ok, true, 'valid manuscript should be registered')
  assert.equal(result.postId, 'post-1')
  assert.equal(calls.posts.length, 1)
  assert.equal(calls.posts[0].status, 'reviewing')
  assert.equal(calls.posts[0].published_at, null)
  assert.equal(calls.posts[0].created_by, 'admin-1')
  assert.equal(calls.posts[0].title, '현관 중문 설치 전 확인할 조건')
  assert.deepEqual(calls.blocks.map(block => block.display_order), [1])
  assert.deepEqual(calls.events, [{
    post_id: 'post-1',
    actor_id: 'admin-1',
    event_type: 'manuscript_registered',
    from_status: null,
    to_status: 'reviewing',
    memo: '승인된 외부 원고가 콘텐츠 큐에 등록되었습니다.',
    metadata: { intake: 'approved_manuscript' },
  }])
  assert.equal(calls.safetyInputs[0].mode, 'draft')
  assert.match(calls.safetyInputs[0].textSegments.join('\n'), /현관 중문 설치/)
  assert.match(calls.safetyInputs[0].textSegments.join('\n'), /현장 조건은 실측으로 최종 확인합니다/)
  assert.match(calls.safetyInputs[0].textSegments.join('\n'), /현장 구조에 따라 검토가 필요합니다/)
}

{
  const { calls, repository } = createRepository()
  const result = await registerApprovedManuscript(validPayload({
    blocks: [{
      type: 'paragraph',
      text: '첫 번째 문단입니다.\n\n두 번째 문단입니다.',
      metadata: {},
    }],
  }), 'admin-1', repository, now)

  assert.equal(result.ok, true)
  assert.equal(calls.blocks[0].text, '첫 번째 문단입니다.\n\n두 번째 문단입니다.', 'paragraph breaks should survive intake')
}

for (const role of ['customer', 'sales_manager', null, undefined]) {
  assert.throws(
    () => requireApprovedManuscriptAdministrator(role),
    /관리자만 저장할 수 있습니다/,
    `role ${String(role)} should be rejected before persistence`,
  )
}
assert.doesNotThrow(() => requireApprovedManuscriptAdministrator('administrator'))

for (const [label, payload] of [
  ['empty title', validPayload({ title: '   ' })],
  ['invalid slug', validPayload({ slug: 'Invalid Slug' })],
  ['invalid category', validPayload({ category: 'unknown' })],
  ['missing SEO metadata', validPayload({ seoTitle: '', metaDescription: '' })],
  ['missing target metadata', validPayload({ targetQuestion: '', summaryAnswer: '' })],
  ['empty blocks', validPayload({ blocks: [] })],
  ['unsupported block', validPayload({ blocks: [{ type: 'video', text: 'x', metadata: {} }] })],
  ['image block must be attached later in the editor', validPayload({ blocks: [{ type: 'image', mediaId: 'media-1', metadata: {} }] })],
  ['text block cannot attach media during manuscript intake', validPayload({ blocks: [{ type: 'paragraph', text: 'Body copy', mediaId: 'media-1', metadata: {} }] })],
  ['link button block is outside manuscript intake scope', validPayload({ blocks: [{ type: 'link_button', text: 'Open guide', metadata: {} }] })],
  ['guide box block is outside manuscript intake scope', validPayload({ blocks: [{ type: 'guide_box', text: 'Installation notes', metadata: {} }] })],
  ['body block requires meaningful text rather than whitespace or boolean metadata', validPayload({ blocks: [{ type: 'paragraph', text: '   ', metadata: { caption: '  ', enabled: true } }] })],
  ['qa block requires an answer on the server', validPayload({ blocks: [{ type: 'qa', text: '무엇을 확인해야 하나요?', metadata: {} }] })],
  ['image missing media ID', validPayload({ blocks: [{ type: 'image', text: null, metadata: {} }] })],
  ['untraceable evidence', validPayload({ sourceEvidence: [{ status: 'vetted', note: '근거' }] })],
  ['candidate evidence cannot enter the approved intake', validPayload({ sourceEvidence: [{ claim_id: 'claim-1', status: 'candidate' }] })],
  ['invalid evidence status', validPayload({ sourceEvidence: [{ claim_id: 'claim-1', status: 'restricted' }] })],
  ['forbidden meta description', validPayload({ metaDescription: '010-1234-5678로 최저가를 바로 확인하세요.' })],
  ['forbidden canonical URL', validPayload({ canonicalUrl: 'https://example.com/010-1234-5678' })],
]) {
  const { calls, repository } = createRepository()
  const result = await registerApprovedManuscript(payload, 'admin-1', repository, now)
  assert.equal(result.ok, false, `${label} should be rejected`)
  assert.equal(calls.posts.length, 0, `${label} must not insert a post before validation passes`)
}

{
  const { calls, repository } = createRepository({ failPostCode: 'duplicate_slug' })
  const result = await registerApprovedManuscript(validPayload(), 'admin-1', repository, now)

  assert.equal(result.ok, false)
  assert.match(result.message, /이미 사용 중인 주소/)
  assert.deepEqual(calls.deletedPostIds, [], 'failed post inserts should not attempt compensation')
}

for (const [label, options] of [
  ['block persistence failure', { failBlocks: true }],
  ['event persistence failure', { failEvent: true }],
]) {
  const { calls, repository } = createRepository(options)
  const result = await registerApprovedManuscript(validPayload(), 'admin-1', repository, now)
  assert.equal(result.ok, false, `${label} should fail the intake`)
  assert.deepEqual(calls.deletedPostIds, ['post-1'], `${label} should compensate by deleting the parent post`)
}

console.log('approved manuscript intake verification passed')
