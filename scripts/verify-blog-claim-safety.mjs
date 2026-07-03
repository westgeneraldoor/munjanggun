import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const sourceUrl = new URL('../src/lib/content-os/blog-claim-safety.ts', import.meta.url)
const source = await readFile(sourceUrl, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
}).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
const { validateBlogClaimSafety } = await import(moduleUrl)

function codes(result) {
  return result.issues.map(issue => issue.code)
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    title: '현관문 교체 전 확인할 점',
    textSegments: ['현장 구조를 먼저 확인하고 안내합니다. 대표번호는 1599-6065입니다.'],
    sourceEvidence: [
      {
        claim_id: 'claim-field-check-required',
        status: 'publishable',
        type: 'service_area',
        checked_at: '2026-07-03',
      },
    ],
    brandCheckResult: { passed: true },
  })

  assert.equal(result.passed, true, 'publishable evidence and public contact should pass')
  assert.equal(result.status, 'passed')
}

for (const status of ['needs_confirmation', 'restricted', 'expired']) {
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [{ claim_id: `claim-${status}`, status }],
  })

  assert.equal(result.passed, false, `${status} claims should block publishing`)
  assert.ok(codes(result).includes(`claim_status_${status}`))
}

{
  const draft = validateBlogClaimSafety({
    mode: 'draft',
    sourceEvidence: [{ claim_id: 'claim-candidate', status: 'candidate' }],
  })
  const ready = validateBlogClaimSafety({
    mode: 'ready',
    sourceEvidence: [{ claim_id: 'claim-candidate', status: 'candidate' }],
  })

  assert.equal(draft.passed, true, 'candidate evidence may remain in draft mode for review')
  assert.equal(ready.passed, false, 'candidate evidence should block ready/publish gates')
  assert.ok(codes(ready).includes('claim_status_candidate'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [{ claim_id: 'claim-review-count', type: 'review_count' }],
  })

  assert.equal(result.passed, false, 'volatile claims need an explicit status before publishing')
  assert.ok(codes(result).includes('claim_status_missing'))
  assert.ok(codes(result).includes('volatile_claim_missing_status'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [{ ref: 'EVIDENCE_REGISTER' }],
  })

  assert.equal(result.passed, false, 'loose evidence references without claim status should not pass')
  assert.ok(codes(result).includes('claim_status_missing'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [{ status: 'publishable' }],
  })

  assert.equal(result.passed, false, 'evidence rows need a traceable claim/source/proof/asset id')
  assert.ok(codes(result).includes('evidence_missing_ref'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [
      {
        claim_id: 'claim-price-guide',
        status: 'vetted',
        type: 'price',
        checked_at: '2026-07-03',
      },
    ],
  })

  assert.equal(result.passed, true, 'vetted volatile claims with checked_at should pass')
}

{
  const result = validateBlogClaimSafety({
    mode: 'ready',
    sourceEvidence: [
      {
        claim_id: 'claim-event',
        status: 'publishable',
        type: 'event',
      },
    ],
  })

  assert.equal(result.passed, false, 'volatile publishable claims without checked_at should block ready/publish gates')
  assert.ok(codes(result).includes('volatile_claim_missing_checked_at'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [
      {
        asset_id: 'asset-price-tagged',
        status: 'vetted',
        tags: ['product:door', 'claim_type:price'],
      },
    ],
  })

  assert.equal(result.passed, false, 'claim_type tags should trigger volatile freshness gates')
  assert.ok(codes(result).includes('volatile_claim_missing_checked_at'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    title: '확정가로 무조건 가능',
    textSegments: ['고객 연락처 010-1234-5678, 서울시 강남구 테스트로 12-3'],
    sourceEvidence: [{ claim_id: 'claim-safe', status: 'publishable' }],
  })

  assert.equal(result.passed, false, 'forbidden copy and private fields should block publishing')
  assert.ok(codes(result).includes('fixed_price_claim'))
  assert.ok(codes(result).includes('absolute_possibility_claim'))
  assert.ok(codes(result).includes('private_phone'))
  assert.ok(codes(result).includes('private_address'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [
      {
        claim_id: 'claim-private-source',
        status: 'publishable',
        note: '고객 연락처 01012345678',
        address: '서울시 강남구 테스트로 12-3',
        raw_text: '원문 리뷰 그대로 저장',
      },
    ],
  })

  assert.equal(result.passed, false, 'source evidence internals should be scanned for private fields')
  assert.ok(codes(result).includes('private_phone'))
  assert.ok(codes(result).includes('private_address'))
  assert.ok(codes(result).includes('private_source_type'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [{ claim_id: 'claim-safe', status: 'publishable' }],
    brandCheckResult: { passed: false, blockers: ['price needs confirmation'] },
  })

  assert.equal(result.passed, false, 'existing brand check blockers should remain blocking')
  assert.ok(codes(result).includes('brand_check_blocked'))
}

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [{ claim_id: 'claim-review-raw', type: 'raw_review', status: 'publishable' }],
  })

  assert.equal(result.passed, false, 'raw review evidence should not be directly publishable')
  assert.ok(codes(result).includes('private_source_type'))
}

console.log('blog claim safety verification passed')
