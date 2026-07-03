'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { generateBlogAiDraft, getBlogAiDraftConfig } from '@/lib/content-os/blog-ai-draft-engine'
import {
  parseBlogAiEvidenceJson,
  summarizeBlogAiDraftPrompt,
  validateBlogAiDraftInput,
  type BlogAiDraftInput,
  type BlogAiDraftNormalized,
} from '@/lib/content-os/blog-ai-draft-schema'
import { validateBlogClaimSafety } from '@/lib/content-os/blog-claim-safety'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { BlogContentCategory, Database, Json } from '@/types/database'

export type CreateBlogAiDraftPayload = {
  category: BlogContentCategory
  topic: string
  targetQuestion: string
  primaryKeyword: string
  serviceArea: string
  productType: string
  writingIntent: string
  evidenceJson: string
  needsImageSlots: boolean
}

export type CreateBlogAiDraftResult = {
  ok: boolean
  message: string
  postId?: string
  issues?: string[]
}

export type BlogAiDraftConfigView = {
  enabled: boolean
  reason: string | null
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

async function requireAdministrator() {
  const platformClient = await createPlatformClient()
  const { data: { user } } = await platformClient.auth.getUser()

  if (!user) redirect('/admin/login')

  const { data: profileData } = await platformClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'customer' | 'sales_manager' | 'administrator' } | null
  if (!profile || profile.role !== 'administrator') {
    throw new Error('관리자만 사용할 수 있습니다.')
  }

  return user.id
}

function toDraftInput(payload: CreateBlogAiDraftPayload): {
  ok: true
  input: BlogAiDraftInput
} | {
  ok: false
  issues: string[]
} {
  const evidenceRefs = parseBlogAiEvidenceJson(payload.evidenceJson)
  if (evidenceRefs === null) {
    return { ok: false, issues: ['근거 JSON 형식이 올바르지 않습니다.'] }
  }

  const input: BlogAiDraftInput = {
    category: payload.category,
    topic: cleanText(payload.topic) ?? '',
    targetQuestion: cleanText(payload.targetQuestion) ?? '',
    primaryKeyword: cleanText(payload.primaryKeyword) ?? undefined,
    serviceArea: cleanText(payload.serviceArea) ?? undefined,
    productType: cleanText(payload.productType) ?? undefined,
    writingIntent: cleanText(payload.writingIntent) ?? undefined,
    evidenceRefs,
    needsImageSlots: payload.needsImageSlots,
  }

  const issues = validateBlogAiDraftInput(input)
  if (issues.length > 0) return { ok: false, issues }

  return { ok: true, input }
}

function draftTextSegments(draft: BlogAiDraftNormalized) {
  return [
    draft.title,
    draft.excerpt,
    draft.seoTitle,
    draft.metaDescription,
    draft.targetQuestion,
    draft.summaryAnswer,
    draft.primaryKeyword,
    draft.serviceArea,
    draft.productType,
    ...draft.relatedQuestions,
    ...draft.blocks.flatMap(block => [block.text, ...Object.values((block.metadata ?? {}) as Record<string, string>)]),
  ]
}

function sanitizeInputForModel(input: BlogAiDraftInput): BlogAiDraftInput {
  return {
    ...input,
    evidenceRefs: input.evidenceRefs.map(evidence => ({
      ref: evidence.ref,
      claim_id: evidence.claim_id,
      proof_id: evidence.proof_id,
      asset_id: evidence.asset_id,
      source_id: evidence.source_id,
      status: evidence.status,
      type: evidence.type,
      checked_at: evidence.checked_at,
    })),
  }
}

async function uniqueSlug(baseSlug: string) {
  const showroomAdmin = createShowroomAdminClient()
  const safeBase = SLUG_PATTERN.test(baseSlug) ? baseSlug : `blog-${Date.now().toString(36)}`

  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? safeBase : `${safeBase}-${index + 1}`
    const { data, error } = await showroomAdmin
      .from('blog_posts')
      .select('id')
      .eq('slug', candidate)
      .limit(1)

    if (error) return null
    if (!data || data.length === 0) return candidate
  }

  return null
}

export async function getBlogAiDraftConfigView(): Promise<BlogAiDraftConfigView> {
  const config = getBlogAiDraftConfig()
  return {
    enabled: config.enabled,
    reason: config.reason,
  }
}

