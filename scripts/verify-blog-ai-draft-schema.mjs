import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const sourceUrl = new URL('../src/lib/content-os/blog-ai-draft-schema.ts', import.meta.url)
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
  BLOG_AI_DRAFT_RESPONSE_SCHEMA,
  normalizeBlogAiDraftOutput,
  parseBlogAiEvidenceJson,
  slugifyBlogDraft,
  summarizeBlogAiDraftPrompt,
  validateBlogAiDraftInput,
} = await import(moduleUrl)

const DISALLOWED_STRICT_SCHEMA_KEYS = new Set([
  'patternProperties',
  'unevaluatedProperties',
  'propertyNames',
  'minProperties',
  'maxProperties',
])

function includesObjectType(schema) {
  return schema?.type === 'object' || (Array.isArray(schema?.type) && schema.type.includes('object'))
}

function assertStrictSchemaObject(schema, path = '$') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return
  }

  for (const key of Object.keys(schema)) {
    assert.ok(!DISALLOWED_STRICT_SCHEMA_KEYS.has(key), `${path} uses unsupported strict schema keyword: ${key}`)
  }

  if (includesObjectType(schema)) {
    assert.equal(schema.additionalProperties, false, `${path} object must be closed with additionalProperties: false`)
    assert.ok(schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties), `${path} object must define properties`)
    assert.ok(Array.isArray(schema.required), `${path} object must define required`)
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${path} required keys must match properties`)
  }

  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      assertStrictSchemaObject(value, `${path}.properties.${key}`)
    }
  }

  if (schema.items) {
    assertStrictSchemaObject(schema.items, `${path}.items`)
  }

  for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
    if (Array.isArray(schema[keyword])) {
      schema[keyword].forEach((value, index) => assertStrictSchemaObject(value, `${path}.${keyword}[${index}]`))
    }
  }

  if (schema.$defs) {
    for (const [key, value] of Object.entries(schema.$defs)) {
      assertStrictSchemaObject(value, `${path}.$defs.${key}`)
    }
  }
}

const input = {
  category: 'customer_qa',
  topic: '중문 가격이 집마다 다른 이유',
  targetQuestion: '중문 가격은 왜 현장마다 달라지나요?',
  primaryKeyword: '중문 가격',
  serviceArea: '화성 동탄',
  productType: '3연동 중문',
  writingIntent: '가격 단정 없이 견적 변동 기준을 설명',
  needsImageSlots: true,
  evidenceRefs: [
    {
      claim_id: 'claim-price-variable',
      status: 'publishable',
      type: 'price',
      checked_at: '2026-07-03',
    },
  ],
}

{
  assert.equal(validateBlogAiDraftInput(input).length, 0, 'valid input should pass')
  const promptSummary = JSON.parse(summarizeBlogAiDraftPrompt(input))
  assert.equal(promptSummary.evidence[0].ref, 'claim-price-variable')
  assert.equal(promptSummary.evidence[0].status, 'publishable')
}

{
  const parsed = parseBlogAiEvidenceJson(JSON.stringify(input.evidenceRefs))
  assert.equal(parsed?.[0]?.claim_id, 'claim-price-variable')
  assert.equal(parseBlogAiEvidenceJson('{bad json'), null)
  assert.deepEqual(parseBlogAiEvidenceJson('{}'), [])
}

{
  const issues = validateBlogAiDraftInput({
    ...input,
    topic: '',
    evidenceRefs: [{ status: 'candidate' }],
  })
  assert.ok(issues.includes('초안 주제가 필요합니다.'))
  assert.ok(issues.includes('근거에는 ref, claim_id, proof_id, asset_id, source_id 중 하나가 필요합니다.'))
}

{
  const output = normalizeBlogAiDraftOutput({
    title: '중문 가격이 집마다 다른 이유',
    slug: 'bad 한글 slug',
    excerpt: '현장 구조와 선택 사양에 따라 중문 견적 기준이 달라질 수 있다는 점을 설명합니다.',
    seoTitle: '중문 가격이 집마다 다른 이유',
    metaDescription: '중문 가격이 집마다 달라지는 이유를 현장 구조, 제품 선택, 시공 조건 중심으로 정리했습니다.',
    targetQuestion: '중문 가격은 왜 현장마다 달라지나요?',
    summaryAnswer: '중문 가격은 제품 종류, 사이즈, 현장 구조, 마감 조건에 따라 달라질 수 있어 방문 실측 후 확인하는 편이 안전합니다.',
    relatedQuestions: ['문짝만 교체할 수 있나요?', '실측 전에 무엇을 확인하나요?'],
    primaryKeyword: '중문 가격',
    serviceArea: '화성 동탄',
    productType: '3연동 중문',
    blocks: [
      { type: 'heading', text: '가격이 달라지는 기준', headingLevel: 2, metadata: { extra: 'drop this' } },
      { type: 'paragraph', text: '같은 중문이라도 현장 폭과 높이, 문틀 상태, 선택하는 유리와 프레임에 따라 견적 기준이 달라질 수 있습니다.', headingLevel: null, metadata: { required_media: '현장 입구 사진', extra: 'drop this' } },
      { type: 'qa', text: '전화로 확정 견적을 받을 수 있나요?', headingLevel: null, metadata: { answer: '전화 상담만으로 확정하기보다 현장 구조를 함께 확인하는 편이 안전합니다.' } },
      { type: 'cta', text: '우리 집 조건은 무료방문 실측견적으로 확인해보세요.', headingLevel: null, metadata: { cta_kind: 'measure_consultation', href: '/portal/measure/new' } },
    ],
  }, input)

  assert.equal(output.ok, true)
  assert.match(output.draft.slug, /^blog-[a-z0-9]+$/)
  assert.deepEqual(output.draft.blocks[0].metadata, {})
  assert.deepEqual(Object.keys(output.draft.blocks[1].metadata), ['required_media'])
  assert.equal(output.draft.blocks.at(-1).metadata.href, '/portal/measure/new')
}

{
  const output = normalizeBlogAiDraftOutput({ title: '빈 초안' }, input)
  assert.equal(output.ok, false)
  assert.ok(output.issues.includes('AI 응답에 본문 블록이 없습니다.'))
}

{
  assert.equal(BLOG_AI_DRAFT_RESPONSE_SCHEMA.properties.blocks.items.anyOf.length, 4)
  assert.ok(BLOG_AI_DRAFT_RESPONSE_SCHEMA.required.includes('blocks'))
  assertStrictSchemaObject(BLOG_AI_DRAFT_RESPONSE_SCHEMA)

  const blockVariants = BLOG_AI_DRAFT_RESPONSE_SCHEMA.properties.blocks.items.anyOf
  assert.deepEqual(blockVariants.map(variant => variant.properties.metadata.additionalProperties), [false, false, false, false])
  assert.deepEqual(blockVariants[0].properties.metadata.required, [])
  assert.deepEqual(
    [...blockVariants[1].properties.metadata.required].sort(),
    ['intent', 'photo_slot_label', 'required_media'].sort(),
  )
}

{
  assert.match(slugifyBlogDraft('Middle Door Price Guide'), /^middle-door-price-guide$/)
  assert.match(slugifyBlogDraft('중문 가격'), /^blog-[a-z0-9]+$/)
}

console.log('blog AI draft schema verification passed')
