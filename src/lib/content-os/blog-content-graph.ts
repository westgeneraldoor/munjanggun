export const BLOG_CONTENT_GRAPH_SECTION_LIMIT = 3

export type BlogContentGraphRelationKind =
  | 'same_product_type'
  | 'same_field_condition'
  | 'related_question'
  | 'same_topic'
  | 'read_next'

export type BlogContentGraphPost<TCover = unknown> = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  category: string
  primaryKeyword: string | null
  targetQuestion: string | null
  summaryAnswer: string | null
  relatedQuestions: string[]
  serviceArea: string | null
  productType: string | null
  publishedAt: string | null
  coverMedia: TCover
}

export type BlogContentGraphRelatedPost<TCover = unknown> = BlogContentGraphPost<TCover> & {
  relationKind: BlogContentGraphRelationKind
  relationLabel: string
  relationReason: string
  matchedTerms: string[]
  score: number
}

export type BlogContentGraphSection<TCover = unknown> = {
  id: 'same-product' | 'field-condition' | 'related-question'
  title: string
  description: string
  posts: BlogContentGraphRelatedPost<TCover>[]
}

export type BlogContentGraph<TCover = unknown> = {
  sections: BlogContentGraphSection<TCover>[]
  relatedPosts: BlogContentGraphRelatedPost<TCover>[]
  nextPost: BlogContentGraphRelatedPost<TCover> | null
}

type FieldTermRule = {
  label: string
  needles: string[]
}

const FIELD_TERM_RULES: FieldTermRule[] = [
  { label: '신발장', needles: ['신발장'] },
  { label: '스위치', needles: ['스위치', '콘센트'] },
  { label: '바닥 단차', needles: ['바닥 단차', '단차', '문턱', '턱'] },
  { label: '벽공간', needles: ['벽공간', '벽 공간', '벽면', '여유 공간'] },
  { label: '문틀', needles: ['문틀', '문틀세트', '틀'] },
  { label: '기둥', needles: ['기둥'] },
  { label: '몰딩', needles: ['몰딩'] },
  { label: '레일', needles: ['레일'] },
  { label: '현관 폭', needles: ['현관 폭', '폭', '너비', '사이즈'] },
  { label: '습기', needles: ['습기', '곰팡이', '화장실'] },
  { label: '소음', needles: ['소음', '방음'] },
  { label: '먼지', needles: ['먼지'] },
]

function normalizeGraphText(value: string | null | undefined) {
  return value?.toLocaleLowerCase('ko-KR').trim() ?? ''
}

function normalizedPostText(post: BlogContentGraphPost) {
  return [
    post.title,
    post.excerpt,
    post.primaryKeyword,
    post.targetQuestion,
    post.summaryAnswer,
    post.serviceArea,
    post.productType,
    ...post.relatedQuestions,
  ].map(normalizeGraphText).join(' ')
}