export async function createBlogAiDraft(payload: CreateBlogAiDraftPayload): Promise<CreateBlogAiDraftResult> {
  const actorId = await requireAdministrator()
  let insertedPostId: string | null = null

  try {
    const config = getBlogAiDraftConfig()

    if (!config.enabled) {
      return {
        ok: false,
        message: config.reason ?? 'AI 초안 생성이 비활성화되어 있습니다.',
      }
    }

    const parsedInput = toDraftInput(payload)
    if (!parsedInput.ok) {
      return {
        ok: false,
        message: 'AI 초안 생성 입력을 확인해주세요.',
        issues: parsedInput.issues,
      }
    }

    const inputSafety = validateBlogClaimSafety({
      mode: 'draft',
      title: parsedInput.input.topic,
      textSegments: [
        parsedInput.input.targetQuestion,
        parsedInput.input.primaryKeyword,
        parsedInput.input.serviceArea,
        parsedInput.input.productType,
        parsedInput.input.writingIntent,
      ],
      sourceEvidence: parsedInput.input.evidenceRefs,
    })

    if (inputSafety.blockers.length > 0) {
      return {
        ok: false,
        message: 'AI 호출 전에 근거 입력에서 민감정보 또는 금지 표현을 감지했습니다.',
        issues: inputSafety.blockers,
      }
    }

    const sanitizedInput = sanitizeInputForModel(parsedInput.input)
    const generated = await generateBlogAiDraft(sanitizedInput)
    if (!generated.ok) {
      return {
        ok: false,
        message: generated.message,
        issues: generated.issues,
      }
    }

    const safety = validateBlogClaimSafety({
      mode: 'draft',
      title: generated.draft.title,
      textSegments: draftTextSegments(generated.draft),
      sourceEvidence: sanitizedInput.evidenceRefs,
    })

    if (safety.blockers.length > 0) {
      return {
        ok: false,
        message: 'AI 초안에서 공개 불가 표현 또는 민감정보 위험을 감지했습니다.',
        issues: safety.blockers,
      }
    }

    const slug = await uniqueSlug(generated.draft.slug)
    if (!slug) {
      return {
        ok: false,
        message: '중복되지 않는 글 주소를 만들지 못했습니다.',
      }
    }

    const now = new Date().toISOString()
    const sourcePrompt = summarizeBlogAiDraftPrompt(sanitizedInput)
    const brandCheckResult: Json = {
      source: 'ai_draft_generator',
      status: safety.status,
      passed: safety.passed,
      blockers: safety.blockers,
      warnings: safety.warnings,
      forbidden_terms: safety.forbiddenTerms,
      checked_at: now,
      response_id: generated.responseId,
    }

    const postInsert: Database['showroom']['Tables']['blog_posts']['Insert'] = {
      title: generated.draft.title,
      slug,
      excerpt: generated.draft.excerpt,
      seo_title: generated.draft.seoTitle,
      meta_description: generated.draft.metaDescription,
      canonical_url: null,
      status: 'ai_draft',
      category: parsedInput.input.category,
      primary_keyword: generated.draft.primaryKeyword,
      target_question: generated.draft.targetQuestion,
      summary_answer: generated.draft.summaryAnswer,
      related_questions: generated.draft.relatedQuestions as unknown as Json,
      service_area: generated.draft.serviceArea,
      product_type: generated.draft.productType,
        source_evidence: sanitizedInput.evidenceRefs as unknown as Json,
      brand_check_result: brandCheckResult,
      ai_model: generated.model,
      source_prompt: sourcePrompt,
      ai_citation_ready: false,
      last_fact_checked_at: null,
      media_missing_reason: parsedInput.input.needsImageSlots ? 'AI 초안 생성 후 운영자 사진 검수가 필요합니다.' : null,
      created_by: actorId,
      reviewed_by: null,
      published_by: null,
      published_at: null,
      created_at: now,
      updated_at: now,
    }

    const showroomAdmin = createShowroomAdminClient()
    const { data: postData, error: postError } = await showroomAdmin
      .from('blog_posts')
      .insert(postInsert as never)
      .select('id')
      .single()

    if (postError || !postData) {
      return {
        ok: false,
        message: 'AI 초안을 저장하지 못했습니다.',
      }
    }

    insertedPostId = (postData as { id: string }).id

    const blockRows: Database['showroom']['Tables']['blog_blocks']['Insert'][] = generated.draft.blocks.map((block, index) => ({
      post_id: insertedPostId as string,
      display_order: index + 1,
      type: block.type,
      heading_level: block.headingLevel,
      text: block.text,
      media_id: null,
      metadata: block.metadata as unknown as Json,
      created_at: now,
      updated_at: now,
    }))

    const { error: blockError } = await showroomAdmin
      .from('blog_blocks')
      .insert(blockRows as never)

    if (blockError) {
      await showroomAdmin.from('blog_posts').delete().eq('id', insertedPostId)
      insertedPostId = null
      return {
        ok: false,
        message: 'AI 초안 본문 블록을 저장하지 못했습니다.',
      }
    }

    const { error: eventError } = await showroomAdmin
      .from('blog_post_events')
      .insert({
        post_id: insertedPostId,
        actor_id: actorId,
        event_type: 'ai_draft_generated',
        from_status: null,
        to_status: 'ai_draft',
        memo: 'AI 초안이 생성되었습니다. 발행 전 사람이 검수해야 합니다.',
        metadata: {
          model: generated.model,
          response_id: generated.responseId,
          safety_status: safety.status,
          warning_count: safety.warnings.length,
        },
      } as never)

    if (eventError) {
      await showroomAdmin.from('blog_posts').delete().eq('id', insertedPostId)
      insertedPostId = null
      return {
        ok: false,
        message: 'AI 초안 생성 이벤트를 기록하지 못했습니다.',
      }
    }

    revalidatePath('/admin/platform/blog')
    revalidatePath(`/admin/platform/blog/${insertedPostId}`)

    return {
      ok: true,
      message: 'AI 초안을 생성했습니다. 검토 후 발행대기로 올려주세요.',
      postId: insertedPostId,
      issues: safety.warnings,
    }
  } catch {
    if (insertedPostId) {
      await createShowroomAdminClient().from('blog_posts').delete().eq('id', insertedPostId)
    }

    return {
      ok: false,
      message: 'AI 초안 생성 중 오류가 발생했습니다.',
    }
  }
}
