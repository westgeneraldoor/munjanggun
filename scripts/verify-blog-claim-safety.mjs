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

{
  const result = validateBlogClaimSafety({
    mode: 'publish',
    sourceEvidence: [],
  })

  assert.equal(result.passed, true, 'missing provenance must not block publishing')
  assert.equal(result.status, 'passed')
  assert.deepEqual(result.issues, [])
}

for (const sourceEvidence of [
  [{ claim_id: 'claim-candidate', status: 'candidate' }],
  [{ claim_id: 'claim-expired', status: 'expired' }],
  [{ status: 'publishable' }],
  [{ claim_id: 'claim-event', status: 'publishable', type: 'event' }],
]) {
  const result = validateBlogClaimSafety({ mode: 'publish', sourceEvidence })
  assert.equal(result.passed, true, 'provenance completeness, status, and freshness must not be publish gates')
  assert.deepEqual(result.issues, [])
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
    sourceEvidence: [{ claim_id: 'claim-review-raw', type: 'RAW_REVIEW', status: 'publishable' }],
  })

  assert.equal(result.passed, false, 'raw review provenance should remain private regardless of case')
  assert.ok(codes(result).includes('private_source_type'))
}

console.log('blog claim safety verification passed')
