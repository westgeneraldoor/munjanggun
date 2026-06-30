import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const graphSourceUrl = new URL('../src/lib/content-os/blog-content-graph.ts', import.meta.url)
const graphSource = await readFile(graphSourceUrl, 'utf8')
const transpiledGraph = ts.transpileModule(graphSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
}).outputText
const graphModuleUrl = `data:text/javascript;base64,${Buffer.from(transpiledGraph).toString('base64')}`
const {
  BLOG_CONTENT_GRAPH_SECTION_LIMIT,
  buildBlogContentGraph,
  collectFieldConditionTerms,
} = await import(graphModuleUrl)

function post(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? `${overrides.id} 제목`,
    slug: overrides.slug ?? overrides.id,
    excerpt: overrides.excerpt ?? null,
    category: overrides.category ?? 'customer_qa',
    primaryKeyword: overrides.primaryKeyword ?? null,
    targetQuestion: overrides.targetQuestion ?? null,
    summaryAnswer: overrides.summaryAnswer ?? null,
    relatedQuestions: overrides.relatedQuestions ?? [],
    serviceArea: overrides.serviceArea ?? null,
    productType: overrides.productType ?? null,
    publishedAt: overrides.publishedAt ?? '2026-06-01T00:00:00.000Z',
    coverMedia: null,
  }
}

{
  const current = post({
    id: 'current',
    title: '3연동 중문 가격은 왜 집마다 달라지나요?',
    productType: '3연동중문',
    targetQuestion: '신발장 옆 3연동 중문도 설치할 수 있나요?',
    primaryKeyword: '중문 가격',
  })
  const sameProduct = post({
    id: 'same-product',
    title: '3연동 중문 고르기 전에 보는 기준',
    productType: '3연동중문',
    publishedAt: '2026-05-02T00:00:00.000Z',
  })
  const newestGeneric = post({
    id: 'newest-generic',
    title: '최근 도어 소식',
    category: 'product_guide',
    productType: 'ABS도어',
    publishedAt: '2026-06-30T00:00:00.000Z',
  })

  const graph = buildBlogContentGraph(current, [current, newestGeneric, sameProduct])

  assert.equal(graph.sections[0]?.id, 'same-product', 'same product section should come first when available')
  assert.equal(graph.sections[0]?.posts[0]?.id, 'same-product', 'same product match should beat a newer generic post')
  assert.ok(
    graph.relatedPosts.every(item => item.id !== current.id),
    'content graph should never link the current post to itself',
  )
}

{
  const current = post({
    id: 'current-field',
    title: '신발장 옆 중문 설치 전에 확인할 것',
    category: 'field_knowhow',
    targetQuestion: '신발장 간섭이 있으면 중문 설치가 어려운가요?',
    productType: '중문',
  })
  const fieldMatch = post({
    id: 'field-match',
    title: '스위치와 신발장이 가까운 현관에서 보는 조건',
    category: 'field_knowhow',
    summaryAnswer: '벽공간과 스위치 위치를 함께 확인하면 판단하기 쉽습니다.',
    productType: '여닫이중문',
  })
  const productOnly = post({
    id: 'product-only',
    title: '중문 색상 고르는 법',
    productType: '중문',
  })

  const graph = buildBlogContentGraph(current, [current, productOnly, fieldMatch])
  const fieldSection = graph.sections.find(section => section.id === 'field-condition')

  assert.deepEqual(
    collectFieldConditionTerms(current),
    ['신발장'],
    'field condition terms should keep customer-facing field terms, not every token',
  )
  assert.equal(fieldSection?.posts[0]?.id, 'field-match', 'field condition section should connect posts with shared field concerns')
  assert.equal(fieldSection?.posts[0]?.relationLabel, '비슷한 현장 조건')
}

{
  const current = post({
    id: 'current-question',
    title: '문짝만 교체해도 되는 경우가 있나요?',
    targetQuestion: '문틀까지 바꿔야 하는 기준은 무엇인가요?',
    productType: 'ABS도어',
  })
  const questionMatch = post({
    id: 'question-match',
    title: '문틀세트 교체가 필요한 경우',
    targetQuestion: '문틀까지 바꿔야 하는 기준은 무엇인가요?',
    productType: '방문',
  })
  const categoryFallback = post({
    id: 'category-fallback',
    title: '도어 관리 질문 모음',
    category: 'customer_qa',
    productType: '방문',
  })

  const graph = buildBlogContentGraph(current, [current, categoryFallback, questionMatch])
  const questionSection = graph.sections.find(section => section.id === 'related-question')

  assert.equal(questionSection?.posts[0]?.id, 'question-match', 'manual and automatic question text should create a related-question edge')
  assert.equal(questionSection?.posts[0]?.relationLabel, '관련 질문')
}

