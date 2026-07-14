export type ApprovedManuscriptCategory =
  | 'case_study'
  | 'product_guide'
  | 'customer_qa'
  | 'field_knowhow'
  | 'price_guide'
  | 'area_guide'

export type ApprovedManuscriptBlockType =
  | 'heading'
  | 'paragraph'
  | 'cta'
  | 'qa'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type ApprovedManuscriptBlock = {
  type: ApprovedManuscriptBlockType | string
  headingLevel?: number | null
  text?: string | null
  mediaId?: string | null
  metadata?: Record<string, unknown>
}

export type ApprovedManuscriptPayload = {
  title: string
  slug: string
  category: ApprovedManuscriptCategory | string
  excerpt: string
  seoTitle: string
  metaDescription: string
  canonicalUrl?: string | null
  primaryKeyword?: string | null
  keywords?: string[]
  targetQuestion: string
  summaryAnswer: string
  relatedQuestions?: string[]
  serviceArea?: string | null
  productType?: string | null
  sourceEvidence: Array<Record<string, unknown>>
  blocks: ApprovedManuscriptBlock[]
}

export type ApprovedManuscriptClaimSafetyInput = {
  mode: 'draft'
  title: string
  textSegments: string[]
  sourceEvidence: Array<Record<string, JsonValue>>
}

export type ApprovedManuscriptClaimSafetyResult = {
  passed: boolean
  status: 'passed' | 'warning' | 'blocked'
  evidenceCount: number
  blockers: string[]
  warnings: string[]
  issues: unknown[]
  forbiddenTerms: string[]
}

export type ApprovedManuscriptPostInsert = {
  title: string
  slug: string
  excerpt: string
  seo_title: string
  meta_description: string
  canonical_url: string | null
  status: 'reviewing'
  category: ApprovedManuscriptCategory
  primary_keyword: string | null
  target_question: string
  summary_answer: string
  related_questions: string[]
  service_area: string | null
  product_type: string | null
  source_evidence: Array<Record<string, JsonValue>>
  brand_check_result: Record<string, JsonValue>
  ai_model: null
  source_prompt: null
  ai_citation_ready: false
  last_fact_checked_at: null
  media_missing_reason: null
  created_by: string
  reviewed_by: null
  published_by: null
  published_at: null
}

export type ApprovedManuscriptBlockInsert = {
  post_id: string
  display_order: number
  type: ApprovedManuscriptBlockType
  heading_level: number | null
  text: string | null
  media_id: string | null
  metadata: Record<string, JsonValue>
}

export type ApprovedManuscriptEventInsert = {
  post_id: string
  actor_id: string
  event_type: 'manuscript_registered'
  from_status: null
  to_status: 'reviewing'
  memo: '승인된 외부 원고가 콘텐츠 큐에 등록되었습니다.'
  metadata: { intake: 'approved_manuscript' }
}

export type ApprovedManuscriptRepository = {
  validateClaimSafety: (
    input: ApprovedManuscriptClaimSafetyInput,
  ) => ApprovedManuscriptClaimSafetyResult | Promise<ApprovedManuscriptClaimSafetyResult>
  insertPost: (post: ApprovedManuscriptPostInsert) => Promise<{ id: string }>
  insertBlocks: (blocks: ApprovedManuscriptBlockInsert[]) => Promise<void>
  insertEvent: (event: ApprovedManuscriptEventInsert) => Promise<void>
  deletePost: (postId: string) => Promise<void>
}

export type ApprovedManuscriptResult = {
  ok: boolean
  message: string
  postId: string | null
  issues: string[]
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATEGORIES = new Set<ApprovedManuscriptCategory>([
  'case_study',
  'product_guide',
  'customer_qa',
  'field_knowhow',
  'price_guide',
  'area_guide',
])
const BLOCK_TYPES = new Set<ApprovedManuscriptBlockType>([
  'heading',
  'paragraph',
  'cta',
  'qa',
])
const TRACEABLE_EVIDENCE_STATUSES = new Set(['publishable', 'vetted'])

function cleanText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function cleanParagraphText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeJson(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'string') return cleanText(value)
  if (Array.isArray(value)) {
    const items = value.map(normalizeJson)
    return items.every((item): item is JsonValue => item !== undefined) ? items : undefined
  }
  if (!isRecord(value)) return undefined

  const normalized: Record<string, JsonValue> = {}
  for (const [key, item] of Object.entries(value)) {
    const normalizedItem = normalizeJson(item)
    if (normalizedItem === undefined) return undefined
    normalized[key] = normalizedItem
  }
  return normalized
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(cleanText).filter(Boolean)
}

