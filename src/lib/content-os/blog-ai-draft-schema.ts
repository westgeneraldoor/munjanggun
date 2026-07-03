import type { BlogBlockType, BlogContentCategory } from '@/types/database'

export type BlogAiEvidenceStatus = 'publishable' | 'vetted' | 'candidate'

export type BlogAiDraftEvidence = {
  ref?: string
  claim_id?: string
  proof_id?: string
  asset_id?: string
  source_id?: string
  status: BlogAiEvidenceStatus
  type?: string
  checked_at?: string
  note?: string
}

export type BlogAiDraftInput = {
  category: BlogContentCategory
  topic: string
  targetQuestion: string
  primaryKeyword?: string
  serviceArea?: string
  productType?: string
  writingIntent?: string
  evidenceRefs: BlogAiDraftEvidence[]
  needsImageSlots: boolean
}

export type BlogAiDraftBlock =
  | {
      type: 'heading'
      text: string
      headingLevel: 2 | 3
      metadata?: Record<string, never>
    }
  | {
      type: 'paragraph'
      text: string
      headingLevel?: null
      metadata?: {
        intent?: string | null
        required_media?: string | null
        photo_slot_label?: string | null
      }
    }
  | {
      type: 'qa'
      text: string
      headingLevel?: null
      metadata: {
        answer: string
      }
    }
  | {
      type: 'cta'
      text: string
      headingLevel?: null
      metadata: {
        cta_kind: 'measure_consultation'
        href: '/portal/measure/new'
      }
    }

export type BlogAiDraftOutput = {
  title: string
  slug: string
  excerpt: string
  seoTitle: string
  metaDescription: string
  targetQuestion: string
  summaryAnswer: string
  relatedQuestions: string[]
  primaryKeyword: string
  serviceArea: string | null
  productType: string | null
  blocks: BlogAiDraftBlock[]
}

export type BlogAiDraftNormalized = Omit<BlogAiDraftOutput, 'blocks'> & {
  slug: string
  blocks: Array<{
    type: Extract<BlogBlockType, 'heading' | 'paragraph' | 'qa' | 'cta'>
    text: string
    headingLevel: 2 | 3 | null
    metadata: Record<string, string>
  }>
}

const BLOG_CATEGORY_VALUES = new Set<BlogContentCategory>([
  'case_study',
  'product_guide',
  'customer_qa',
  'field_knowhow',
  'price_guide',
  'area_guide',
])

const EVIDENCE_STATUSES = new Set<BlogAiEvidenceStatus>(['publishable', 'vetted', 'candidate'])
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PARAGRAPH_METADATA_KEYS = ['intent', 'required_media', 'photo_slot_label'] as const

export const BLOG_AI_DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 4, maxLength: 90 },
    slug: { type: 'string', minLength: 4, maxLength: 90 },
    excerpt: { type: 'string', minLength: 20, maxLength: 220 },
    seoTitle: { type: 'string', minLength: 10, maxLength: 90 },
    metaDescription: { type: 'string', minLength: 50, maxLength: 180 },
    targetQuestion: { type: 'string', minLength: 8, maxLength: 160 },
    summaryAnswer: { type: 'string', minLength: 20, maxLength: 360 },
    relatedQuestions: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: { type: 'string', minLength: 4, maxLength: 140 },
    },
    primaryKeyword: { type: 'string', minLength: 2, maxLength: 80 },
    serviceArea: { type: ['string', 'null'], maxLength: 80 },
    productType: { type: ['string', 'null'], maxLength: 80 },
    blocks: {
      type: 'array',
      minItems: 4,
      maxItems: 14,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['heading'] },
              text: { type: 'string', minLength: 2, maxLength: 90 },
              headingLevel: { type: 'number', enum: [2, 3] },
              metadata: {
                type: 'object',
                additionalProperties: false,
                properties: {},
                required: [],
              },
            },
            required: ['type', 'text', 'headingLevel', 'metadata'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['paragraph'] },
              text: { type: 'string', minLength: 20, maxLength: 1400 },
              headingLevel: { type: ['null'] },
              metadata: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  intent: { type: ['string', 'null'], maxLength: 80 },
                  required_media: { type: ['string', 'null'], maxLength: 120 },
                  photo_slot_label: { type: ['string', 'null'], maxLength: 120 },
                },
                required: ['intent', 'required_media', 'photo_slot_label'],
              },
            },
            required: ['type', 'text', 'headingLevel', 'metadata'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['qa'] },
              text: { type: 'string', minLength: 4, maxLength: 180 },
              headingLevel: { type: ['null'] },
              metadata: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  answer: { type: 'string', minLength: 20, maxLength: 900 },
                },
                required: ['answer'],
              },
            },
            required: ['type', 'text', 'headingLevel', 'metadata'],
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['cta'] },
              text: { type: 'string', minLength: 4, maxLength: 160 },
              headingLevel: { type: ['null'] },
              metadata: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  cta_kind: { type: 'string', enum: ['measure_consultation'] },
                  href: { type: 'string', enum: ['/portal/measure/new'] },
                },
                required: ['cta_kind', 'href'],
              },
            },
            required: ['type', 'text', 'headingLevel', 'metadata'],
          },
        ],
      },
    },
  },
  required: [
    'title',
    'slug',
    'excerpt',
    'seoTitle',
    'metaDescription',
    'targetQuestion',
    'summaryAnswer',
    'relatedQuestions',
    'primaryKeyword',
    'serviceArea',
    'productType',
    'blocks',
  ],
} as const

