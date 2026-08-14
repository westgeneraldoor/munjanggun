'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { inspectContentAssetImage } from '@/lib/content-assets/content-asset-validation.mjs'
import { centralBrandPublicationBlocker } from '@/lib/content-assets/official-brand-publication.mjs'
import { validateBlogClaimSafety } from '@/lib/content-os/blog-claim-safety'
import { isAllowedManualBlogStatusTransition } from '@/lib/content-os/blog-status-transitions'
import { hasCoverOrRecordedMediaException } from '@/lib/content-os/blog-media-policy'
import { prepareBlogMediaForPublication } from '@/lib/content-os/blog-media-publication.mjs'
import {
  normalizeChecklistBlock,
  normalizeGuideBoxBlock,
  normalizeLinkButtonBlock,
  normalizePlaceBlock,
  normalizeQuizBlock,
  normalizeQuoteBlock,
  normalizeVideoBlock,
} from '@/lib/content-os/blog-body-blocks'
import { createPlatformAdminClient, createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { BlogBlockType, BlogContentCategory, BlogMediaUsageStatus, BlogPostStatus, Database, Json } from '@/types/database'

type SaveableBlock = {
  id: string | null
  type: BlogBlockType
  headingLevel: number | null
  text: string | null
  mediaId: string | null
  metadata: Record<string, string>
}

export type SaveBlogEditorPayload = {
  postId: string
  expectedUpdatedAt: string
  post: {
    title: string
    slug: string
    excerpt: string | null
    category: BlogContentCategory
    seoTitle: string | null
    metaDescription: string | null
    canonicalUrl: string | null
    primaryKeyword: string | null
    targetQuestion: string | null
    summaryAnswer: string | null
    relatedQuestions: string[]
    serviceArea: string | null
    productType: string | null
    aiCitationReady: boolean
    mediaMissingReason: string | null
  }
  blocks: SaveableBlock[]
}

export type SaveBlogEditorResult = {
  ok: true
  message: string
  updatedAt: string
  blockIds: string[]
  code?: undefined
} | {
  ok: false
  message: string
  code?: 'stale_revision'
}

export type MediaActionResult = {
  ok: boolean
  message: string
}

export type ContentAssetBlogMedia = {
  id: string
  sourceLabel: string | null
  usageStatus: BlogMediaUsageStatus
  altText: string | null
  caption: string | null
  privacyChecked: boolean
  promotionConsentChecked: boolean
  usedAsCover: boolean
  previewUrl: string | null
  approvedAt: string | null
  createdAt: string
}

export type AttachContentAssetResult = {
  ok: boolean
  message: string
  media?: ContentAssetBlogMedia
}

export type PublishBlogPostResult = {
  ok: true
  message: string
  publishedAt: string
  updatedAt: string
  slug: string
  issues?: string[]
  code?: undefined
} | {
  ok: false
  message: string
  issues?: string[]
  code?: 'stale_revision' | 'publication_unknown'
}

export type PermanentlyDeleteBlogPostResult = {
  ok: boolean
  message: string
}

export type UpdateBlogPostStatusResult = {
  ok: true
  message: string
  status: BlogPostStatus
  updatedAt: string
  issues?: string[]
  code?: never
} | {
  ok: false
  message: string
  issues?: string[]
  code?: 'revision_unknown'
}

export type UpdateBlogMediaPayload = {
  postId: string
  mediaId: string
  altText: string | null
  caption: string | null
  sourceLabel: string | null
  privacyChecked: boolean
  promotionConsentChecked: boolean
  usedAsCover: boolean
  usageStatus: BlogMediaUsageStatus
  rejectionReason: string | null
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PRIVATE_MEDIA_BUCKET = 'blog-media-private'
const PUBLIC_MEDIA_BUCKET = 'blog-media'
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
type BlogPost = Database['showroom']['Tables']['blog_posts']['Row']
type BlogBlock = Database['showroom']['Tables']['blog_blocks']['Row']
type BlogMedia = Database['showroom']['Tables']['blog_media']['Row']
type ContentAsset = Database['showroom']['Tables']['content_assets']['Row']
type ContentAssetFile = Database['showroom']['Tables']['content_asset_files']['Row']

type BlogQuestionApproval = {
  questionId: string
  blockId: string
  approvedQuestion: string
  approvedAnswer: string
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function isJsonObject(value: Json): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function jsonString(value: Json | undefined) {
  return typeof value === 'string' ? value : ''
}

function hasForbiddenExpression(value: Json) {
  if (!isJsonObject(value)) return false

  const warningCount =
    (Array.isArray(value.warnings) ? value.warnings.length : 0) +
    (Array.isArray(value.forbidden_terms) ? value.forbidden_terms.length : 0) +
    (Array.isArray(value.prohibited_terms) ? value.prohibited_terms.length : 0) +
    (Array.isArray(value.blockers) ? value.blockers.length : 0)

  return (
    value.passed === false ||
    jsonString(value.status) === 'failed' ||
    jsonString(value.status) === 'blocked' ||
    warningCount > 0
  )
}

function blockTextSegments(blocks: BlogBlock[]) {
  return blocks.flatMap(block => {
    const segments = [block.text]
    if (isJsonObject(block.metadata)) {
      segments.push(
        jsonString(block.metadata.title),
        jsonString(block.metadata.description),
        jsonString(block.metadata.answer),
      )
    }
    return segments
  })
}

function claimSafetyBlockers(post: BlogPost, blocks: BlogBlock[], mode: 'ready' | 'publish') {
  const result = validateBlogClaimSafety({
    mode,
    title: post.title,
    textSegments: [
      post.excerpt,
      post.seo_title,
      post.meta_description,
      post.primary_keyword,
      post.target_question,
      post.summary_answer,
      post.service_area,
      post.product_type,
      ...blockTextSegments(blocks),
    ],
    sourceEvidence: post.source_evidence,
    brandCheckResult: post.brand_check_result,
  })

  return result.blockers
}

function mediaTextSafetyBlockers(post: BlogPost, media: BlogMedia[], mode: 'ready' | 'publish') {
  if (media.length === 0) return []

  const result = validateBlogClaimSafety({
    mode,
    textSegments: media.flatMap(item => [item.alt_text, item.caption, item.source_label]),
    sourceEvidence: post.source_evidence,
  })

  return result.blockers
}

async function requireAdministrator() {
  const platformClient = await createPlatformClient()
  const { data: { user } } = await platformClient.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data: profileData } = await platformClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'customer' | 'sales_manager' | 'administrator' } | null

  if (!profile || profile.role !== 'administrator') {
    throw new Error('관리자만 저장할 수 있습니다.')
  }

  return user.id
}

function validatePayload(payload: SaveBlogEditorPayload) {
  const title = cleanText(payload.post.title)
  const slug = cleanText(payload.post.slug)

  if (!payload.postId) return '글 ID가 없습니다.'
  if (!payload.expectedUpdatedAt || Number.isNaN(Date.parse(payload.expectedUpdatedAt))) {
    return '편집 기준 시각이 없습니다. 새로고침 후 다시 저장해주세요.'
  }
  if (!title) return '제목을 입력해야 합니다.'
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return '주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'
  }
  if ((payload.post.mediaMissingReason?.trim().length ?? 0) > 500) {
    return '대표사진이 없을 때 사유는 500자 이내로 입력해 주세요.'
  }

  for (const block of payload.blocks) {
    if (block.type === 'image' && !block.mediaId) {
      return '이미지 블록에는 사진 선택이 필요합니다.'
    }

    if (block.type !== 'image') {
      const hasText = Boolean(cleanText(block.text))
      const hasMetadata = Object.values(block.metadata).some(value => cleanText(value))
      if (!hasText && !hasMetadata) {
        return '비어 있는 본문 카드가 있습니다.'
      }
    }
  }

  for (const block of payload.blocks) {
    const input = { text: block.text, metadata: block.metadata }
    if (block.type === 'link_button' && !normalizeLinkButtonBlock(input)) return '링크 버튼은 공개 가능한 내부 링크와 버튼 문구가 필요합니다.'
    if (block.type === 'guide_box' && !normalizeGuideBoxBlock(input)) return '안내 박스의 본문을 입력해 주세요.'
    if (block.type === 'quote' && !normalizeQuoteBlock(input)) return '인용문을 입력해 주세요. 출처 URL은 https 주소만 사용할 수 있습니다.'
    if (block.type === 'video' && !normalizeVideoBlock(input)) return '영상 블록은 유효한 YouTube URL만 사용할 수 있습니다.'
    if (block.type === 'place' && !normalizePlaceBlock(input)) return '장소 블록은 Kakao, Naver, Google 지도 링크와 장소명이 필요합니다.'
    if (block.type === 'quiz' && !normalizeQuizBlock(input)) return '퀴즈에는 질문과 정답이 모두 필요합니다.'
    if (block.type === 'checklist' && !normalizeChecklistBlock(input)) return '체크리스트 항목을 한 줄에 하나씩 입력해 주세요.'
  }

  return null
}

function toJsonObject(metadata: Record<string, string>): Json {
  return Object.entries(metadata).reduce<Record<string, Json>>((acc, [key, value]) => {
    const cleaned = cleanText(value)
    if (cleaned) acc[key] = cleaned
    return acc
  }, {})
}

async function requireEditablePost(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  postId: string,
) {
  const { data: postData, error: postError } = await showroomAdmin
    .from('blog_posts')
    .select('id, status, slug')
    .eq('id', postId)
    .single()

  const post = postData as Pick<Database['showroom']['Tables']['blog_posts']['Row'], 'id' | 'status' | 'slug'> | null

  if (postError || !post) {
    return { ok: false as const, message: '저장할 글을 찾지 못했습니다.' }
  }

  return { ok: true as const, post }
}

async function requireOwnedMedia(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  postId: string,
  mediaId: string,
) {
  const { data: mediaData, error: mediaError } = await showroomAdmin
    .from('blog_media')
    .select('id, post_id, usage_status, content_asset_id')
    .eq('id', mediaId)
    .single()

  const media = mediaData as Pick<Database['showroom']['Tables']['blog_media']['Row'], 'id' | 'post_id' | 'usage_status' | 'content_asset_id'> | null

  if (mediaError || !media) {
    return { ok: false as const, message: '수정할 사진을 찾지 못했습니다.' }
  }

  if (media.post_id !== postId) {
    return { ok: false as const, message: '다른 글의 사진은 수정할 수 없습니다.' }
  }

  return { ok: true as const, media }
}

