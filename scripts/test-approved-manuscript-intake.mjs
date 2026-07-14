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
const [publicRendering, publishActions] = await Promise.all([
  readFile(new URL('../src/lib/content-os/blog-rendering.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url), 'utf8'),
])

function validPayload(overrides = {}) {
  return {
    title: 'Entry door installation checklist',
    slug: 'entry-door-install-checklist',
    category: 'field_knowhow',
    excerpt: 'Check the opening, floor level, and visitor route before installation.',
    seoTitle: 'Entry door installation checklist',
    metaDescription: 'A practical checklist for assessing an entry door installation site.',
    primaryKeyword: 'entry door installation',
    keywords: ['entry door', 'site visit'],
    targetQuestion: 'What should be checked before installing an entry door?',
    summaryAnswer: 'Check the opening, floor level, and movement route before deciding on the installation.',
    relatedQuestions: ['When is a site visit required?'],
    serviceArea: 'Goyang',
    productType: 'entry door',
    sourceEvidence: [{
      claim_id: 'claim-entry-1',
      status: 'vetted',
      note: 'The final installation direction is checked during the site visit.',
    }],
    blocks: [
      { type: 'heading', headingLevel: 2, text: 'Before the visit', metadata: {} },
      { type: 'paragraph', text: 'Check the opening first.\n\nThen review the floor level.', metadata: { detail: 'Site conditions can vary.' } },
      { type: 'qa', text: 'What should be checked?', metadata: { answer: 'Check the opening and floor level.' } },
    ],
    ...overrides,
  }
}

function createRepository({ legacyPostFailureCode = null, atomicFailureCode = null } = {}) {
  const calls = {
    atomicRegistrations: [],
    insertPostCalls: 0,
    insertBlocksCalls: 0,
    insertEventCalls: 0,
    deletePostCalls: 0,
    safetyInputs: [],
  }

  return {
    calls,
    repository: {
      validateClaimSafety(input) {
        calls.safetyInputs.push(input)
        const blocked = [input.title, ...input.textSegments].join('\n').includes('010-1234-5678')
        return {
          passed: !blocked,
          status: blocked ? 'blocked' : 'passed',
          evidenceCount: input.sourceEvidence.length,
          blockers: blocked ? ['Sensitive contact information is not allowed.'] : [],
          warnings: [],
          issues: [],
          forbiddenTerms: blocked ? ['sensitive contact information'] : [],
        }
      },
      async registerManuscript(registration) {
        calls.atomicRegistrations.push(registration)
        if (atomicFailureCode) {
          throw Object.assign(new Error('atomic manuscript registration failed'), { code: atomicFailureCode })
        }
        return { id: 'post-1' }
      },
      // Legacy methods keep the pre-RPC implementation runnable. The assertions
      // below make their use a RED failure rather than a mock-shape error.
      async insertPost() {
        calls.insertPostCalls += 1
        if (legacyPostFailureCode) {
          throw Object.assign(new Error('legacy post insert failed'), { code: legacyPostFailureCode })
        }
        return { id: 'post-1' }
      },
      async insertBlocks() {
        calls.insertBlocksCalls += 1
      },
      async insertEvent() {
        calls.insertEventCalls += 1
      },
      async deletePost() {
        calls.deletePostCalls += 1
      },
    },
  }
}

{
  const { calls, repository } = createRepository()
  const result = await registerApprovedManuscript(validPayload(), 'admin-1', repository, now)

  assert.equal(result.ok, true, 'valid manuscript should be registered')
  assert.equal(result.postId, 'post-1')
  assert.equal(calls.atomicRegistrations.length, 1, 'registration must cross one atomic repository boundary')
  assert.deepEqual(calls.atomicRegistrations[0].blocks.map((block) => block.display_order), [1, 2, 3])
  assert.equal(calls.atomicRegistrations[0].post.status, 'reviewing')
  assert.equal(calls.atomicRegistrations[0].post.created_by, 'admin-1')
  assert.equal(calls.atomicRegistrations[0].post.published_at, null)
  assert.equal(calls.atomicRegistrations[0].event.event_type, 'manuscript_registered')
  assert.equal(calls.atomicRegistrations[0].event.actor_id, 'admin-1')
  assert.equal(calls.atomicRegistrations[0].blocks[1].text, 'Check the opening first.\n\nThen review the floor level.')
  assert.equal(calls.insertPostCalls, 0)
  assert.equal(calls.insertBlocksCalls, 0)
  assert.equal(calls.insertEventCalls, 0)
  assert.equal(calls.deletePostCalls, 0)
  assert.equal(calls.safetyInputs[0].mode, 'draft')
}

for (const role of ['customer', 'sales_manager', null, undefined]) {
  let rpcCalls = 0
  const { repository } = createRepository()
  const repositoryWithRpcCounter = {
    ...repository,
    async registerManuscript(registration) {
      rpcCalls += 1
      return repository.registerManuscript(registration)
    },
  }

  await assert.rejects(async () => {
    requireApprovedManuscriptAdministrator(role)
    return registerApprovedManuscript(validPayload(), 'admin-1', repositoryWithRpcCounter, now)
  }, `role ${String(role)} should be rejected before persistence`)
  assert.equal(rpcCalls, 0, 'non-admin must be rejected before the RPC client is used')
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
  ['qa block requires an answer on the server', validPayload({ blocks: [{ type: 'qa', text: 'What should be checked?', metadata: {} }] })],
  ['image missing media ID', validPayload({ blocks: [{ type: 'image', text: null, metadata: {} }] })],
  ['untraceable evidence', validPayload({ sourceEvidence: [{ status: 'vetted', note: 'evidence' }] })],
  ['candidate evidence cannot enter the approved intake', validPayload({ sourceEvidence: [{ claim_id: 'claim-1', status: 'candidate' }] })],
  ['restricted evidence cannot enter the approved intake', validPayload({ sourceEvidence: [{ claim_id: 'claim-1', status: 'restricted' }] })],
  ['forbidden claim-safety metadata', validPayload({ metaDescription: 'Call 010-1234-5678 for a fixed price.' })],
  ['forbidden claim-safety canonical URL', validPayload({ canonicalUrl: 'https://example.com/010-1234-5678' })],
]) {
  const { calls, repository } = createRepository()
  const result = await registerApprovedManuscript(payload, 'admin-1', repository, now)

  assert.equal(result.ok, false, `${label} should be rejected`)
  assert.equal(calls.atomicRegistrations.length, 0, `${label} must be rejected before the atomic persistence boundary`)
}

{
  const { calls, repository } = createRepository({ legacyPostFailureCode: '23505', atomicFailureCode: '23505' })
  const duplicateResult = await registerApprovedManuscript(validPayload(), 'admin-1', repository, now)

  assert.equal(duplicateResult.ok, false)
  assert.match(duplicateResult.message, /\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uC8FC\uC18C/)
  assert.equal(calls.atomicRegistrations.length, 1, 'duplicate slugs must be returned by the single RPC call')
  assert.equal(calls.deletePostCalls, 0, 'duplicate handling must not attempt application compensation')
}

for (const [label, atomicFailureCode] of [
  ['block failure', 'atomic_block_failure'],
  ['event failure', 'atomic_event_failure'],
]) {
  const { calls, repository } = createRepository({ atomicFailureCode })
  const result = await registerApprovedManuscript(validPayload(), 'admin-1', repository, now)

  assert.equal(result.ok, false, `${label} must roll back the complete registration`)
  assert.equal(calls.atomicRegistrations.length, 1, `${label} must reach the one atomic repository boundary`)
  assert.equal(calls.insertPostCalls, 0, `${label} must not use legacy post persistence`)
  assert.equal(calls.deletePostCalls, 0, `${label} must not use application compensation`)
}

{
  const { calls, repository } = createRepository()
  const candidateResult = await registerApprovedManuscript(validPayload({
    sourceEvidence: [{ claim_id: 'claim-entry-1', status: 'candidate' }],
  }), 'admin-1', repository, now)
  assert.equal(candidateResult.ok, false)
  assert.equal(calls.atomicRegistrations.length, 0, 'candidate evidence must be rejected before persistence')
}

for (const status of ['vetted', 'publishable']) {
  const { repository } = createRepository()
  const result = await registerApprovedManuscript(validPayload({
    sourceEvidence: [{ claim_id: 'claim-entry-1', status }],
  }), 'admin-1', repository, now)
  assert.equal(result.ok, true, `${status} evidence should be accepted`)
}

{
  const { calls, repository } = createRepository()
  const missingQaAnswerResult = await registerApprovedManuscript(validPayload({
    blocks: [{ type: 'qa', text: 'What should be checked?', metadata: {} }],
  }), 'admin-1', repository, now)
  assert.equal(missingQaAnswerResult.ok, false)
  assert.equal(calls.atomicRegistrations.length, 0, 'Q&A without an answer must be rejected before persistence')
}

{
  const { calls, repository } = createRepository()
  const blockedClaimResult = await registerApprovedManuscript(validPayload({
    metaDescription: 'Call 010-1234-5678 for a fixed price.',
  }), 'admin-1', repository, now)
  assert.equal(blockedClaimResult.ok, false)
  assert.equal(calls.atomicRegistrations.length, 0, 'claim-safety rejection must precede persistence')
}

const publicSafetyUnchanged = publicRendering.includes(".eq('status', 'published')")
  && publishActions.includes('const gate = validatePublishGate(post, blocks, media)')
  && publishActions.includes(".eq('status', 'ready')")
assert.equal(publicSafetyUnchanged, true)

console.log('approved manuscript intake verification passed')