function cleanText(value: unknown) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return text.length > 0 ? text : null
}

function cleanLongText(value: unknown) {
  const text = typeof value === 'string'
    ? value
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    : ''
  return text.length > 0 ? text : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanMetadata(value: unknown, allowedKeys: readonly string[]) {
  if (!isRecord(value)) return {}

  return Object.fromEntries(allowedKeys.flatMap(key => {
    const cleaned = cleanText(value[key])
    return cleaned ? [[key, cleaned]] : []
  }))
}

function evidenceId(evidence: BlogAiDraftEvidence) {
  return evidence.ref ?? evidence.claim_id ?? evidence.proof_id ?? evidence.asset_id ?? evidence.source_id ?? ''
}

export function slugifyBlogDraft(value: string) {
  const ascii = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return SLUG_PATTERN.test(ascii) ? ascii : `blog-${Date.now().toString(36)}`
}

export function summarizeBlogAiDraftPrompt(input: BlogAiDraftInput) {
  return JSON.stringify({
    category: input.category,
    topic: input.topic,
    targetQuestion: input.targetQuestion,
    primaryKeyword: input.primaryKeyword ?? null,
    serviceArea: input.serviceArea ?? null,
    productType: input.productType ?? null,
    writingIntent: input.writingIntent ?? null,
    needsImageSlots: input.needsImageSlots,
    evidence: input.evidenceRefs.map(evidence => ({
      ref: evidenceId(evidence),
      status: evidence.status,
      type: evidence.type ?? null,
      checked_at: evidence.checked_at ?? null,
    })),
  })
}

export function validateBlogAiDraftInput(input: BlogAiDraftInput) {
  const issues: string[] = []

  if (!BLOG_CATEGORY_VALUES.has(input.category)) issues.push('글 유형을 선택해야 합니다.')
  if (!cleanText(input.topic)) issues.push('초안 주제가 필요합니다.')
  if (!cleanText(input.targetQuestion)) issues.push('대표 질문이 필요합니다.')
  if (input.evidenceRefs.length === 0) issues.push('최소 1개의 출처 근거가 필요합니다.')

  for (const evidence of input.evidenceRefs) {
    if (!EVIDENCE_STATUSES.has(evidence.status)) {
      issues.push('근거 상태는 publishable, vetted, candidate 중 하나여야 합니다.')
    }
    if (!evidenceId(evidence)) {
      issues.push('근거에는 ref, claim_id, proof_id, asset_id, source_id 중 하나가 필요합니다.')
    }
  }

  return [...new Set(issues)]
}

export function parseBlogAiEvidenceJson(value: string) {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isRecord)
      .map(item => ({
        ref: cleanText(item.ref) ?? undefined,
        claim_id: cleanText(item.claim_id ?? item.claimId) ?? undefined,
        proof_id: cleanText(item.proof_id ?? item.proofId) ?? undefined,
        asset_id: cleanText(item.asset_id ?? item.assetId) ?? undefined,
        source_id: cleanText(item.source_id ?? item.sourceId) ?? undefined,
        status: cleanText(item.status) as BlogAiEvidenceStatus,
        type: cleanText(item.type ?? item.claim_type ?? item.claimType) ?? undefined,
        checked_at: cleanText(item.checked_at ?? item.checkedAt ?? item.basis_date ?? item.basisDate) ?? undefined,
        note: cleanText(item.note) ?? undefined,
      }))
  } catch {
    return null
  }
}