async function centralBrandMediaPublicationIssues(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  mediaRows: Array<Pick<BlogMedia, 'content_asset_id'>>,
) {
  const assetIds = [...new Set(mediaRows.map(media => media.content_asset_id).filter(Boolean) as string[])]
  if (assetIds.length === 0) return []

  const { data, error } = await showroomAdmin
    .from('content_assets')
    .select('id, labels')
    .in('id', assetIds)
  if (error) throw new Error(`Central brand publication review failed: ${error.message}`)

  const assets = (data ?? []) as Array<Pick<ContentAsset, 'id' | 'labels'>>
  const assetById = new Map(assets.map(asset => [asset.id, asset]))
  const issues: string[] = []
  for (const assetId of assetIds) {
    const asset = assetById.get(assetId)
    if (!asset) {
      issues.push(`Linked content asset is missing: ${assetId}.`)
      continue
    }
    const blocker = centralBrandPublicationBlocker(asset.labels)
    if (blocker) issues.push(blocker)
  }
  return [...new Set(issues)]
}

function revalidateBlogEditorPaths(postId: string, slugs: Array<string | null | undefined>, isPublished: boolean) {
  revalidatePath('/admin/platform/blog')
  revalidatePath(`/admin/platform/blog/${postId}`)
  revalidatePath(`/admin/platform/blog/${postId}/preview`)

  if (!isPublished) return

  revalidatePath('/blog')
  revalidatePath('/sitemap.xml')
  const uniqueSlugs = [...new Set(slugs.map(item => cleanText(item)).filter((slug): slug is string => Boolean(slug)))]
  for (const slug of uniqueSlugs) {
    revalidatePath(`/blog/${slug}`)
  }
}

function toAttachedMedia(
  media: Pick<BlogMedia, 'id' | 'source_label' | 'usage_status' | 'alt_text' | 'caption' | 'privacy_checked' | 'promotion_consent_checked' | 'used_as_cover' | 'approved_at' | 'created_at'>,
): ContentAssetBlogMedia {
  return {
    id: media.id,
    sourceLabel: media.source_label,
    usageStatus: media.usage_status,
    altText: media.alt_text,
    caption: media.caption,
    privacyChecked: media.privacy_checked,
    promotionConsentChecked: media.promotion_consent_checked,
    usedAsCover: media.used_as_cover,
    previewUrl: `/admin/platform/blog/media/${media.id}`,
    approvedAt: media.approved_at,
    createdAt: media.created_at,
  }
}

async function validateRelatedPostBlocks(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  blocks: SaveableBlock[],
) {
  const relatedBlocks = blocks.filter(block => block.type === 'related_post')
  const ids = [...new Set(relatedBlocks
    .map(block => cleanText(block.metadata.related_post_id))
    .filter((id): id is string => Boolean(id)))]
  if (relatedBlocks.length !== ids.length) return '관련 글은 발행된 글을 선택해야 합니다.'
  if (ids.length === 0) return null
  const { data, error } = await showroomAdmin
    .from('blog_posts')
    .select('id')
    .in('id', ids)
    .eq('status', 'published')
  if (error || (data ?? []).length !== ids.length) return '관련 글은 현재 발행 중인 글만 연결할 수 있습니다.'
  return null
}

async function validateImageMediaOwnership(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  payload: SaveBlogEditorPayload,
) {
  const imageMediaIds = [
    ...new Set(payload.blocks
      .filter(block => block.type === 'image' && block.mediaId)
      .map(block => block.mediaId as string)),
  ]

  if (imageMediaIds.length === 0) return null

  const { data: mediaData, error: mediaError } = await showroomAdmin
    .from('blog_media')
    .select('id, post_id')
    .in('id', imageMediaIds)

  if (mediaError) return '사진 연결 상태를 확인하지 못했습니다.'

  const mediaRows = (mediaData ?? []) as Array<{ id: string; post_id: string | null }>
  const foundIds = new Set(mediaRows.map(media => media.id))
  const missingMediaIds = imageMediaIds.filter(mediaId => !foundIds.has(mediaId))

  if (missingMediaIds.length > 0) {
    return '연결할 수 없는 사진이 포함되어 있습니다.'
  }

  const hasForeignMedia = mediaRows.some(media => media.post_id !== payload.postId)
  if (hasForeignMedia) {
    return '다른 글의 사진은 이미지 블록에 연결할 수 없습니다.'
  }

  return null
}

