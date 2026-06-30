import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import ts from 'typescript'

const modelSourceUrl = new URL('../src/app/blog/blog-home-model.ts', import.meta.url)
const modelSource = await readFile(modelSourceUrl, 'utf8')
const transpiledModel = ts.transpileModule(modelSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    isolatedModules: true,
  },
}).outputText
const modelModuleUrl = `data:text/javascript;base64,${Buffer.from(transpiledModel).toString('base64')}`
const { BLOG_CATEGORY_MINIMUM, BLOG_LATEST_LIMIT, buildBlogHomeModel, searchBlogPosts, selectTopicPosts } = await import(
  modelModuleUrl
)

const categories = [
  { value: 'all', label: '전체', count: 0 },
  { value: 'customer_qa', label: '고객 질문', count: 0 },
  { value: 'product_guide', label: '제품과 선택', count: 0 },
  { value: 'field_knowhow', label: '현장 조건', count: 0 },
]

function post(overrides) {
  return {
    id: overrides.id,
    title: overrides.title ?? `${overrides.id} 제목`,
    slug: overrides.slug ?? overrides.id,
    excerpt: overrides.excerpt ?? null,
    category: overrides.category ?? 'customer_qa',
    categoryLabel: overrides.categoryLabel ?? '고객 질문',
    primaryKeyword: overrides.primaryKeyword ?? null,
    targetQuestion: overrides.targetQuestion ?? null,
    summaryAnswer: overrides.summaryAnswer ?? null,
    serviceArea: overrides.serviceArea ?? null,
    productType: overrides.productType ?? null,
    publishedAt: overrides.publishedAt ?? '2026-06-01T00:00:00.000Z',
    coverMedia: null,
  }
}

function manyPosts(count) {
  return Array.from({ length: count }, (_, index) => {
    const category = index % 3 === 0 ? 'customer_qa' : index % 3 === 1 ? 'product_guide' : 'field_knowhow'
    return post({
      id: `post-${index + 1}`,
      category,
      categoryLabel: categories.find(item => item.value === category)?.label ?? category,
      targetQuestion: index % 2 === 0 ? `우리 집 ${index + 1}번 조건도 가능한가요?` : null,
      summaryAnswer: index % 4 === 0 ? '현장 구조와 옵션을 확인하면 판단하기 쉽습니다.' : null,
      primaryKeyword: index % 5 === 0 ? '중문' : '도어',
      productType: index % 2 === 0 ? '3연동중문' : 'ABS도어',
      serviceArea: index % 7 === 0 ? '화성' : null,
      publishedAt: new Date(Date.UTC(2026, 5, 1, 0, count - index)).toISOString(),
    })
  })
}

{
  const latestWeak = post({
    id: 'latest-weak',
    title: '최근 소식',
    category: 'field_knowhow',
    categoryLabel: '현장 조건',
    publishedAt: '2026-06-30T00:00:00.000Z',
  })
  const starter = post({
    id: 'starter',
    title: '중문 가격은 왜 집마다 달라지나요?',
    category: 'customer_qa',
    categoryLabel: '고객 질문',
    targetQuestion: '중문 가격은 왜 집마다 달라지나요?',
    summaryAnswer: '가격은 현장 구조와 옵션에 따라 달라질 수 있습니다. 무료 방문실측에서 조건을 함께 확인합니다.',
    primaryKeyword: '중문 가격',
    publishedAt: '2026-06-01T00:00:00.000Z',
  })

  const model = buildBlogHomeModel([latestWeak, starter], categories)

  assert.equal(model.starterPosts[0]?.id, 'starter', 'starter section should not simply reuse the newest post')
  assert.equal(model.latestPosts[0]?.id, 'latest-weak', 'latest section should exclude starter posts and keep newest order')
}

{
  const model = buildBlogHomeModel(manyPosts(10), categories)
  const visibleIds = new Set([...model.starterPosts, ...model.latestPosts].map(item => item.id))

  assert.equal(visibleIds.size, 10, '10-post scenario should keep every post linked without needing an archive section')
  assert.equal(model.showAllPosts, false, '10-post scenario should avoid a duplicate all-posts section')
}

{
  const model = buildBlogHomeModel(manyPosts(50), categories)

  assert.ok(model.showAllPosts, '50 posts should expose the all-posts browsing section')
  assert.ok(model.categoryGroups.length > 0, '50 posts should produce category groups')
  assert.ok(
    model.categoryGroups.every(group => group.totalCount >= BLOG_CATEGORY_MINIMUM && group.posts.length <= 3),
    'category groups should be meaningful and capped',
  )
  assert.ok(model.latestPosts.length <= BLOG_LATEST_LIMIT, 'latest posts should stay compact')
}

{
  const model = buildBlogHomeModel(manyPosts(200), categories)

  assert.equal(model.allPosts.length, 200, '200-post scenario should keep the full browsable set')
  assert.ok(model.starterPosts.length <= 3, 'starter section should stay compact at 200 posts')
  assert.ok(model.categoryGroups.every(group => group.posts.length <= 3), 'category sections should not render huge lists')
}

{
  const posts = manyPosts(12)
  const results = searchBlogPosts(posts, '화성')
  const topicResults = selectTopicPosts(posts, 'field')

  assert.ok(results.length > 0, 'search should match service area and other customer-facing fields')
  assert.ok(topicResults.every(item => item.category === 'field_knowhow'), 'topic filter should return matching field-condition posts')
}

console.log('blog home model verification passed')