export function normalizeBlogAiDraftOutput(raw: unknown, fallbackInput: BlogAiDraftInput): {
  ok: true
  draft: BlogAiDraftNormalized
} | {
  ok: false
  issues: string[]
} {
  const issues: string[] = []
  if (!isRecord(raw)) return { ok: false, issues: ['AI 응답이 객체 형식이 아닙니다.'] }

  const title = cleanText(raw.title)
  const slug = cleanText(raw.slug)
  const excerpt = cleanLongText(raw.excerpt)
  const seoTitle = cleanText(raw.seoTitle)
  const metaDescription = cleanText(raw.metaDescription)
  const targetQuestion = cleanText(raw.targetQuestion) ?? fallbackInput.targetQuestion
  const summaryAnswer = cleanLongText(raw.summaryAnswer)
  const primaryKeyword = cleanText(raw.primaryKeyword) ?? cleanText(fallbackInput.primaryKeyword) ?? cleanText(fallbackInput.topic)
  const serviceArea = cleanText(raw.serviceArea) ?? cleanText(fallbackInput.serviceArea)
  const productType = cleanText(raw.productType) ?? cleanText(fallbackInput.productType)
  const relatedQuestions = Array.isArray(raw.relatedQuestions)
    ? raw.relatedQuestions.map(cleanText).filter((item): item is string => Boolean(item)).slice(0, 5)
    : []

  if (!title) issues.push('AI 응답에 제목이 없습니다.')
  if (!excerpt) issues.push('AI 응답에 excerpt가 없습니다.')
  if (!seoTitle) issues.push('AI 응답에 SEO 제목이 없습니다.')
  if (!metaDescription) issues.push('AI 응답에 meta description이 없습니다.')
  if (!summaryAnswer) issues.push('AI 응답에 요약 답변이 없습니다.')
  if (!primaryKeyword) issues.push('AI 응답에 primary keyword가 없습니다.')
  if (relatedQuestions.length < 2) issues.push('관련 질문은 최소 2개가 필요합니다.')

  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.flatMap((block): BlogAiDraftNormalized['blocks'] => {
      if (!isRecord(block)) return []
      const type = cleanText(block.type)
      const text = cleanLongText(block.text)

      if (!text) return []
      if (type === 'heading') {
        const headingLevel = block.headingLevel === 3 ? 3 : 2
        return [{ type, text, headingLevel, metadata: {} }]
      }
      if (type === 'paragraph') {
        return [{
          type,
          text,
          headingLevel: null,
          metadata: cleanMetadata(block.metadata, PARAGRAPH_METADATA_KEYS),
        }]
      }
      if (type === 'qa') {
        const metadata = cleanMetadata(block.metadata, ['answer'])
        if (!metadata.answer) return []
        return [{ type, text, headingLevel: null, metadata: { answer: metadata.answer } }]
      }
      if (type === 'cta') {
        return [{
          type,
          text,
          headingLevel: null,
          metadata: {
            cta_kind: 'measure_consultation',
            href: '/portal/measure/new',
          },
        }]
      }
      return []
    })
    : []

  if (blocks.length === 0) issues.push('AI 응답에 본문 블록이 없습니다.')
  if (!blocks.some(block => block.type === 'cta')) issues.push('AI 응답에는 상담 CTA 블록이 필요합니다.')

  if (issues.length > 0 || !title || !excerpt || !seoTitle || !metaDescription || !summaryAnswer || !primaryKeyword) {
    return { ok: false, issues: [...new Set(issues)] }
  }

  return {
    ok: true,
    draft: {
      title,
      slug: slug && SLUG_PATTERN.test(slug) ? slug : slugifyBlogDraft(title || fallbackInput.topic),
      excerpt,
      seoTitle,
      metaDescription,
      targetQuestion,
      summaryAnswer,
      relatedQuestions,
      primaryKeyword,
      serviceArea,
      productType,
      blocks,
    },
  }
}