export async function saveBlogEditor(payload: SaveBlogEditorPayload): Promise<SaveBlogEditorResult> {
  let editorLease: { postId: string; actorId: string; token: string } | null = null
  try {
    const actorId = await requireAdministrator()

    const validationError = validatePayload(payload)
    if (validationError) {
      return { ok: false, message: validationError }
    }

    const showroomAdmin = createShowroomAdminClient()
    const relatedPostError = await validateRelatedPostBlocks(showroomAdmin, payload.blocks)
    if (relatedPostError) return { ok: false, message: relatedPostError }
    const { data: currentPostData, error: currentPostError } = await showroomAdmin
      .from('blog_posts')
      .select('id, status, slug')
      .eq('id', payload.postId)
      .single()

    const currentPost = currentPostData as Pick<Database['showroom']['Tables']['blog_posts']['Row'], 'id' | 'status' | 'slug'> | null

    if (currentPostError || !currentPost) {
      return { ok: false, message: '저장할 글을 찾지 못했습니다.' }
    }

    if (currentPost.status === 'published') {
      return { ok: false, message: '발행된 글은 바로 저장할 수 없습니다. 수정 정책을 먼저 설계한 뒤 재검수 상태에서 편집해야 합니다.' }
    }

    const mediaOwnershipError = await validateImageMediaOwnership(showroomAdmin, payload)
    if (mediaOwnershipError) {
      return { ok: false, message: mediaOwnershipError }
    }

    const imageMediaIds = [
      ...new Set(payload.blocks
        .filter(block => block.type === 'image' && block.mediaId)
        .map(block => block.mediaId as string)),
    ]
    const mediaAssetById = new Map<string, Pick<BlogMedia, 'id' | 'content_asset_id' | 'alt_text' | 'caption' | 'source_label'>>()

    if (imageMediaIds.length > 0) {
      const { data: mediaAssetData, error: mediaAssetError } = await showroomAdmin
        .from('blog_media')
        .select('id, content_asset_id, alt_text, caption, source_label')
        .in('id', imageMediaIds)

      if (mediaAssetError) {
        return { ok: false, message: '본문 사진 정보를 확인하지 못했습니다.' }
      }

      for (const item of (mediaAssetData ?? []) as Array<Pick<BlogMedia, 'id' | 'content_asset_id' | 'alt_text' | 'caption' | 'source_label'>>) {
        if (item.content_asset_id) mediaAssetById.set(item.id, item)
      }
    }

    const rawSourceQuestionIds = payload.blocks
      .filter(block => block.type === 'qa')
      .map(block => cleanText(block.metadata.source_blog_question_id))
      .filter((questionId): questionId is string => Boolean(questionId))
    const sourceQuestionIds = [...new Set(rawSourceQuestionIds)]

    if (sourceQuestionIds.length !== rawSourceQuestionIds.length) {
      return { ok: false, message: '하나의 고객 질문은 하나의 공개 Q&A 블록에만 연결할 수 있습니다.' }
    }

    for (const block of payload.blocks) {
      const sourceQuestionId = cleanText(block.metadata.source_blog_question_id)
      if (block.type !== 'qa' || !sourceQuestionId) continue

      const approvedQuestion = cleanText(block.text)
      const approvedAnswer = cleanText(block.metadata.answer)
      if (!approvedQuestion || !approvedAnswer) {
        return { ok: false, message: '고객 질문으로 만든 Q&A는 공개 질문과 답변을 모두 작성해야 합니다.' }
      }
      if (approvedQuestion.length > 240) {
        return { ok: false, message: '공개용 질문은 240자 이내로 작성해주세요.' }
      }
      if (approvedAnswer.length > 2000) {
        return { ok: false, message: '공개용 답변은 2000자 이내로 작성해주세요.' }
      }
    }

    if (sourceQuestionIds.length > 0) {
      const platformAdmin = createPlatformAdminClient()
      const { data: questionRowsData, error: questionRowsError } = await platformAdmin
        .from('blog_article_questions')
        .select('id')
        .eq('post_id', payload.postId)
        .in('id', sourceQuestionIds)

      if (questionRowsError) {
        return { ok: false, message: '연결된 고객 질문을 확인하지 못했습니다.' }
      }

      const foundQuestionIds = new Set(((questionRowsData ?? []) as Array<{ id: string }>).map(row => row.id))
      const missingQuestionId = sourceQuestionIds.find(questionId => !foundQuestionIds.has(questionId))
      if (missingQuestionId) {
        return { ok: false, message: '연결된 고객 질문을 찾지 못했습니다.' }
      }
    }

    const leaseToken = randomUUID()
    const { error: leaseError } = await showroomAdmin.rpc('acquire_blog_editor_save_lease' as never, {
      p_post_id: payload.postId,
      p_actor_id: actorId,
      p_lease_token: leaseToken,
      p_expected_updated_at: payload.expectedUpdatedAt,
    } as never)
    if (leaseError) {
      return {
        ok: false,
        message: '글 또는 사진 배치가 바뀌었습니다. 최신본을 다시 불러온 뒤 변경 내용을 확인해주세요.',
        code: 'stale_revision',
      }
    }
    editorLease = { postId: payload.postId, actorId, token: leaseToken }

    const requestedUpdatedAt = new Date().toISOString()
    const postUpdate: Database['showroom']['Tables']['blog_posts']['Update'] = {
      title: payload.post.title.trim(),
      slug: payload.post.slug.trim(),
      excerpt: cleanText(payload.post.excerpt),
      category: payload.post.category,
      seo_title: cleanText(payload.post.seoTitle),
      meta_description: cleanText(payload.post.metaDescription),
      canonical_url: cleanText(payload.post.canonicalUrl),
      primary_keyword: cleanText(payload.post.primaryKeyword),
      target_question: cleanText(payload.post.targetQuestion),
      summary_answer: cleanText(payload.post.summaryAnswer),
      related_questions: payload.post.relatedQuestions.map(question => question.trim()).filter(Boolean),
      service_area: cleanText(payload.post.serviceArea),
      product_type: cleanText(payload.post.productType),
      ai_citation_ready: payload.post.aiCitationReady,
      media_missing_reason: cleanText(payload.post.mediaMissingReason),
      updated_at: requestedUpdatedAt,
    }

    const { data: updatedPostData, error: postError } = await showroomAdmin
      .from('blog_posts')
      .update(postUpdate as never)
      .eq('id', payload.postId)
      .eq('status', currentPost.status)
      .select('id, updated_at')

    if (postError) {
      return { ok: false, message: '글 기본 정보를 저장하지 못했습니다.' }
    }

    const updatedPostRows = (updatedPostData ?? []) as Array<{ id: string; updated_at: string }>
    if (updatedPostRows.length !== 1) {
      return {
        ok: false,
        message: '글 상태가 바뀌었습니다. 최신본을 다시 불러온 뒤 변경 내용을 확인해주세요.',
        code: 'stale_revision',
      }
    }
    if (typeof updatedPostRows[0].updated_at !== 'string') {
      return {
        ok: false,
        code: 'stale_revision',
        message: '임시저장은 처리됐지만 최신 revision 응답을 확인하지 못했습니다. 최신본 다시 불러오기로 상태를 확인해 주세요.',
      }
    }

    const { data: existingBlocksData, error: existingBlocksError } = await showroomAdmin
      .from('blog_blocks')
      .select('id, display_order, type, metadata')
      .eq('post_id', payload.postId)

    if (existingBlocksError) {
      return { ok: false, message: '기존 본문을 확인하지 못했습니다.' }
    }

    const existingBlocks = (existingBlocksData ?? []) as Array<{ id: string; display_order: number; type: BlogBlockType; metadata: Json }>
    const existingBlockIds = new Set(existingBlocks.map(block => block.id))
    const incomingExistingIds = new Set(payload.blocks.map(block => block.id).filter(Boolean) as string[])
    const removedIds = [...existingBlockIds].filter(id => !incomingExistingIds.has(id))
    const removedQuestionIds = existingBlocks
      .filter(block => removedIds.includes(block.id) && block.type === 'qa' && isJsonObject(block.metadata))
      .map(block => isJsonObject(block.metadata) ? jsonString(block.metadata.source_blog_question_id) : '')
      .filter((questionId): questionId is string => Boolean(questionId))

    if (existingBlocks.length > 0) {
      await Promise.all(existingBlocks.map(block => showroomAdmin
        .from('blog_blocks')
        .update({ display_order: block.display_order + 10000 } as never)
        .eq('id', block.id)
      ))
    }

    if (removedQuestionIds.length > 0) {
      const platformAdmin = createPlatformAdminClient()
      const { error: resetQuestionError } = await platformAdmin
        .from('blog_article_questions')
        .update({
          status: 'pending_review',
          published_block_id: null,
          published_at: null,
        } as never)
        .eq('post_id', payload.postId)
        .in('id', removedQuestionIds)

      if (resetQuestionError) {
        return { ok: false, message: '삭제된 Q&A와 연결된 고객 질문 상태를 되돌리지 못했습니다.' }
      }
    }

    if (removedIds.length > 0) {
      const { error: deleteError } = await showroomAdmin
        .from('blog_blocks')
        .delete()
        .in('id', removedIds)

      if (deleteError) {
        return { ok: false, message: '삭제한 본문 카드를 정리하지 못했습니다.' }
      }
    }

    const nextUsages: Database['showroom']['Tables']['content_asset_usages']['Insert'][] = []
    const questionApprovals: BlogQuestionApproval[] = []
    const savedBlockIds: string[] = []

    for (const [index, block] of payload.blocks.entries()) {
      const blockPayload: Database['showroom']['Tables']['blog_blocks']['Insert'] = {
        post_id: payload.postId,
        display_order: index,
        type: block.type,
        heading_level: block.type === 'heading' ? block.headingLevel : null,
        text: cleanText(block.text),
        media_id: block.type === 'image' ? block.mediaId : null,
        metadata: toJsonObject(block.metadata),
      }

      let savedBlockId = block.id && existingBlockIds.has(block.id) ? block.id : null

      if (block.id && existingBlockIds.has(block.id)) {
        const { error } = await showroomAdmin
          .from('blog_blocks')
          .update(blockPayload as never)
          .eq('id', block.id)

        if (error) return { ok: false, message: '본문 카드를 저장하지 못했습니다.' }
      } else {
        const { data: insertedBlockData, error } = await showroomAdmin
          .from('blog_blocks')
          .insert(blockPayload as never)
          .select('id')
          .single()

        if (error) return { ok: false, message: '본문 카드를 추가하지 못했습니다.' }
        savedBlockId = (insertedBlockData as { id: string } | null)?.id ?? null
      }

      if (block.type === 'image' && block.mediaId && savedBlockId) {
        const mediaAsset = mediaAssetById.get(block.mediaId)
        if (mediaAsset?.content_asset_id) {
          nextUsages.push({
            asset_id: mediaAsset.content_asset_id,
            usage_context: 'blog_block',
            ref_table: 'showroom.blog_blocks',
            ref_id: savedBlockId,
            role: 'body',
            caption_override: cleanText(mediaAsset.caption),
            alt_text_override: cleanText(mediaAsset.alt_text),
            metadata: {
              post_id: payload.postId,
              blog_media_id: block.mediaId,
              source_label: mediaAsset.source_label,
            },
            created_by: actorId,
          })
        }
      }

      const sourceQuestionId = cleanText(block.metadata.source_blog_question_id)
      const approvedQuestion = cleanText(block.text)
      const approvedAnswer = cleanText(block.metadata.answer)
      if (block.type === 'qa' && sourceQuestionId && savedBlockId) {
        if (!approvedQuestion || !approvedAnswer) {
          return { ok: false, message: '고객 질문으로 만든 Q&A는 공개 질문과 답변을 모두 작성해야 합니다.' }
        }

        questionApprovals.push({
          questionId: sourceQuestionId,
          blockId: savedBlockId,
          approvedQuestion,
          approvedAnswer,
        })
      }

      if (!savedBlockId) return { ok: false, message: '저장한 본문 카드 ID를 확인하지 못했습니다.' }
      savedBlockIds.push(savedBlockId)
    }

    if (existingBlocks.length > 0) {
      const { error: usageDeleteError } = await showroomAdmin
        .from('content_asset_usages')
        .delete()
        .eq('ref_table', 'showroom.blog_blocks')
        .in('ref_id', existingBlocks.map(block => block.id))

      if (usageDeleteError) {
        return { ok: false, message: '사진 사용 기록을 정리하지 못했습니다.' }
      }
    }

    if (nextUsages.length > 0) {
      const { error: usageInsertError } = await showroomAdmin
        .from('content_asset_usages')
        .insert(nextUsages as never)

      if (usageInsertError) {
        return { ok: false, message: '사진 사용 기록을 저장하지 못했습니다.' }
      }
    }

    if (questionApprovals.length > 0) {
      const platformAdmin = createPlatformAdminClient()
      const reviewedAt = new Date().toISOString()

      for (const approval of questionApprovals) {
        const { data: questionData, error: questionError } = await platformAdmin
          .from('blog_article_questions')
          .update({
            status: 'approved',
            approved_question: approval.approvedQuestion,
            approved_answer: approval.approvedAnswer,
            reviewed_by: actorId,
            reviewed_at: reviewedAt,
            published_block_id: approval.blockId,
            published_at: reviewedAt,
          } as never)
          .eq('id', approval.questionId)
          .eq('post_id', payload.postId)
          .select('id')

        if (questionError) {
          return { ok: false, message: '고객 질문 승인 상태를 저장하지 못했습니다.' }
        }

        const questionRows = (questionData ?? []) as Array<{ id: string }>
        if (questionRows.length !== 1) {
          return { ok: false, message: '연결된 고객 질문을 찾지 못했습니다.' }
        }
      }
    }

    revalidateBlogEditorPaths(payload.postId, [currentPost.slug, payload.post.slug], false)

    return {
      ok: true,
      message: '현재 내용을 임시저장했습니다. 이 저장본을 기준으로 바로 발행할 수 있습니다.',
      updatedAt: updatedPostRows[0].updated_at,
      blockIds: savedBlockIds,
    }
  } catch {
    return {
      ok: false,
      message: '저장 중 오류가 발생했습니다.',
    }
  } finally {
    if (editorLease) {
      const lease = editorLease
      const leaseClient = createShowroomAdminClient()
      await leaseClient.rpc('release_blog_editor_save_lease' as never, {
        p_post_id: lease.postId,
        p_actor_id: lease.actorId,
        p_lease_token: lease.token,
      } as never)
    }
  }
}

function extensionForFile(file: File) {
  const nameExtension = file.name.split('.').pop()?.toLowerCase()
  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) return nameExtension

  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'

  return 'bin'
}

export async function uploadBlogMedia(formData: FormData): Promise<MediaActionResult> {
  let uploadedPath: string | null = null

  try {
    await requireAdministrator()

    const postId = String(formData.get('postId') ?? '')
    const file = formData.get('file')
    const sourceLabel = cleanText(String(formData.get('sourceLabel') ?? ''))

    if (!postId) {
      return { ok: false, message: '글 ID가 없습니다.' }
    }

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: '업로드할 이미지 파일을 선택해주세요.' }
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return { ok: false, message: '이미지는 50MB 이하만 업로드할 수 있습니다.' }
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return { ok: false, message: 'jpeg, png, webp, gif, heic 이미지만 업로드할 수 있습니다.' }
    }

    const uploadBuffer = Buffer.from(await file.arrayBuffer())
    await inspectContentAssetImage(uploadBuffer, file.type)

    const showroomAdmin = createShowroomAdminClient()
    const editablePost = await requireEditablePost(showroomAdmin, postId)
    if (!editablePost.ok) return { ok: false, message: editablePost.message }
    if (editablePost.post.status === 'published') {
      return { ok: false, message: '발행된 글의 사진은 바로 변경할 수 없습니다. 재검수 상태에서 수정해야 합니다.' }
    }

    const objectPath = `${postId}/${Date.now()}-${randomUUID()}.${extensionForFile(file)}`
    const { error: uploadError } = await showroomAdmin.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .upload(objectPath, uploadBuffer, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return { ok: false, message: '사진을 올리지 못했습니다.' }
    }

    uploadedPath = objectPath

    const insertPayload: Database['showroom']['Tables']['blog_media']['Insert'] = {
      post_id: postId,
      source_type: 'manual_upload',
      private_bucket: PRIVATE_MEDIA_BUCKET,
      private_object_path: objectPath,
      source_label: sourceLabel ?? file.name,
      usage_status: 'candidate',
      privacy_checked: false,
      promotion_consent_checked: false,
      used_as_cover: false,
    }

    const { error: insertError } = await showroomAdmin
      .from('blog_media')
      .insert(insertPayload as never)

    if (insertError) {
      await showroomAdmin.storage.from(PRIVATE_MEDIA_BUCKET).remove([objectPath])
      uploadedPath = null
      return { ok: false, message: '올린 사진을 저장하지 못했습니다.' }
    }

    revalidatePath(`/admin/platform/blog/${postId}`)
    return { ok: true, message: '사진을 올렸습니다.' }
  } catch {
    if (uploadedPath) {
      const showroomAdmin = createShowroomAdminClient()
      await showroomAdmin.storage.from(PRIVATE_MEDIA_BUCKET).remove([uploadedPath])
    }

    return {
      ok: false,
      message: '사진 업로드 중 오류가 발생했습니다.',
    }
  }
}