{
  const current = post({ id: 'lonely-current', title: '우리 집 중문 가능할까요?', productType: '중문' })
  const onlyCandidate = post({ id: 'only-candidate', title: '중문 설치 전 확인할 것', productType: '중문' })

  const graph = buildBlogContentGraph(current, [current, onlyCandidate])

  assert.equal(graph.relatedPosts.length, 1, 'two-post scenario should still offer one useful internal link')
  assert.equal(graph.nextPost, null, 'next post should not duplicate a post already shown in a graph section')
}

{
  const current = post({
    id: 'fallback-current',
    title: '도어 교체 전에 읽을 글',
    category: 'customer_qa',
    productType: null,
  })
  const candidates = Array.from({ length: 5 }, (_, index) => post({
    id: `fallback-${index}`,
    title: `도어 교체 질문 ${index}`,
    category: 'customer_qa',
    productType: index % 2 === 0 ? 'ABS도어' : '방문',
    publishedAt: new Date(Date.UTC(2026, 5, 1, 0, 5 - index)).toISOString(),
  }))

  const graph = buildBlogContentGraph(current, [current, ...candidates])
  const visibleIds = graph.relatedPosts.map(item => item.id)

  assert.equal(graph.sections.length, 0, 'same-topic-only matches should remain a compact fallback, not an empty named section')
  assert.equal(graph.relatedPosts.length, 3, 'fallback should keep up to three useful same-topic links')
  assert.ok(graph.nextPost, 'fallback should still preserve one read-next link when more candidates exist')
  assert.equal(new Set([...visibleIds, graph.nextPost.id]).size, visibleIds.length + 1, 'fallback and next post should not duplicate')
}

{
  const current = post({ id: 'empty-current', title: '아직 이어 읽을 글이 없는 상태' })

  const graph = buildBlogContentGraph(current, [current])

  assert.equal(graph.sections.length, 0, 'one-post scenario should not create empty sections')
  assert.equal(graph.relatedPosts.length, 0, 'one-post scenario should not create fallback recommendations')
  assert.equal(graph.nextPost, null, 'one-post scenario should not create a read-next link')
}

{
  const current = post({
    id: 'scale-current',
    title: '바닥 단차가 있으면 중문 설치가 어려운가요?',
    category: 'field_knowhow',
    targetQuestion: '바닥 단차와 레일 조건은 어떻게 확인하나요?',
    productType: '3연동중문',
  })
  const candidates = Array.from({ length: 80 }, (_, index) => post({
    id: `scale-${index}`,
    title: index % 2 === 0 ? `바닥 단차 ${index}번 현장 조건` : `3연동중문 ${index}번 선택 기준`,
    category: index % 3 === 0 ? 'field_knowhow' : 'product_guide',
    targetQuestion: index % 5 === 0 ? '바닥 단차와 레일 조건은 어떻게 확인하나요?' : null,
    productType: index % 2 === 0 ? '3연동중문' : 'ABS도어',
    publishedAt: new Date(Date.UTC(2026, 5, 1, 0, 80 - index)).toISOString(),
  }))

  const graph = buildBlogContentGraph(current, [current, ...candidates])
  const graphIds = graph.relatedPosts.map(item => item.id)

  assert.ok(
    graph.sections.every(section => section.posts.length <= BLOG_CONTENT_GRAPH_SECTION_LIMIT),
    'large content sets should keep every graph section compact',
  )
  assert.equal(new Set(graphIds).size, graphIds.length, 'large content sets should not duplicate posts across sections')
  assert.ok(
    graph.relatedPosts.every(item => !/AEO|GEO|LLMO|콘텐츠 그래프|검색 노출/.test(item.relationLabel)),
    'reader-facing relation labels should avoid internal optimization language',
  )
}

console.log('blog content graph verification passed')