function nestedText(value: JsonValue): string[] {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) return value.flatMap(nestedText)
  if (value && typeof value === 'object') return Object.values(value).flatMap(nestedText)
  return []
}

function valueFromKeys(value: Record<string, JsonValue>, keys: string[]) {
  for (const key of keys) {
    const candidate = cleanText(value[key])
    if (candidate) return candidate
  }
  return ''
}

function normalizeEvidence(value: unknown) {
  const normalized = normalizeJson(value)
  if (!normalized || Array.isArray(normalized) || typeof normalized !== 'object') return null

  const reference = valueFromKeys(normalized, ['claim_id', 'claimId', 'proof_id', 'proofId', 'asset_id', 'assetId', 'source_id', 'sourceId', 'ref'])
  const status = valueFromKeys(normalized, ['status', 'claim_status', 'claimStatus', 'usage_status', 'usageStatus'])
  if (!reference || !TRACEABLE_EVIDENCE_STATUSES.has(status)) return null

  return normalized
}

function normalizeBlock(value: ApprovedManuscriptBlock) {
  if (!value || !BLOCK_TYPES.has(value.type as ApprovedManuscriptBlockType)) return null

  const type = value.type as ApprovedManuscriptBlockType
  const text = (type === 'paragraph' ? cleanParagraphText(value.text) : cleanText(value.text)) || null
  const mediaId = cleanText(value.mediaId) || null
  const metadata = normalizeJson(value.metadata ?? {})
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return null

  const headingLevel = value.headingLevel ?? null
  if (headingLevel !== null && (!Number.isInteger(headingLevel) || headingLevel < 2 || headingLevel > 4)) {
    return null
  }
  if (mediaId) return null
  if (type === 'qa' && !cleanText(metadata.answer)) return null
  const hasMeaningfulMetadataText = nestedText(metadata).length > 0
  if (!text && !hasMeaningfulMetadataText) return null

  return { type, text, mediaId, metadata, headingLevel }
}

function failure(message: string, issues: string[] = []): ApprovedManuscriptResult {
  return { ok: false, message, postId: null, issues }
}

export function requireApprovedManuscriptAdministrator(role: string | null | undefined) {
  if (role !== 'administrator') {
    throw new Error('관리자만 저장할 수 있습니다.')
  }
}