export async function attachContentAssetToBlogMedia(payload: {
  postId: string
  assetId: string
}): Promise<AttachContentAssetResult> {
  let insertedMediaId: string | null = null

  try {
    const actorId = await requireAdministrator()
    const postId = cleanText(payload.postId)
    const assetId = cleanText(payload.assetId)

    if (!postId || !assetId) {
      return { ok: false, message: '선택할 사진을 찾지 못했습니다.' }
    }

    const showroomAdmin = createShowroomAdminClient()
    const editablePost = await requireEditablePost(showroomAdmin, postId)
    if (!editablePost.ok) return { ok: false, message: editablePost.message }
    if (editablePost.post.status === 'published') {
      return { ok: false, message: '발행된 글의 사진은 바로 변경할 수 없습니다. 재검수 상태에서 수정해야 합니다.' }
    }

    const { data: assetData, error: assetError } = await showroomAdmin
      .from('content_assets')
      .select('id, title, description, category, labels, product_type, space_type, region, usage_purpose, library_state, privacy_checked, promotion_consent_checked, used_count, created_by, updated_by, created_at, updated_at')
      .eq('id', assetId)
      .eq('library_state', 'available')
      .single()

    const asset = assetData as ContentAsset | null
    if (assetError || !asset) {
      return { ok: false, message: '사진보관함에서 선택한 사진을 찾지 못했습니다.' }
    }
    if (!asset.privacy_checked || !asset.promotion_consent_checked) {
      return { ok: false, message: '사진보관함에서 민감정보와 블로그 사용 가능 여부가 확인된 사진만 연결할 수 있습니다.' }
    }

    const centralBrandBlocker = centralBrandPublicationBlocker(asset.labels)
    if (centralBrandBlocker) {
      return { ok: false, message: centralBrandBlocker }
    }

    const { data: assetFilesData, error: assetFilesError } = await showroomAdmin
      .from('content_asset_files')
      .select('id, asset_id, file_role, bucket, object_path, public_url, mime_type, size_bytes, width, height, checksum_sha256, storage_etag, transform_status, transform_error, created_at')
      .eq('asset_id', assetId)
      .in('file_role', ['original', 'web', 'thumbnail'])

    if (assetFilesError) {
      return { ok: false, message: '선택한 사진 파일을 확인하지 못했습니다.' }
    }

    const files = (assetFilesData ?? []) as ContentAssetFile[]
    const originalFile = files.find(file => file.file_role === 'original' && file.transform_status === 'ready')

    if (!originalFile) {
      return { ok: false, message: '선택한 사진의 원본을 확인하지 못했습니다.' }
    }

    const { data: existingMediaData, error: existingMediaError } = await showroomAdmin
      .from('blog_media')
      .select('id, source_label, usage_status, alt_text, caption, privacy_checked, promotion_consent_checked, used_as_cover, approved_at, created_at')
      .eq('post_id', postId)
      .eq('content_asset_id', assetId)
      .neq('usage_status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingMediaError) {
      return { ok: false, message: '이 글에 이미 연결된 사진인지 확인하지 못했습니다.' }
    }

    const existingMedia = ((existingMediaData ?? []) as Array<Pick<BlogMedia, 'id' | 'source_label' | 'usage_status' | 'alt_text' | 'caption' | 'privacy_checked' | 'promotion_consent_checked' | 'used_as_cover' | 'approved_at' | 'created_at'>>)[0]
    if (existingMedia) {
      const normalizedMedia = {
        ...existingMedia,
        usage_status: existingMedia.usage_status,
        privacy_checked: true,
        promotion_consent_checked: true,
      }

      if (!existingMedia.privacy_checked || !existingMedia.promotion_consent_checked) {
        const { error: mediaConfirmError } = await showroomAdmin
          .from('blog_media')
          .update({
            privacy_checked: true,
            promotion_consent_checked: true,
          } as never)
          .eq('id', existingMedia.id)

        if (mediaConfirmError) {
          return { ok: false, message: '사진 사용 확인 상태를 저장하지 못했습니다.' }
        }
      }

      return {
        ok: true,
        message: '이미 이 글에 연결된 사진입니다.',
        media: toAttachedMedia(normalizedMedia),
      }
    }

    const altText = cleanText(asset.title) ?? cleanText(asset.description) ?? '문장군 현장 사진'
    const caption = cleanText(asset.description)
    const sourceLabel = cleanText(asset.title) ?? cleanText(asset.category) ?? '사진보관함 사진'

    const now = new Date().toISOString()

    const insertPayload: Database['showroom']['Tables']['blog_media']['Insert'] = {
      post_id: postId,
      content_asset_id: asset.id,
      source_type: 'showroom_asset',
      private_bucket: originalFile.bucket,
      private_object_path: originalFile.object_path,
      source_label: sourceLabel,
      alt_text: altText,
      caption,
      usage_status: 'approved',
      privacy_checked: true,
      promotion_consent_checked: true,
      used_as_cover: false,
      approved_by: actorId,
      approved_at: now,
      public_bucket: null,
      public_object_path: null,
      public_url: null,
      published_at: null,
    }

    const { data: mediaData, error: mediaError } = await showroomAdmin
      .from('blog_media')
      .insert(insertPayload as never)
      .select('id, source_label, usage_status, alt_text, caption, privacy_checked, promotion_consent_checked, used_as_cover, approved_at, created_at')
      .single()

    const media = mediaData as Pick<BlogMedia, 'id' | 'source_label' | 'usage_status' | 'alt_text' | 'caption' | 'privacy_checked' | 'promotion_consent_checked' | 'used_as_cover' | 'approved_at' | 'created_at'> | null
    if (mediaError || !media) {
      return { ok: false, message: '사진을 글에 연결하지 못했습니다.' }
    }

    insertedMediaId = media.id

    await showroomAdmin
      .from('content_asset_events')
      .insert({
        asset_id: asset.id,
        event_type: 'attached_to_blog_post',
        actor_id: actorId,
        metadata: {
          post_id: postId,
          blog_media_id: media.id,
        },
      } as never)

    revalidateBlogEditorPaths(postId, [editablePost.post.slug], false)

    return {
      ok: true,
      message: '사진을 본문에 넣었습니다.',
      media: toAttachedMedia(media),
    }
  } catch {
    if (insertedMediaId) {
      const showroomAdmin = createShowroomAdminClient()
      await showroomAdmin.from('blog_media').delete().eq('id', insertedMediaId)
    }

    return {
      ok: false,
      message: '사진을 글에 연결하는 중 오류가 발생했습니다.',
    }
  }
}

export async function updateBlogMedia(payload: UpdateBlogMediaPayload): Promise<MediaActionResult> {
  try {
    const actorId = await requireAdministrator()

    if (!payload.postId || !payload.mediaId) {
      return { ok: false, message: '사진 ID가 없습니다.' }
    }

    const showroomAdmin = createShowroomAdminClient()
    const editablePost = await requireEditablePost(showroomAdmin, payload.postId)
    if (!editablePost.ok) return { ok: false, message: editablePost.message }
    if (editablePost.post.status === 'published') {
      return { ok: false, message: '발행된 글의 사진 정보는 바로 수정할 수 없습니다. 재검수 상태에서 수정해야 합니다.' }
    }

    const ownedMedia = await requireOwnedMedia(showroomAdmin, payload.postId, payload.mediaId)
    if (!ownedMedia.ok) return { ok: false, message: ownedMedia.message }
    const isPublishedMedia = ownedMedia.media.usage_status === 'published'

    if (payload.usageStatus === 'published' && !isPublishedMedia) {
      return { ok: false, message: '발행 전환은 최종 발행 검수에서만 처리합니다.' }
    }

    if (isPublishedMedia && payload.usageStatus !== 'published') {
      return { ok: false, message: '공개된 사진의 상태 변경은 별도 검수 흐름에서 다룹니다.' }
    }

    const altText = cleanText(payload.altText)
    const caption = cleanText(payload.caption)
    const sourceLabel = cleanText(payload.sourceLabel)
    const rejectionReason = cleanText(payload.rejectionReason)

    if (payload.usageStatus === 'approved') {
      if (!altText) return { ok: false, message: '사진 설명이 필요합니다.' }
      if (!payload.privacyChecked) return { ok: false, message: '사진의 민감정보 확인이 필요합니다.' }
      if (!payload.promotionConsentChecked) return { ok: false, message: '사진의 블로그 사용 가능 여부 확인이 필요합니다.' }
    }

    if (payload.usageStatus === 'approved') {
      const centralBrandIssues = await centralBrandMediaPublicationIssues(showroomAdmin, [ownedMedia.media])
      if (centralBrandIssues.length > 0) return { ok: false, message: centralBrandIssues.join(' ') }
    }

    if (payload.usageStatus === 'rejected' && !rejectionReason) {
      return { ok: false, message: '제외하려면 사유가 필요합니다.' }
    }

    if (payload.usedAsCover && payload.usageStatus !== 'rejected') {
      const { error: coverResetError } = await showroomAdmin
        .from('blog_media')
        .update({ used_as_cover: false } as never)
        .eq('post_id', payload.postId)
        .neq('id', payload.mediaId)

      if (coverResetError) {
        return { ok: false, message: '대표사진 설정을 정리하지 못했습니다.' }
      }
    }

    const now = new Date().toISOString()
    const mediaUpdate: Database['showroom']['Tables']['blog_media']['Update'] = isPublishedMedia
      ? {
          alt_text: altText,
          caption,
          source_label: sourceLabel,
          privacy_checked: payload.privacyChecked,
          promotion_consent_checked: payload.promotionConsentChecked,
          used_as_cover: payload.usedAsCover,
          updated_at: now,
        }
      : {
          alt_text: altText,
          caption,
          source_label: sourceLabel,
          privacy_checked: payload.privacyChecked,
          promotion_consent_checked: payload.promotionConsentChecked,
          used_as_cover: payload.usageStatus === 'rejected' ? false : payload.usedAsCover,
          usage_status: payload.usageStatus,
          approved_by: payload.usageStatus === 'approved' ? actorId : null,
          approved_at: payload.usageStatus === 'approved' ? now : null,
          rejection_reason: payload.usageStatus === 'rejected' ? rejectionReason : null,
          public_bucket: null,
          public_object_path: null,
          public_url: null,
          published_at: null,
          updated_at: now,
        }

    const { data: updatedData, error: updateError } = await showroomAdmin
      .from('blog_media')
      .update(mediaUpdate as never)
      .eq('id', payload.mediaId)
      .eq('post_id', payload.postId)
      .eq('usage_status', ownedMedia.media.usage_status)
      .select('id')

    if (updateError) {
      return { ok: false, message: '사진 설명을 저장하지 못했습니다.' }
    }

    const updatedRows = (updatedData ?? []) as Array<{ id: string }>
    if (updatedRows.length !== 1) {
      return { ok: false, message: '사진 상태가 바뀌었습니다. 새로고침 후 다시 저장해주세요.' }
    }

    revalidateBlogEditorPaths(payload.postId, [editablePost.post.slug], false)
    return { ok: true, message: '사진 설명을 저장했습니다.' }
  } catch {
    return {
      ok: false,
      message: '사진 설명 저장 중 오류가 발생했습니다.',
    }
  }
}