function publishedTime(value: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = normalizeGraphText(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function intersection(left: string[], right: string[]) {
  const rightSet = new Set(right.map(normalizeGraphText))
  return left.filter(value => rightSet.has(normalizeGraphText(value)))
}

function extractQuestionTokens(values: Array<string | null | undefined>) {
  const stopWords = new Set([
    '있는',
    '있나요',
    '되나요',
    '어떻게',
    '경우',
    '기준은',
    '무엇인가요',
    '가능한가요',
    '필요한',
    '필요할까요',
    '확인하나요',
  ])

  return uniqueValues(
    values
      .flatMap(value => normalizeGraphText(value).split(/[\s,./?？!！:：;；()[\]{}"'“”‘’·|]+/))
      .map(value => value.trim())
      .filter(value => value.length >= 2 && !stopWords.has(value)),
  )
}

function exactQuestionMatches(current: BlogContentGraphPost, candidate: BlogContentGraphPost) {
  const currentQuestions = [current.targetQuestion, ...current.relatedQuestions].map(normalizeGraphText).filter(Boolean)
  const candidateText = normalizedPostText(candidate)

  return currentQuestions.filter(question => question.length >= 6 && candidateText.includes(question))
}

function matchedQuestionTerms(current: BlogContentGraphPost, candidate: BlogContentGraphPost) {
  const candidateText = normalizedPostText(candidate)
  const directMatches = exactQuestionMatches(current, candidate)
  const tokens = extractQuestionTokens([
    current.targetQuestion,
    current.primaryKeyword,
    ...current.relatedQuestions,
  ])

  return uniqueValues([
    ...directMatches,
    ...tokens.filter(token => candidateText.includes(normalizeGraphText(token))),
  ]).slice(0, 5)
}

export function collectFieldConditionTerms(post: BlogContentGraphPost) {
  const text = normalizedPostText(post)

  return FIELD_TERM_RULES
    .filter(rule => rule.needles.some(needle => text.includes(normalizeGraphText(needle))))
    .map(rule => rule.label)
}

function relationLabelFor(kind: BlogContentGraphRelationKind) {
  if (kind === 'same_product_type') return '같은 제품군'
  if (kind === 'same_field_condition') return '비슷한 현장 조건'
  if (kind === 'related_question') return '관련 질문'
  if (kind === 'same_topic') return '같은 주제'
  return '이어 읽기'
}

function relationReasonFor(
  current: BlogContentGraphPost,
  candidate: BlogContentGraphPost,
  kind: BlogContentGraphRelationKind,
  matchedTerms: string[],
) {
  if (kind === 'same_product_type' && current.productType) {
    return `${current.productType}을 함께 다룹니다.`
  }

  if (kind === 'same_field_condition' && matchedTerms.length > 0) {
    return `${matchedTerms.slice(0, 2).join(', ')} 조건을 함께 확인합니다.`
  }

  if (kind === 'related_question') {
    return '비슷한 고객 질문에서 이어서 볼 수 있습니다.'
  }

  if (kind === 'same_topic') {
    if (current.primaryKeyword && current.primaryKeyword === candidate.primaryKeyword) {
      return `${current.primaryKeyword} 기준으로 이어집니다.`
    }
    return '같은 주제 안에서 함께 볼 수 있습니다.'
  }

  return '다음으로 읽기 좋은 글입니다.'
}

function scoreCandidate<TCover>(
  current: BlogContentGraphPost<TCover>,
  candidate: BlogContentGraphPost<TCover>,
): BlogContentGraphRelatedPost<TCover> {
  const currentProduct = normalizeGraphText(current.productType)
  const candidateProduct = normalizeGraphText(candidate.productType)
  const sameProduct = Boolean(currentProduct && currentProduct === candidateProduct)
  const sameArea = Boolean(current.serviceArea && current.serviceArea === candidate.serviceArea)
  const sameKeyword = Boolean(current.primaryKeyword && current.primaryKeyword === candidate.primaryKeyword)
  const sameCategory = current.category === candidate.category
  const fieldTerms = intersection(collectFieldConditionTerms(current), collectFieldConditionTerms(candidate))
  const directQuestionMatches = exactQuestionMatches(current, candidate)
  const questionTerms = matchedQuestionTerms(current, candidate)

  let score = 0
  if (sameProduct) score += 60
  if (fieldTerms.length > 0) score += 46 + fieldTerms.length * 4
  if (questionTerms.length > 0) score += 34 + Math.min(questionTerms.length, 3) * 3
  if (sameKeyword) score += 18
  if (sameArea) score += 12
  if (sameCategory) score += 8

  let relationKind: BlogContentGraphRelationKind = 'read_next'
  let matchedTerms: string[] = []

  if (sameProduct) {
    relationKind = 'same_product_type'
    matchedTerms = current.productType ? [current.productType] : []
  } else if (directQuestionMatches.length > 0) {
    relationKind = 'related_question'
    matchedTerms = questionTerms
  } else if (fieldTerms.length > 0) {
    relationKind = 'same_field_condition'
    matchedTerms = fieldTerms
  } else if (questionTerms.length > 0) {
    relationKind = 'related_question'
    matchedTerms = questionTerms
  } else if (sameKeyword || sameArea || sameCategory) {
    relationKind = 'same_topic'
    matchedTerms = uniqueValues([current.primaryKeyword ?? '', current.serviceArea ?? '', current.category])
  }

  return {
    ...candidate,
    relationKind,
    relationLabel: relationLabelFor(relationKind),
    relationReason: relationReasonFor(current, candidate, relationKind, matchedTerms),
    matchedTerms,
    score,
  }
}

function sortRelatedPosts<TCover>(posts: BlogContentGraphRelatedPost<TCover>[]) {
  return [...posts].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const timeDiff = publishedTime(b.publishedAt) - publishedTime(a.publishedAt)
    if (timeDiff !== 0) return timeDiff
    return a.title.localeCompare(b.title, 'ko-KR')
  })
}

function sectionConfig(sectionId: BlogContentGraphSection['id']) {
  if (sectionId === 'same-product') {
    return {
      title: '같은 제품군 글',
      description: '제품 이름은 같아도 집 구조와 옵션에 따라 확인할 점이 달라집니다.',
    }
  }

  if (sectionId === 'field-condition') {
    return {
      title: '비슷한 현장 조건',
      description: '신발장, 스위치, 단차처럼 현장에서 함께 봐야 하는 조건을 묶었습니다.',
    }
  }

  return {
    title: '같이 보면 좋은 질문',
    description: '상담에서 이어서 자주 나오는 질문을 가까운 글로 연결했습니다.',
  }
}

function buildSection<TCover>(
  sectionId: BlogContentGraphSection['id'],
  posts: BlogContentGraphRelatedPost<TCover>[],
  usedIds: Set<string>,
): BlogContentGraphSection<TCover> | null {
  const config = sectionConfig(sectionId)
  const sectionPosts = posts
    .filter(post => !usedIds.has(post.id))
    .slice(0, BLOG_CONTENT_GRAPH_SECTION_LIMIT)

  if (sectionPosts.length === 0) return null

  for (const post of sectionPosts) {
    usedIds.add(post.id)
  }

  return {
    id: sectionId,
    title: config.title,
    description: config.description,
    posts: sectionPosts,
  }
}

export function buildBlogContentGraph<TCover>(
  current: BlogContentGraphPost<TCover>,
  posts: BlogContentGraphPost<TCover>[],
): BlogContentGraph<TCover> {
  const ranked = sortRelatedPosts(
    posts
      .filter(post => post.id !== current.id)
      .map(post => scoreCandidate(current, post)),
  )
  const scored = ranked.filter(post => post.score > 0)
  const usedIds = new Set<string>()
  const sections = [
    buildSection('same-product', scored.filter(post => post.relationKind === 'same_product_type'), usedIds),
    buildSection('field-condition', scored.filter(post => post.relationKind === 'same_field_condition'), usedIds),
    buildSection('related-question', scored.filter(post => post.relationKind === 'related_question'), usedIds),
  ].filter((section): section is BlogContentGraphSection<TCover> => Boolean(section))

  const relatedPosts = sections.flatMap(section => section.posts)

  if (relatedPosts.length === 0 && ranked[0]) {
    const fallbackPosts = ranked.slice(0, BLOG_CONTENT_GRAPH_SECTION_LIMIT).map(post => {
      const fallbackKind: BlogContentGraphRelationKind = post.score > 0 ? post.relationKind : 'read_next'

      return {
        ...post,
        relationKind: fallbackKind,
        relationLabel: post.score > 0 ? post.relationLabel : relationLabelFor('read_next'),
        relationReason: post.score > 0 ? post.relationReason : relationReasonFor(current, post, fallbackKind, []),
      }
    })
    const fallbackIds = new Set(fallbackPosts.map(post => post.id))

    return {
      sections: [],
      relatedPosts: fallbackPosts,
      nextPost: ranked.find(post => !fallbackIds.has(post.id)) ?? null,
    }
  }

  const nextPost = ranked.find(post => !usedIds.has(post.id)) ?? null

  return {
    sections,
    relatedPosts,
    nextPost,
  }
}
