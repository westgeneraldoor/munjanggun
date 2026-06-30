export type BlogHomePost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string
  categoryLabel: string
  primaryKeyword: string | null
  targetQuestion: string | null
  summaryAnswer: string | null
  serviceArea: string | null
  productType: string | null
  publishedAt: string | null
  coverMedia: {
    url: string | null
    altText: string | null
  } | null
}

export type BlogHomeCategory = {
  value: string
  label: string
  count: number
}

export type BlogHomeTopic = {
  id: string
  title: string
  description: string
  categories: string[]
  keywords: string[]
}

export type BlogHomeCategoryGroup = {
  category: BlogHomeCategory
  posts: BlogHomePost[]
  totalCount: number
}

export type BlogHomeModel = {
  allPosts: BlogHomePost[]
  starterPosts: BlogHomePost[]
  latestPosts: BlogHomePost[]
  categoryGroups: BlogHomeCategoryGroup[]
  threadItems: string[]
  topicCounts: Record<string, number>
  showAllPosts: boolean
}

export const BLOG_INITIAL_VISIBLE_POSTS = 12
export const BLOG_STARTER_LIMIT = 3
export const BLOG_LATEST_LIMIT = 6
export const BLOG_CATEGORY_PREVIEW_LIMIT = 3
export const BLOG_CATEGORY_MINIMUM = 2

export const BLOG_TOPICS: BlogHomeTopic[] = [
  {
    id: 'choice',
    title: '중문과 도어 고르기',
    description: '제품명보다 우리 집 구조와 쓰임새를 먼저 보는 이야기',
    categories: ['product_guide', 'customer_qa'],
    keywords: ['중문', '도어', '문짝', '선택', '제품'],
  },
  {
    id: 'field',
    title: '현장에서 확인하는 것',
    description: '신발장, 스위치, 바닥 단차, 벽공간처럼 시공 전에 보는 조건',
    categories: ['field_knowhow'],
    keywords: ['현장', '구조', '신발장', '스위치', '단차', '벽공간'],
  },
  {
    id: 'price',
    title: '가격과 견적',
    description: '가격이 집마다 달라지는 이유와 실측 때 확인하는 항목',
    categories: ['price_guide'],
    keywords: ['가격', '견적', '추가금', '실측', '비용'],
  },
  {
    id: 'case',
    title: '시공 사례',
    description: '실제 집에서 어떤 문제를 어떻게 풀었는지 보는 기록',
    categories: ['case_study'],
    keywords: ['시공', '사례', '전후', '현관', '마감'],
  },
  {
    id: 'qa',
    title: '고객 질문',
    description: '상담에서 자주 묻는 질문을 짧고 쉽게 풀어둔 글',
    categories: ['customer_qa'],
    keywords: ['가능한가요', '왜', '어려운가요', '질문', 'Q&A'],
  },
  {
    id: 'making',
    title: '제작과 운영 이야기',
    description: '문장군이 직접 제작하고 전속 시공으로 운영하는 방식',
    categories: ['product_guide', 'field_knowhow'],
    keywords: ['제작', '공장', '전속', '운영', 'A/S', 'AS'],
  },
]

export function normalizeBlogText(value: string | null | undefined) {
  return value?.toLocaleLowerCase('ko-KR').trim() ?? ''
}