function validatePublishGate(post: BlogPost, blocks: BlogBlock[], media: BlogMedia[]) {
  const issues: string[] = []
  const imageBlocks = blocks.filter(block => block.type === 'image')
  const ctaBlocks = blocks.filter(block => block.type === 'cta')
  const mediaById = new Map(media.map(item => [item.id, item]))
  const mediaToValidate = new Map<string, BlogMedia>()
  issues.push(...claimSafetyBlockers(post, blocks, 'publish'))
  if (!hasCoverOrRecordedMediaException(post, media)) {
    issues.push('대표 사진 또는 사진 부족 사유가 필요합니다.')
  }

  if (!cleanText(post.title)) issues.push('제목이 필요합니다.')
  if (!cleanText(post.slug) || !SLUG_PATTERN.test(post.slug)) issues.push('글 주소 형식이 올바르지 않습니다.')
  const metaDescription = cleanText(post.meta_description)
  if (!metaDescription) issues.push('검색 설명이 필요합니다.')
  if (metaDescription && (metaDescription.length < 50 || metaDescription.length > 180)) {
    issues.push('검색 설명은 50-180자로 작성해야 합니다.')
  }
  if (!cleanText(post.target_question)) issues.push('대표 질문이 필요합니다.')
  if ((cleanText(post.summary_answer)?.length ?? 0) <= 20) {
    issues.push('요약 답변은 21자 이상 작성해야 합니다.')
  }
  if (blocks.length === 0) issues.push('본문 블록이 필요합니다.')
  if (ctaBlocks.length === 0) issues.push('CTA 블록이 필요합니다.')
  if (hasForbiddenExpression(post.brand_check_result)) issues.push('금지표현/브랜드 검수 blocker가 남아 있습니다.')

  for (const block of blocks) {
    if (block.type !== 'image') continue
    if (!block.media_id) {
      issues.push('본문에 사진이 비어 있는 카드가 있습니다.')
      continue
    }

    const linkedMedia = mediaById.get(block.media_id)
    if (!linkedMedia || linkedMedia.post_id !== post.id) {
      issues.push('이 글에 연결되지 않은 사진이 포함되어 있습니다.')
      continue
    }

    mediaToValidate.set(linkedMedia.id, linkedMedia)
  }

  for (const coverMedia of media.filter(item => item.used_as_cover)) {
    mediaToValidate.set(coverMedia.id, coverMedia)
  }

  for (const linkedMedia of mediaToValidate.values()) {
    if (linkedMedia.usage_status !== 'approved') {
      issues.push('사진보관함에서 바로 사용할 수 있는 사진만 발행할 수 있습니다.')
    }
    if (!cleanText(linkedMedia.alt_text)) {
      issues.push('사진 설명이 필요합니다.')
    }

    if (!linkedMedia.privacy_checked) {
      issues.push('사진의 민감정보 확인이 필요합니다.')
    }

    if (!linkedMedia.promotion_consent_checked) {
      issues.push('사진의 블로그 사용 가능 여부 확인이 필요합니다.')
    }

    if (!linkedMedia.private_bucket || !linkedMedia.private_object_path) {
      issues.push('사진 원본을 확인할 수 없습니다.')
    }
  }

  issues.push(...mediaTextSafetyBlockers(post, [...mediaToValidate.values()], 'publish'))

  const usedImageMediaIds = new Set(imageBlocks.map(block => block.media_id).filter(Boolean) as string[])
  const mediaToPublish = media.filter(item => usedImageMediaIds.has(item.id) || item.used_as_cover)

  return {
    issues: [...new Set(issues)],
    mediaToPublish,
  }
}

function validateReadyGate(post: BlogPost, blocks: BlogBlock[], media: BlogMedia[]) {
  const issues: string[] = []
  const ctaBlocks = blocks.filter(block => block.type === 'cta')
  const mediaById = new Map(media.map(item => [item.id, item]))
  const mediaToValidate = new Map<string, BlogMedia>()
  if (!hasCoverOrRecordedMediaException(post, media)) {
    issues.push('대표 사진 또는 사진 부족 사유가 필요합니다.')
  }

  if (!cleanText(post.title)) issues.push('제목이 필요합니다.')
  if (!cleanText(post.slug) || !SLUG_PATTERN.test(post.slug)) issues.push('글 주소 형식이 올바르지 않습니다.')
  const metaDescription = cleanText(post.meta_description)
  if (!metaDescription) issues.push('검색 설명이 필요합니다.')
  if (metaDescription && (metaDescription.length < 50 || metaDescription.length > 180)) {
    issues.push('검색 설명은 50-180자로 작성해야 합니다.')
  }
  if (!cleanText(post.target_question)) issues.push('대표 질문이 필요합니다.')
  if ((cleanText(post.summary_answer)?.length ?? 0) <= 20) {
    issues.push('요약 답변은 21자 이상 작성해야 합니다.')
  }
  if (blocks.length === 0) issues.push('본문 블록이 필요합니다.')
  if (ctaBlocks.length === 0) issues.push('CTA 블록이 필요합니다.')
  if (hasForbiddenExpression(post.brand_check_result)) issues.push('금지표현/브랜드 검수 blocker가 남아 있습니다.')

  issues.push(...claimSafetyBlockers(post, blocks, 'ready'))

  for (const block of blocks) {
    if (block.type !== 'image') continue
    if (!block.media_id) {
      issues.push('본문에 사진이 비어 있는 카드가 있습니다.')
      continue
    }

    const linkedMedia = mediaById.get(block.media_id)
    if (!linkedMedia || linkedMedia.post_id !== post.id) {
      issues.push('이 글에 연결되지 않은 사진이 포함되어 있습니다.')
      continue
    }

    mediaToValidate.set(linkedMedia.id, linkedMedia)
  }

  for (const coverMedia of media.filter(item => item.used_as_cover)) {
    mediaToValidate.set(coverMedia.id, coverMedia)
  }

  for (const linkedMedia of mediaToValidate.values()) {
    if (linkedMedia.usage_status !== 'approved') {
      issues.push('사진보관함에서 바로 사용할 수 있는 사진만 발행 대기로 변경할 수 있습니다.')
    }
    if (!cleanText(linkedMedia.alt_text)) {
      issues.push('사진 설명이 필요합니다.')
    }
    if (!linkedMedia.privacy_checked) {
      issues.push('사진의 민감정보 확인이 필요합니다.')
    }
    if (!linkedMedia.promotion_consent_checked) {
      issues.push('사진의 블로그 사용 가능 여부 확인이 필요합니다.')
    }
  }

  issues.push(...mediaTextSafetyBlockers(post, [...mediaToValidate.values()], 'ready'))

  return [...new Set(issues)]
}

type StagedPublicationMedia = {
  id: string
  public_bucket: string
  public_object_path: string
  public_url: string
}

function rpcPostPayload(payload: SaveBlogEditorPayload): Json {
  return {
    title: payload.post.title.trim(),
    slug: payload.post.slug.trim(),
    excerpt: cleanText(payload.post.excerpt),
    category: payload.post.category,
    seo_title: cleanText(payload.post.seoTitle),
    meta_description: cleanText(payload.post.metaDescription),
    canonical_url: cleanText(payload.post.canonicalUrl),
    primary_keyword: cleanText(payload.post.primaryKeyword),
    target_question: cleanText(payload.post.targetQuestion),
    summary_answer: cleanText(payload.post.summaryAnswer),
    related_questions: payload.post.relatedQuestions.map(question => question.trim()).filter(Boolean),
    service_area: cleanText(payload.post.serviceArea),
    product_type: cleanText(payload.post.productType),
    ai_citation_ready: payload.post.aiCitationReady,
    media_missing_reason: cleanText(payload.post.mediaMissingReason),
  }
}

function rpcBlocksPayload(payload: SaveBlogEditorPayload, generatedAt: string) {
  return payload.blocks.map((block, index) => ({
    id: block.id ?? randomUUID(),
    display_order: index,
    type: block.type,
    heading_level: block.type === 'heading' ? block.headingLevel : null,
    text: cleanText(block.text),
    media_id: block.type === 'image' ? block.mediaId : null,
    metadata: toJsonObject(block.metadata),
    created_at: generatedAt,
  }))
}

function nextPostForPublication(currentPost: BlogPost, payload: SaveBlogEditorPayload): BlogPost {
  return {
    ...currentPost,
    title: payload.post.title.trim(),
    slug: payload.post.slug.trim(),
    excerpt: cleanText(payload.post.excerpt),
    category: payload.post.category,
    seo_title: cleanText(payload.post.seoTitle),
    meta_description: cleanText(payload.post.metaDescription),
    canonical_url: cleanText(payload.post.canonicalUrl),
    primary_keyword: cleanText(payload.post.primaryKeyword),
    target_question: cleanText(payload.post.targetQuestion),
    summary_answer: cleanText(payload.post.summaryAnswer),
    related_questions: payload.post.relatedQuestions.map(question => question.trim()).filter(Boolean),
    service_area: cleanText(payload.post.serviceArea),
    product_type: cleanText(payload.post.productType),
    ai_citation_ready: payload.post.aiCitationReady,
    media_missing_reason: cleanText(payload.post.mediaMissingReason),
  }
}