export async function registerApprovedManuscript(
  payload: ApprovedManuscriptPayload,
  actorId: string,
  repository: ApprovedManuscriptRepository,
  now: string,
): Promise<ApprovedManuscriptResult> {
  const title = cleanText(payload.title)
  const slug = cleanText(payload.slug)
  const category = payload.category as ApprovedManuscriptCategory
  const excerpt = cleanText(payload.excerpt)
  const seoTitle = cleanText(payload.seoTitle)
  const metaDescription = cleanText(payload.metaDescription)
  const targetQuestion = cleanText(payload.targetQuestion)
  const summaryAnswer = cleanText(payload.summaryAnswer)

  if (!cleanText(actorId)) return failure('관리자 정보를 확인하지 못했습니다.')
  if (!title) return failure('제목을 입력해야 합니다.')
  if (!slug || !SLUG_PATTERN.test(slug)) return failure('주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.')
  if (!CATEGORIES.has(category)) return failure('콘텐츠 분류가 올바르지 않습니다.')
  if (!excerpt || !seoTitle || !metaDescription) return failure('요약과 SEO 제목, 메타 설명을 모두 입력해야 합니다.')
  if (!targetQuestion || !summaryAnswer) return failure('대상 질문과 요약 답변을 모두 입력해야 합니다.')
  if (!Array.isArray(payload.sourceEvidence) || payload.sourceEvidence.length === 0) return failure('추적 가능한 근거를 하나 이상 입력해야 합니다.')
  if (!Array.isArray(payload.blocks) || payload.blocks.length === 0) return failure('본문 블록을 하나 이상 입력해야 합니다.')

  const sourceEvidenceCandidates = payload.sourceEvidence.map(normalizeEvidence)
  if (sourceEvidenceCandidates.some(evidence => evidence === null)) {
    return failure('근거에는 허용된 상태와 추적 가능한 참조값이 필요합니다.')
  }

  const sourceEvidence = sourceEvidenceCandidates as Array<Record<string, JsonValue>>
  const blockCandidates = payload.blocks.map(normalizeBlock)
  if (blockCandidates.some(block => block === null)) {
    return failure('본문 블록 형식 또는 필수 입력값이 올바르지 않습니다.')
  }

  const blocks = blockCandidates as Array<NonNullable<ReturnType<typeof normalizeBlock>>>

  const keywords = normalizeStringArray(payload.keywords)
  const relatedQuestions = normalizeStringArray(payload.relatedQuestions)
  const primaryKeyword = cleanText(payload.primaryKeyword) || null
  const canonicalUrl = cleanText(payload.canonicalUrl) || null
  const serviceArea = cleanText(payload.serviceArea) || null
  const productType = cleanText(payload.productType) || null
  const textSegments = [
    slug,
    excerpt,
    seoTitle,
    metaDescription,
    canonicalUrl,
    primaryKeyword,
    ...keywords,
    targetQuestion,
    summaryAnswer,
    ...relatedQuestions,
    serviceArea,
    productType,
    ...sourceEvidence.flatMap(nestedText),
    ...blocks.flatMap(block => [block.text ?? '', ...nestedText(block.metadata)]),
  ].filter((segment): segment is string => Boolean(segment))
  const claimSafety = await repository.validateClaimSafety({
    mode: 'draft',
    title,
    textSegments,
    sourceEvidence,
  })

  if (!claimSafety.passed || claimSafety.blockers.length > 0) {
    return failure('원고에 공개할 수 없는 표현 또는 개인정보가 있습니다.', claimSafety.blockers)
  }

  const post: ApprovedManuscriptPostInsert = {
    title,
    slug,
    excerpt,
    seo_title: seoTitle,
    meta_description: metaDescription,
    canonical_url: canonicalUrl,
    status: 'reviewing',
    category,
    primary_keyword: primaryKeyword,
    target_question: targetQuestion,
    summary_answer: summaryAnswer,
    related_questions: relatedQuestions,
    service_area: serviceArea,
    product_type: productType,
    source_evidence: sourceEvidence,
    brand_check_result: {
      intake: 'approved_manuscript',
      status: claimSafety.status,
      passed: claimSafety.passed,
      evidence_count: claimSafety.evidenceCount,
      blockers: claimSafety.blockers,
      warnings: claimSafety.warnings,
      forbidden_terms: claimSafety.forbiddenTerms,
      checked_at: now,
      intake_keywords: keywords,
    },
    ai_model: null,
    source_prompt: null,
    ai_citation_ready: false,
    last_fact_checked_at: null,
    media_missing_reason: null,
    created_by: actorId,
    reviewed_by: null,
    published_by: null,
    published_at: null,
  }

  let postId: string | null = null
  try {
    const createdPost = await repository.insertPost(post)
    postId = createdPost.id

    await repository.insertBlocks(blocks.map((block, index) => ({
      post_id: postId as string,
      display_order: index + 1,
      type: block.type,
      heading_level: block.headingLevel,
      text: block.text,
      media_id: block.mediaId,
      metadata: block.metadata,
    })))

    await repository.insertEvent({
      post_id: postId,
      actor_id: actorId,
      event_type: 'manuscript_registered',
      from_status: null,
      to_status: 'reviewing',
      memo: '승인된 외부 원고가 콘텐츠 큐에 등록되었습니다.',
      metadata: { intake: 'approved_manuscript' },
    })
  } catch (error) {
    const persistenceCode = isRecord(error) ? cleanText(error.code) : ''
    if (!postId && persistenceCode === 'duplicate_slug') {
      return failure('이미 사용 중인 주소입니다. slug를 바꾼 뒤 다시 등록해 주세요.')
    }

    if (postId) {
      try {
        await repository.deletePost(postId)
      } catch {
        // The original persistence error is the actionable result; cascade delete is best-effort.
      }
    }
    return failure('승인 원고를 콘텐츠 큐에 등록하지 못했습니다.')
  }

  return {
    ok: true,
    message: '승인 원고를 콘텐츠 큐에 등록했습니다.',
    postId,
    issues: claimSafety.warnings,
  }
}