function publishedTime(value: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function sortByPublishedDesc(posts: BlogHomePost[]) {
  return [...posts].sort((a, b) => {
    const publishedDiff = publishedTime(b.publishedAt) - publishedTime(a.publishedAt)
    if (publishedDiff !== 0) return publishedDiff
    return a.title.localeCompare(b.title, 'ko-KR')
  })
}

export function searchableBlogText(post: BlogHomePost) {
  return [
    post.title,
    post.excerpt,
    post.categoryLabel,
    post.primaryKeyword,
    post.targetQuestion,
    post.summaryAnswer,
    post.serviceArea,
    post.productType,
  ]
    .map(normalizeBlogText)
    .join(' ')
}

export function matchesBlogTopic(post: BlogHomePost, topic: BlogHomeTopic) {
  if (topic.categories.includes(post.category)) return true

  const compactText = [post.primaryKeyword, post.productType, post.categoryLabel].map(normalizeBlogText).join(' ')

  if (topic.id === 'choice') {
    return ['중문', '도어', '문짝', '제품'].some(keyword => compactText.includes(keyword))
  }

  if (topic.id === 'field') {
    return ['현장', '구조', '신발장', '스위치', '단차'].some(keyword => compactText.includes(keyword))
  }

  if (topic.id === 'price') {
    return ['가격', '견적', '추가금', '비용'].some(keyword => compactText.includes(keyword))
  }

  if (topic.id === 'making') {
    return ['제작', '공장', '전속', '운영'].some(keyword => compactText.includes(keyword))
  }

  return topic.keywords.some(keyword => compactText.includes(normalizeBlogText(keyword)))
}

export function searchBlogPosts(posts: BlogHomePost[], query: string) {
  const normalizedQuery = normalizeBlogText(query)
  if (!normalizedQuery) return []

  return sortByPublishedDesc(posts).filter(post => searchableBlogText(post).includes(normalizedQuery))
}

export function selectTopicPosts(posts: BlogHomePost[], topicId: string) {
  const sortedPosts = sortByPublishedDesc(posts)
  if (topicId === 'all') return sortedPosts

  const topic = BLOG_TOPICS.find(item => item.id === topicId)
  if (!topic) return []

  return sortedPosts.filter(post => matchesBlogTopic(post, topic))
}

function starterLimitFor(totalPosts: number) {
  if (totalPosts <= 1) return totalPosts
  if (totalPosts <= 6) return 1
  if (totalPosts <= 12) return 2
  return BLOG_STARTER_LIMIT
}

function latestLimitFor(totalPosts: number, remainingCount: number) {
  if (totalPosts <= BLOG_INITIAL_VISIBLE_POSTS) return remainingCount
  return BLOG_LATEST_LIMIT
}

function starterScore(post: BlogHomePost) {
  let score = 0

  if (post.targetQuestion) score += 5
  if (post.summaryAnswer) score += 4
  if (post.primaryKeyword) score += 2
  if (post.excerpt) score += 1

  if (post.category === 'customer_qa') score += 4
  if (post.category === 'product_guide') score += 3
  if (post.category === 'price_guide') score += 3
  if (post.category === 'field_knowhow') score += 2

  const customerQuestionText = normalizeBlogText([post.title, post.targetQuestion, post.primaryKeyword].filter(Boolean).join(' '))
  if (['왜', '가능', '가격', '견적', '고르', '교체', '시공', '추가금', '우리 집'].some(token => customerQuestionText.includes(token))) {
    score += 2
  }

  return score
}

function selectStarterPosts(posts: BlogHomePost[]) {
  const limit = starterLimitFor(posts.length)

  return [...posts]
    .map(post => ({
      post,
      score: starterScore(post),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return publishedTime(b.post.publishedAt) - publishedTime(a.post.publishedAt)
    })
    .slice(0, limit)
    .map(item => item.post)
}

function uniqueThreadItems(posts: BlogHomePost[]) {
  const seen = new Set<string>()

  return posts
    .flatMap(post => [post.targetQuestion, post.primaryKeyword, post.productType, post.serviceArea])
    .filter((value): value is string => Boolean(value?.trim()))
    .filter(value => {
      const key = normalizeBlogText(value)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
}

export function buildBlogHomeModel(posts: BlogHomePost[], categories: BlogHomeCategory[]): BlogHomeModel {
  const allPosts = sortByPublishedDesc(posts)
  const starterPosts = selectStarterPosts(allPosts)
  const starterIds = new Set(starterPosts.map(post => post.id))
  const latestCandidates = allPosts.filter(post => !starterIds.has(post.id))
  const latestPosts = latestCandidates.slice(0, latestLimitFor(allPosts.length, latestCandidates.length))
  const topicCounts = BLOG_TOPICS.reduce<Record<string, number>>((counts, topic) => {
    counts[topic.id] = allPosts.filter(post => matchesBlogTopic(post, topic)).length
    return counts
  }, { all: allPosts.length })

  const categoryGroups = categories
    .filter(category => category.value !== 'all')
    .map(category => {
      const categoryPosts = allPosts.filter(post => post.category === category.value)

      return {
        category,
        posts: categoryPosts.slice(0, BLOG_CATEGORY_PREVIEW_LIMIT),
        totalCount: categoryPosts.length,
      }
    })
    .filter(group => group.totalCount >= BLOG_CATEGORY_MINIMUM)

  return {
    allPosts,
    starterPosts,
    latestPosts,
    categoryGroups,
    threadItems: uniqueThreadItems(starterPosts),
    topicCounts,
    showAllPosts: allPosts.length > BLOG_INITIAL_VISIBLE_POSTS,
  }
}