function nextBlocksForPublication(
  payload: SaveBlogEditorPayload,
  rpcBlocks: ReturnType<typeof rpcBlocksPayload>,
): BlogBlock[] {
  return rpcBlocks.map(block => ({
    id: block.id,
    post_id: payload.postId,
    display_order: block.display_order,
    type: block.type,
    heading_level: block.heading_level,
    text: block.text,
    media_id: block.media_id,
    metadata: block.metadata,
    created_at: block.created_at,
    updated_at: block.created_at,
  }))
}

function publicObjectPathForMedia(
  postId: string,
  mediaId: string,
  extension: 'gif' | 'webp',
) {
  return `${postId}/${mediaId}.${extension}`
}

async function stageMediaForAtomicPublication(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  postId: string,
  publicationAttemptId: string,
  actorId: string,
  mediaRows: BlogMedia[],
  uploadedPaths: string[],
) {
  const stagedMedia: StagedPublicationMedia[] = []
  const preparedMedia: Array<{
    media: BlogMedia
    publicObjectPath: string
    prepared: Awaited<ReturnType<typeof prepareBlogMediaForPublication>>
  }> = []

  for (const media of mediaRows) {
    await heartbeatPublicationAttempt(showroomAdmin, publicationAttemptId, actorId)
    if (!media.private_bucket || !media.private_object_path) {
      throw new Error('사진 원본을 확인할 수 없습니다.')
    }

    const { data: privateObject, error: downloadError } = await showroomAdmin.storage
      .from(media.private_bucket)
      .download(media.private_object_path)
    if (downloadError || !privateObject) {
      throw new Error('사진 원본을 불러오지 못했습니다.')
    }

    const privateBuffer = Buffer.from(await privateObject.arrayBuffer())
    const prepared = await prepareBlogMediaForPublication(privateBuffer, privateObject.type)
    if (prepared.extension !== 'gif' && prepared.extension !== 'webp') {
      throw new Error('공개용 사진 확장자를 확인하지 못했습니다.')
    }
    await heartbeatPublicationAttempt(showroomAdmin, publicationAttemptId, actorId)

    const mediaObjectPath = publicObjectPathForMedia(postId, media.id, prepared.extension)
    const fileName = mediaObjectPath.slice(postId.length + 1)
    const publicObjectPath = `${postId}/${publicationAttemptId}/${fileName}`
    preparedMedia.push({ media, publicObjectPath, prepared })
  }

  const reservedPaths = preparedMedia.map(item => item.publicObjectPath)
  await recordPublicationAttemptPaths(showroomAdmin, publicationAttemptId, reservedPaths)
  await heartbeatPublicationAttempt(showroomAdmin, publicationAttemptId, actorId)
  uploadedPaths.splice(0, uploadedPaths.length, ...reservedPaths)

  for (const { media, publicObjectPath, prepared } of preparedMedia) {
    await heartbeatPublicationAttempt(showroomAdmin, publicationAttemptId, actorId)
    const { error: uploadError } = await showroomAdmin.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .upload(publicObjectPath, prepared.buffer, {
        cacheControl: '31536000',
        contentType: prepared.contentType,
        upsert: false,
      })
    if (uploadError) throw new Error('공개용 사진을 준비하지 못했습니다.')
    await heartbeatPublicationAttempt(showroomAdmin, publicationAttemptId, actorId)

    const { data: publicUrlData } = showroomAdmin.storage
      .from(PUBLIC_MEDIA_BUCKET)
      .getPublicUrl(publicObjectPath)

    stagedMedia.push({
      id: media.id,
      public_bucket: PUBLIC_MEDIA_BUCKET,
      public_object_path: publicObjectPath,
      public_url: publicUrlData.publicUrl,
    })
  }

  return { stagedMedia }
}

async function createPublicationAttempt(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  attemptId: string,
  postId: string,
  actorId: string,
  expectedUpdatedAt: string,
) {
  const { error } = await showroomAdmin.rpc('create_blog_publication_attempt' as never, {
    p_publication_attempt_id: attemptId,
    p_post_id: postId,
    p_actor_id: actorId,
    p_expected_updated_at: expectedUpdatedAt,
  } as never)
  if (error) {
    const isStale = error.message.includes('changed since the editor loaded')
      || error.message.includes('already in progress')
    throw new PublicationAttemptError(
      isStale
        ? '글 또는 발행 준비 상태가 바뀌었습니다. 최신본을 다시 불러와 확인해주세요.'
        : '안전한 발행 시도 기록을 만들지 못했습니다. DB 마이그레이션 상태를 확인해주세요.',
      isStale ? 'stale_revision' : undefined,
    )
  }
}

class PublicationAttemptError extends Error {
  constructor(
    message: string,
    readonly code?: 'stale_revision',
  ) {
    super(message)
    this.name = 'PublicationAttemptError'
  }
}

async function heartbeatPublicationAttempt(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  attemptId: string,
  actorId: string,
) {
  const { error } = await showroomAdmin.rpc('heartbeat_blog_publication_attempt' as never, {
    p_publication_attempt_id: attemptId,
    p_actor_id: actorId,
  } as never)
  if (error) {
    throw new PublicationAttemptError(
      '발행 사진 준비 시간이 만료됐거나 다른 복구 작업이 시작됐습니다. 준비한 사진을 정리한 뒤 최신본을 다시 불러와주세요.',
      'stale_revision',
    )
  }
}

async function recordPublicationAttemptPaths(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  attemptId: string,
  paths: string[],
) {
  const { data, error } = await showroomAdmin
    .from('blog_publication_attempts' as never)
    .update({
      object_paths: paths,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', attemptId)
    .eq('status', 'staged')
    .select('id')
  const updatedRows = (data ?? []) as Array<{ id: string }>
  if (error || updatedRows.length !== 1) {
    throw new Error('발행 사진 준비 기록을 정확히 저장하지 못했습니다.')
  }
}

async function markPublicationAttemptAfterCleanup(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  attemptId: string,
  paths: string[],
  reason: string,
) {
  const cleanupError = paths.length > 0
    ? (await showroomAdmin.storage.from(PUBLIC_MEDIA_BUCKET).remove(paths)).error
    : null

  const { error: attemptUpdateError } = await showroomAdmin
    .from('blog_publication_attempts' as never)
    .update({
      status: cleanupError ? 'reconcile' : 'abandoned',
      object_paths: paths,
      last_error: cleanupError?.message ?? reason,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', attemptId)
    .in('status', ['staged', 'reconcile'])

  return Boolean(cleanupError || attemptUpdateError)
}

type PublicationResolution =
  | {
    kind: 'published'
    publishedAt: string
    updatedAt: string
    retiredPublicPaths: string[]
    retiredCleanupJobId: string | null
  }
  | { kind: 'rolled_back'; cleanupPending: boolean }
  | { kind: 'unknown' }

async function resolveAmbiguousPublication(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  attemptId: string,
  uploadedPaths: string[],
  reason: string,
): Promise<PublicationResolution> {
  const { data, error } = await showroomAdmin.rpc('resolve_blog_publication_attempt' as never, {
    p_publication_attempt_id: attemptId,
  } as never)
  if (error || !data) return { kind: 'unknown' }

  const attempt = data as {
    status?: string
    post_status?: string
    published_at?: string | null
    updated_at?: string | null
    object_paths?: string[]
    retired_public_paths?: string[]
    retired_cleanup_job_id?: string | null
  }
  if (
    attempt.status === 'published'
    && attempt.post_status === 'published'
    && typeof attempt.published_at === 'string'
    && typeof attempt.updated_at === 'string'
  ) {
    return {
      kind: 'published',
      publishedAt: attempt.published_at,
      updatedAt: attempt.updated_at,
      retiredPublicPaths: attempt.retired_public_paths ?? [],
      retiredCleanupJobId: attempt.retired_cleanup_job_id ?? null,
    }
  }
  if (attempt.status !== 'staged' && attempt.status !== 'reconcile') return { kind: 'unknown' }

  const paths = attempt.object_paths?.length ? attempt.object_paths : uploadedPaths
  const cleanupPending = await markPublicationAttemptAfterCleanup(
    showroomAdmin,
    attemptId,
    paths,
    reason,
  )
  return { kind: 'rolled_back', cleanupPending }
}

export async function publishBlogEditor(
  payload: SaveBlogEditorPayload,
): Promise<PublishBlogPostResult> {
  let uploadedPaths: string[] = []
  let publicationAttemptId: string | null = null
  let publicationRpcInvoked = false
  let showroomAdmin: ReturnType<typeof createShowroomAdminClient> | null = null

  try {
    const actorId = await requireAdministrator()
    const validationError = validatePayload(payload)
    if (validationError) return { ok: false, message: validationError, issues: [validationError] }

    showroomAdmin = createShowroomAdminClient()
    const relatedPostError = await validateRelatedPostBlocks(showroomAdmin, payload.blocks)
    if (relatedPostError) return { ok: false, message: relatedPostError, issues: [relatedPostError] }

    const mediaOwnershipError = await validateImageMediaOwnership(showroomAdmin, payload)
    if (mediaOwnershipError) {
      return { ok: false, message: mediaOwnershipError, issues: [mediaOwnershipError] }
    }

    const [postResult, mediaResult] = await Promise.all([
      showroomAdmin
        .from('blog_posts')
        .select('id, title, slug, excerpt, seo_title, meta_description, canonical_url, status, category, primary_keyword, target_question, summary_answer, related_questions, service_area, product_type, source_evidence, brand_check_result, ai_citation_ready, media_missing_reason, created_by, reviewed_by, published_by, published_at, created_at, updated_at')
        .eq('id', payload.postId)
        .single(),
      showroomAdmin
        .from('blog_media')
        .select('id, post_id, content_asset_id, source_type, source_measurement_media_id, source_as_media_id, private_bucket, private_object_path, public_bucket, public_object_path, public_url, alt_text, caption, source_label, usage_status, privacy_checked, promotion_consent_checked, used_as_cover, approved_by, approved_at, published_at, rejection_reason, created_at, updated_at')
        .eq('post_id', payload.postId),
    ])

    const currentPost = postResult.data as BlogPost | null
    const media = (mediaResult.data ?? []) as BlogMedia[]
    if (postResult.error || !currentPost) {
      return { ok: false, message: '발행할 글을 찾지 못했습니다.' }
    }
    if (mediaResult.error) {
      return { ok: false, message: '사진 정보를 불러오지 못했습니다.' }
    }
    if (currentPost.status === 'published') {
      return { ok: false, message: '이미 발행된 글입니다.' }
    }
    if (currentPost.status === 'archived') {
      return { ok: false, message: '휴지통의 글은 발행할 수 없습니다.' }
    }
    if (currentPost.updated_at !== payload.expectedUpdatedAt) {
      return {
        ok: false,
        message: '다른 작업에서 글이 변경되었습니다. 최신본을 다시 불러온 뒤 변경 내용을 확인해주세요.',
        code: 'stale_revision',
      }
    }

    const generatedAt = new Date().toISOString()
    const rpcBlocks = rpcBlocksPayload(payload, generatedAt)
    const nextPost = nextPostForPublication(currentPost, payload)
    const nextBlocks = nextBlocksForPublication(payload, rpcBlocks)
    const gate = validatePublishGate(nextPost, nextBlocks, media)
    const centralBrandIssues = await centralBrandMediaPublicationIssues(showroomAdmin, gate.mediaToPublish)
    const publishIssues = [...new Set([...gate.issues, ...centralBrandIssues])]
    if (publishIssues.length > 0) {
      return {
        ok: false,
        message: '발행 전 확인이 필요한 항목이 있습니다.',
        issues: publishIssues,
      }
    }

    publicationAttemptId = randomUUID()
    await createPublicationAttempt(
      showroomAdmin,
      publicationAttemptId,
      payload.postId,
      actorId,
      payload.expectedUpdatedAt,
    )
    const staged = await stageMediaForAtomicPublication(
      showroomAdmin,
      payload.postId,
      publicationAttemptId,
      actorId,
      gate.mediaToPublish,
      uploadedPaths,
    )
    const publishedAt = new Date().toISOString()

    publicationRpcInvoked = true
    const { data: publishData, error: publishError } = await showroomAdmin.rpc('save_and_publish_blog_post' as never, {
      p_publication_attempt_id: publicationAttemptId,
      p_post_id: payload.postId,
      p_expected_updated_at: payload.expectedUpdatedAt,
      p_actor_id: actorId,
      p_post: rpcPostPayload(payload),
      p_blocks: rpcBlocks,
      p_media: staged.stagedMedia,
      p_published_at: publishedAt,
    } as never)

    if (publishError) {
      const resolution = await resolveAmbiguousPublication(
        showroomAdmin,
        publicationAttemptId,
        uploadedPaths,
        publishError.message,
      )
      if (resolution.kind === 'published') {
        const cleanupPending = await cleanupTrackedPublicObjects(
          showroomAdmin,
          resolution.retiredPublicPaths,
          resolution.retiredCleanupJobId,
        )
        uploadedPaths = []
        revalidateBlogEditorPaths(payload.postId, [currentPost.slug, payload.post.slug], true)
        return {
          ok: true,
          message: cleanupPending
            ? '발행은 완료됐습니다. 교체된 이전 공개 사진 정리는 재시도 대기열에 남겼습니다.'
            : '발행 응답이 지연됐지만 DB에서 완료 상태를 확인했습니다.',
          publishedAt: resolution.publishedAt,
          updatedAt: resolution.updatedAt,
          slug: payload.post.slug.trim(),
        }
      }
      if (resolution.kind === 'unknown') {
        uploadedPaths = []
        return {
          ok: false,
          message: '발행 결과를 아직 확정할 수 없습니다. 공개 사진은 삭제하지 않았습니다. 최신본 다시 불러오기로 상태를 확인해주세요.',
          code: 'publication_unknown',
        }
      }

      uploadedPaths = []
      return {
        ok: false,
        message: resolution.cleanupPending
          ? '발행은 반영되지 않았고 준비한 사진 정리는 재조정 대상으로 남겼습니다.'
          : '글이 변경되었거나 발행 안전 검사를 통과하지 못했습니다. 최신본을 다시 불러와 확인해주세요.',
      }
    }
    uploadedPaths = []
    const committedPublication = publishData as {
      published_at?: string
      updated_at?: string
      retired_public_paths?: string[]
      retired_cleanup_job_id?: string | null
    } | null
    if (
      typeof committedPublication?.published_at !== 'string'
      || typeof committedPublication.updated_at !== 'string'
    ) {
      revalidateBlogEditorPaths(payload.postId, [currentPost.slug, payload.post.slug], true)
      return {
        ok: false,
        message: '발행은 처리됐지만 최신 revision 응답을 확인하지 못했습니다. 최신본 다시 불러오기로 상태를 확인해 주세요.',
        code: 'publication_unknown',
      }
    }
    const cleanupPending = await cleanupTrackedPublicObjects(
      showroomAdmin,
      committedPublication?.retired_public_paths ?? [],
      committedPublication?.retired_cleanup_job_id ?? null,
    )
    revalidateBlogEditorPaths(payload.postId, [currentPost.slug, payload.post.slug], true)
    return {
      ok: true,
      message: cleanupPending
        ? '현재 편집 내용을 저장하고 발행했습니다. 교체된 이전 공개 사진 정리는 재시도 대기열에 남겼습니다.'
        : '현재 편집 내용을 저장하고 발행했습니다.',
      publishedAt: committedPublication.published_at,
      updatedAt: committedPublication.updated_at,
      slug: payload.post.slug.trim(),
    }
  } catch (error) {
    if (showroomAdmin && publicationAttemptId) {
      if (publicationRpcInvoked) {
        const resolution = await resolveAmbiguousPublication(
          showroomAdmin,
          publicationAttemptId,
          uploadedPaths,
          error instanceof Error ? error.message : 'ambiguous publication error',
        )
        if (resolution.kind === 'published') {
          const cleanupPending = await cleanupTrackedPublicObjects(
            showroomAdmin,
            resolution.retiredPublicPaths,
            resolution.retiredCleanupJobId,
          )
          return {
            ok: true,
            message: cleanupPending
              ? '발행은 완료됐습니다. 교체된 이전 공개 사진 정리는 재시도 대기열에 남겼습니다.'
              : '발행 응답이 지연됐지만 DB에서 완료 상태를 확인했습니다.',
            publishedAt: resolution.publishedAt,
            updatedAt: resolution.updatedAt,
            slug: payload.post.slug.trim(),
          }
        }
        if (resolution.kind === 'unknown') {
          return {
            ok: false,
            message: '발행 결과를 아직 확정할 수 없습니다. 공개 사진은 삭제하지 않았습니다. 최신본 다시 불러오기로 상태를 확인해주세요.',
            code: 'publication_unknown',
          }
        }
      } else {
        await markPublicationAttemptAfterCleanup(
          showroomAdmin,
          publicationAttemptId,
          uploadedPaths,
          error instanceof Error ? error.message : 'publication staging failed',
        )
      }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : '발행 중 오류가 발생했습니다.',
      code: error instanceof PublicationAttemptError ? error.code : undefined,
    }
  }
}

export async function updateBlogPostStatus(
  postId: string,
  toStatus: BlogPostStatus,
): Promise<UpdateBlogPostStatusResult> {
  try {
    const actorId = await requireAdministrator()

    if (!postId) {
      return { ok: false, message: '글 ID가 없습니다.' }
    }

    if (toStatus === 'published') {
      return { ok: false, message: '공개 발행은 발행 버튼에서만 진행할 수 있습니다.' }
    }

    const showroomAdmin = createShowroomAdminClient()
    const [postResult, blocksResult, mediaResult] = await Promise.all([
      showroomAdmin
        .from('blog_posts')
        .select('id, title, slug, excerpt, seo_title, meta_description, canonical_url, status, category, primary_keyword, target_question, summary_answer, related_questions, service_area, product_type, source_evidence, brand_check_result, ai_citation_ready, media_missing_reason, created_by, reviewed_by, published_by, published_at, created_at, updated_at')
        .eq('id', postId)
        .single(),
      showroomAdmin
        .from('blog_blocks')
        .select('id, post_id, display_order, type, heading_level, text, media_id, metadata, created_at, updated_at')
        .eq('post_id', postId)
        .order('display_order', { ascending: true }),
      showroomAdmin
        .from('blog_media')
        .select('id, post_id, content_asset_id, source_type, source_measurement_media_id, source_as_media_id, private_bucket, private_object_path, public_bucket, public_object_path, public_url, alt_text, caption, source_label, usage_status, privacy_checked, promotion_consent_checked, used_as_cover, approved_by, approved_at, published_at, rejection_reason, created_at, updated_at')
        .eq('post_id', postId),
    ])

    const post = postResult.data as BlogPost | null
    const blocks = (blocksResult.data ?? []) as BlogBlock[]
    const media = (mediaResult.data ?? []) as BlogMedia[]

    if (postResult.error || !post) {
      return { ok: false, message: '상태를 바꿀 글을 찾지 못했습니다.' }
    }

    if (blocksResult.error) {
      return { ok: false, message: '본문 정보를 불러오지 못했습니다.' }
    }

    if (mediaResult.error) {
      return { ok: false, message: '사진 정보를 불러오지 못했습니다.' }
    }

    if (!isAllowedManualBlogStatusTransition(post.status, toStatus)) {
      return {
        ok: false,
        message: '허용되지 않는 상태 변경입니다.',
        issues: [`${post.status} 상태에서 ${toStatus} 상태로 바로 변경할 수 없습니다.`],
      }
    }

    if (toStatus === 'archived' || (post.status === 'archived' && toStatus === 'reviewing')) {
      const { data: trashTransitionData, error: trashTransitionError } = await showroomAdmin.rpc('transition_blog_post_trash' as never, {
        p_post_id: post.id,
        p_actor_id: actorId,
        p_restore: toStatus === 'reviewing',
      } as never)
      if (trashTransitionError) {
        return {
          ok: false,
          code: 'revision_unknown',
          message: toStatus === 'archived'
            ? '글을 휴지통으로 이동하지 못했습니다. 새로고침 후 다시 시도해주세요.'
            : '글을 휴지통에서 복원하지 못했습니다. 새로고침 후 다시 시도해주세요.',
        }
      }

      const transition = trashTransitionData as {
        changed_at?: string
        public_paths?: string[]
        cleanup_job_id?: string | null
      } | null
      const cleanupPending = toStatus === 'archived'
        ? await cleanupTrackedPublicObjects(
          showroomAdmin,
          transition?.public_paths ?? [],
          transition?.cleanup_job_id ?? null,
        )
        : false

      revalidateBlogEditorPaths(post.id, [post.slug], post.status === 'published')
      if (typeof transition?.changed_at !== 'string') {
        return {
          ok: false,
          code: 'revision_unknown',
          message: '상태 변경은 처리됐지만 최신 revision 응답을 확인하지 못했습니다. 최신본 다시 불러오기로 상태를 확인해 주세요.',
        }
      }
      return {
        ok: true,
        message: toStatus === 'archived'
          ? cleanupPending
            ? '글 공개는 중단했고, 공개 사진 정리는 안전한 재시도 대기열에 남겼습니다.'
            : '글을 휴지통으로 이동하고 공개 사진을 정리했습니다.'
          : '글을 초안으로 복원했습니다.',
        status: toStatus,
        updatedAt: transition.changed_at,
      }
    }

    if (toStatus === 'ready') {
      const issues = validateReadyGate(post, blocks, media)
      if (issues.length > 0) {
        return {
          ok: false,
          message: '발행 대기로 변경하기 전에 확인할 항목이 있습니다.',
          issues,
        }
      }
    }

    const updatedAt = new Date().toISOString()
    const updatePayload: Database['showroom']['Tables']['blog_posts']['Update'] = {
      status: toStatus,
      updated_at: updatedAt,
      reviewed_by: toStatus === 'ready' || toStatus === 'reviewing' ? actorId : post.reviewed_by,
    }

    const { data: updatedPostData, error: updateError } = await showroomAdmin
      .from('blog_posts')
      .update(updatePayload as never)
      .eq('id', post.id)
      .eq('status', post.status)
      .select('id, status, updated_at')

    if (updateError) {
      return { ok: false, message: '글 상태를 저장하지 못했습니다.' }
    }

    const updatedRows = (updatedPostData ?? []) as Array<{ id: string; status: BlogPostStatus; updated_at: string }>
    if (updatedRows.length !== 1) {
      return { ok: false, message: '글 상태가 바뀌었습니다. 새로고침 후 다시 시도해주세요.' }
    }
    if (typeof updatedRows[0].updated_at !== 'string') {
    return {
      ok: false,
      code: 'revision_unknown',
      message: '상태 변경은 처리됐지만 최신 revision 응답을 확인하지 못했습니다. 최신본 다시 불러오기로 상태를 확인해 주세요.',
    }
    }

    const { error: eventError } = await showroomAdmin
      .from('blog_post_events')
      .insert({
        post_id: post.id,
        actor_id: actorId,
        event_type: 'status_changed',
        from_status: post.status,
        to_status: toStatus,
        memo: toStatus === 'ready'
          ? '발행 대기 검수를 통과했습니다.'
          : '관리자가 블로그 글 상태를 변경했습니다.',
        metadata: {
          from_status: post.status,
          to_status: toStatus,
        },
      } as never)

    if (eventError) {
      await showroomAdmin
        .from('blog_posts')
        .update({
          status: post.status,
          reviewed_by: post.reviewed_by,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', post.id)
        .eq('status', toStatus)

      return { ok: false, message: '상태 변경 기록을 남기지 못했습니다.' }
    }

    revalidateBlogEditorPaths(post.id, [post.slug], true)

    return {
      ok: true,
      message: '상태를 변경했습니다.',
      status: toStatus,
      updatedAt: updatedRows[0].updated_at,
    }
  } catch {
    return {
      ok: false,
      message: '상태 변경 중 오류가 발생했습니다.',
    }
  }
}

async function cleanupTrackedPublicObjects(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  paths: string[],
  cleanupJobId: string | null,
  attemptCount = 1,
) {
  if (paths.length === 0) return false

  const { error: cleanupError } = await showroomAdmin.storage
    .from(PUBLIC_MEDIA_BUCKET)
    .remove(paths)

  let ledgerError: { message?: string } | null = null
  if (!cleanupError) {
    const { error } = await showroomAdmin
      .from('blog_public_media_objects' as never)
      .update({
        state: 'deleted',
        deleted_at: new Date().toISOString(),
      } as never)
      .in('object_path', paths)
    ledgerError = error
  }

  let jobUpdateError: { message?: string } | null = null
  if (cleanupJobId) {
    const { error } = await showroomAdmin
      .from('storage_cleanup_jobs' as never)
      .update({
        status: cleanupError || ledgerError ? 'failed' : 'completed',
        attempts: attemptCount,
        last_error: cleanupError?.message ?? ledgerError?.message ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', cleanupJobId)
    jobUpdateError = error
  }

  return Boolean(cleanupError || ledgerError || jobUpdateError)
}

export async function publishBlogPost(postId: string): Promise<PublishBlogPostResult> {
  try {
    await requireAdministrator()
    if (!postId) {
      return { ok: false, message: '글 ID가 없습니다.' }
    }
    return {
      ok: false,
      message: '저장 내용이 없는 이전 발행 방식은 더 이상 지원하지 않습니다. 에디터의 발행 버튼을 사용해주세요.',
    }
  } catch {
    return {
      ok: false,
      message: '발행 권한을 확인하지 못했습니다.',
    }
  }
}

export async function permanentlyDeleteBlogPost(
  postId: string,
  confirmation: string,
): Promise<PermanentlyDeleteBlogPostResult> {
  try {
    const actorId = await requireAdministrator()
    if (!postId || !confirmation) {
      return { ok: false, message: '영구삭제할 글과 확인용 제목이 필요합니다.' }
    }

    const showroomAdmin = createShowroomAdminClient()
    const { data, error } = await showroomAdmin.rpc('permanently_delete_blog_post' as never, {
      p_post_id: postId,
      p_actor_id: actorId,
      p_confirmation: confirmation,
    } as never)
    if (error) {
      const reason = error.message.toLowerCase()
      return {
        ok: false,
        message: reason.includes('exact post title')
          ? '휴지통의 글 제목을 정확히 입력해야 영구삭제할 수 있습니다.'
          : reason.includes('only a trashed post')
            ? '휴지통에 있는 글만 영구삭제할 수 있습니다.'
            : reason.includes('save is already in progress')
              ? '다른 저장 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.'
              : '영구삭제 안전 검사를 완료하지 못했습니다. 글은 삭제되지 않았습니다.',
      }
    }

    const result = data as {
      cleanup_job_id?: string | null
      public_paths?: string[]
      slug?: string
    } | null
    const publicPaths = result?.public_paths ?? []
    const cleanupJobId = result?.cleanup_job_id ?? null
    let cleanupPending = false

    if (publicPaths.length > 0) {
      cleanupPending = await cleanupTrackedPublicObjects(
        showroomAdmin,
        publicPaths,
        cleanupJobId,
      )
    }

    revalidatePath('/admin/platform/blog')
    revalidatePath('/blog')
    revalidatePath('/sitemap.xml')
    if (result?.slug) revalidatePath(`/blog/${result.slug}`)

    return {
      ok: true,
      message: cleanupPending
        ? '글은 영구삭제했고 공개 사진 정리는 재시도 대기열에 남겼습니다.'
        : '글을 영구삭제했습니다.',
    }
  } catch {
    return {
      ok: false,
      message: '영구삭제 중 오류가 발생했습니다.',
    }
  }
}

export async function retryPendingBlogMediaCleanup() {
  try {
    const actorId = await requireAdministrator()
    const showroomAdmin = createShowroomAdminClient()
    const now = new Date().toISOString()
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const { data: expiredData, error: expiredError } = await showroomAdmin
      .from('blog_publication_attempts' as never)
      .select('id')
      .eq('status', 'staged')
      .lte('staging_expires_at', now)
      .order('staging_expires_at', { ascending: true })
      .limit(20)
    if (expiredError) return { ok: false, message: '만료된 발행 사진 준비 작업을 확인하지 못했습니다.' }

    let claimedAttempts = 0
    let claimFailures = 0
    for (const attempt of (expiredData ?? []) as Array<{ id: string }>) {
      const { data: claimed, error: claimError } = await showroomAdmin.rpc(
        'claim_expired_blog_publication_attempt' as never,
        {
          p_publication_attempt_id: attempt.id,
          p_actor_id: actorId,
        } as never,
      )
      if (claimError) claimFailures += 1
      else if (claimed) claimedAttempts += 1
    }

    const { data: attemptData, error: attemptError } = await showroomAdmin
      .from('blog_publication_attempts' as never)
      .select('id, post_id, object_paths, status')
      .eq('status', 'reconcile')
      .lt('updated_at', cutoff)
      .order('updated_at', { ascending: true })
      .limit(20)
    if (attemptError) return { ok: false, message: '발행 사진 재조정 대기열을 확인하지 못했습니다.' }

    const attempts = (attemptData ?? []) as Array<{
      id: string
      post_id: string
      object_paths: string[]
      status: string
    }>
    let reconciledAttempts = 0
    let failedAttempts = 0
    for (const attempt of attempts) {
      const resolution = await resolveAmbiguousPublication(
        showroomAdmin,
        attempt.id,
        attempt.object_paths,
        'administrator cleanup retry',
      )
      if (resolution.kind === 'rolled_back' && !resolution.cleanupPending) reconciledAttempts += 1
      else if (resolution.kind === 'unknown' || (resolution.kind === 'rolled_back' && resolution.cleanupPending)) failedAttempts += 1
    }

    const { data, error } = await showroomAdmin
      .from('storage_cleanup_jobs' as never)
      .select('id, object_paths, attempts, reason')
      .in('status', ['pending', 'failed'])
      .or('reason.like.trashed_blog_post:%,reason.like.permanently_deleted_blog_post:%,reason.like.retired_blog_publication:%')
      .order('created_at', { ascending: true })
      .limit(20)
    if (error) return { ok: false, message: '공개 사진 정리 대기열을 확인하지 못했습니다.' }

    const jobs = (data ?? []) as Array<{
      id: string
      object_paths: string[]
      attempts: number
      reason: string
    }>
    let completed = 0
    let failed = 0
    for (const job of jobs) {
      const cleanupPending = await cleanupTrackedPublicObjects(
        showroomAdmin,
        job.object_paths,
        job.id,
        job.attempts + 1,
      )
      if (cleanupPending) failed += 1
      else completed += 1
    }

    return {
      ok: failed === 0 && failedAttempts === 0 && claimFailures === 0,
      message: jobs.length === 0 && attempts.length === 0 && claimedAttempts === 0
        ? '정리할 공개 사진이 없습니다.'
        : failed > 0 || failedAttempts > 0 || claimFailures > 0
          ? `${completed + reconciledAttempts}건을 정리했고 ${failed + failedAttempts + claimFailures}건은 다음 재시도에 남겼습니다.`
          : claimedAttempts > 0
            ? `${completed + reconciledAttempts}건을 정리했고, 만료된 발행 준비 ${claimedAttempts}건은 안전 유예 후 정리 대기열로 옮겼습니다.`
            : `${completed + reconciledAttempts}건의 공개 사진 정리를 완료했습니다.`,
    }
  } catch {
    return { ok: false, message: '공개 사진 정리를 다시 시도하지 못했습니다.' }
  }
}
