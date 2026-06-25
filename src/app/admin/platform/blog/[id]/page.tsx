import { notFound, redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { BlogBlockType, BlogMediaUsageStatus, Database, Json } from '@/types/database'
import BlogEditorClient, { type BlogEditorBlock, type BlogEditorMedia, type BlogEditorPost, type BlogEditorEvent } from './BlogEditorClient'

export const metadata = {
  title: '블로그 초안 편집 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

type BlogPost = Database['showroom']['Tables']['blog_posts']['Row']
type BlogBlock = Database['showroom']['Tables']['blog_blocks']['Row']
type BlogMedia = Database['showroom']['Tables']['blog_media']['Row']
type BlogEvent = Database['showroom']['Tables']['blog_post_events']['Row']

function isJsonArray(value: Json): value is Json[] {
  return Array.isArray(value)
}

function isJsonObject(value: Json): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function jsonString(value: Json | undefined) {
  return typeof value === 'string' ? value : ''
}

function metadataToStringMap(value: Json) {
  if (!isJsonObject(value)) return {}

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      acc[key] = String(entry)
    }
    return acc
  }, {})
}

function relatedQuestionsToStrings(value: Json) {
  if (!isJsonArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function summarizeBrandCheck(value: Json) {
  if (!isJsonObject(value)) {
    return {
      hasResult: false,
      forbiddenExpression: false,
      warningCount: 0,
    }
  }

  const warningCount =
    (Array.isArray(value.warnings) ? value.warnings.length : 0) +
    (Array.isArray(value.forbidden_terms) ? value.forbidden_terms.length : 0) +
    (Array.isArray(value.prohibited_terms) ? value.prohibited_terms.length : 0) +
    (Array.isArray(value.blockers) ? value.blockers.length : 0)

  return {
    hasResult: Object.keys(value).length > 0,
    forbiddenExpression:
      value.passed === false ||
      jsonString(value.status) === 'failed' ||
      jsonString(value.status) === 'blocked' ||
      warningCount > 0,
    warningCount,
  }
}

function summarizeSourceEvidence(value: Json) {
  return isJsonArray(value) ? value.length : 0
}

function mediaStatusCount(media: BlogMedia[]) {
  return media.reduce<Record<BlogMediaUsageStatus, number>>((acc, item) => {
    acc[item.usage_status] += 1
    return acc
  }, {
    candidate: 0,
    approved: 0,
    published: 0,
    rejected: 0,
  })
}

function toEditorPost(post: BlogPost, media: BlogMedia[], blocks: BlogBlock[]): BlogEditorPost {
  const brandCheck = summarizeBrandCheck(post.brand_check_result)
  const sourceEvidenceCount = summarizeSourceEvidence(post.source_evidence)
  const statusCounts = mediaStatusCount(media)
  const publicReadyMedia = media.filter(item => item.usage_status === 'approved' || item.usage_status === 'published')

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    status: post.status,
    category: post.category,
    seoTitle: post.seo_title,
    metaDescription: post.meta_description,
    canonicalUrl: post.canonical_url,
    primaryKeyword: post.primary_keyword,
    targetQuestion: post.target_question,
    summaryAnswer: post.summary_answer,
    relatedQuestions: relatedQuestionsToStrings(post.related_questions),
    serviceArea: post.service_area,
    productType: post.product_type,
    aiCitationReady: post.ai_citation_ready,
    lastFactCheckedAt: post.last_fact_checked_at,
    mediaMissingReason: post.media_missing_reason,
    publishedAt: post.published_at,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    gateSummary: {
      sourceEvidenceCount,
      brandCheck,
      blockCount: blocks.length,
      ctaCount: blocks.filter(block => block.type === 'cta').length,
      imageSlotCount: blocks.filter(block => block.type === 'image').length,
      mediaTotal: media.length,
      mediaStatusCount: statusCounts,
      coverReady: publicReadyMedia.some(item => item.used_as_cover),
      publicAltMissing: publicReadyMedia.some(item => !item.alt_text?.trim()),
      mediaConsentMissing: publicReadyMedia.some(item => !item.privacy_checked || !item.promotion_consent_checked),
    },
  }
}

function toEditorBlock(block: BlogBlock): BlogEditorBlock {
  return {
    id: block.id,
    type: block.type as BlogBlockType,
    headingLevel: block.heading_level,
    text: block.text,
    mediaId: block.media_id,
    metadata: metadataToStringMap(block.metadata),
    displayOrder: block.display_order,
  }
}

async function createPrivatePreviewUrl(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  item: BlogMedia,
) {
  if (!item.private_bucket || !item.private_object_path) return null

  const { data, error } = await showroomAdmin.storage
    .from(item.private_bucket)
    .createSignedUrl(item.private_object_path, 300)

  if (error || !data?.signedUrl) return null

  return data.signedUrl
}

function toEditorMedia(item: BlogMedia, signedPreviewUrl: string | null): BlogEditorMedia {
  return {
    id: item.id,
    sourceType: item.source_type,
    sourceLabel: item.source_label,
    usageStatus: item.usage_status,
    altText: item.alt_text,
    caption: item.caption,
    privacyChecked: item.privacy_checked,
    promotionConsentChecked: item.promotion_consent_checked,
    usedAsCover: item.used_as_cover,
    publicUrl: item.public_url,
    signedPreviewUrl,
    hasPrivateObject: Boolean(item.private_bucket && item.private_object_path),
    hasPublicObject: Boolean(item.public_bucket && item.public_object_path),
    approvedAt: item.approved_at,
    publishedAt: item.published_at,
    rejectionReason: item.rejection_reason,
    createdAt: item.created_at,
  }
}

function toEditorEvent(event: BlogEvent): BlogEditorEvent {
  return {
    id: event.id,
    type: event.event_type,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    memo: event.memo,
    createdAt: event.created_at,
  }
}

export default async function AdminPlatformBlogEditorPage({ params }: Props) {
  const { id } = await params

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
    redirect('/portal')
  }

  const showroomAdmin = createShowroomAdminClient()

  const [
    postResult,
    blocksResult,
    mediaResult,
    eventsResult,
  ] = await Promise.all([
    showroomAdmin
      .from('blog_posts')
      .select('id, title, slug, excerpt, seo_title, meta_description, canonical_url, status, category, primary_keyword, target_question, summary_answer, related_questions, service_area, product_type, source_evidence, brand_check_result, ai_citation_ready, last_fact_checked_at, media_missing_reason, published_at, created_at, updated_at')
      .eq('id', id)
      .single(),
    showroomAdmin
      .from('blog_blocks')
      .select('id, post_id, display_order, type, heading_level, text, media_id, metadata, created_at, updated_at')
      .eq('post_id', id)
      .order('display_order', { ascending: true }),
    showroomAdmin
      .from('blog_media')
      .select('id, post_id, source_type, source_label, usage_status, alt_text, caption, privacy_checked, promotion_consent_checked, used_as_cover, public_url, private_bucket, private_object_path, public_bucket, public_object_path, approved_at, published_at, rejection_reason, created_at, updated_at')
      .eq('post_id', id)
      .order('created_at', { ascending: true }),
    showroomAdmin
      .from('blog_post_events')
      .select('id, post_id, actor_id, event_type, from_status, to_status, memo, metadata, created_at')
      .eq('post_id', id)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const typedPostResult = postResult as { data: BlogPost | null; error: unknown }
  const typedBlocksResult = blocksResult as { data: BlogBlock[] | null }
  const typedMediaResult = mediaResult as { data: BlogMedia[] | null }
  const typedEventsResult = eventsResult as { data: BlogEvent[] | null }

  if (typedPostResult.error || !typedPostResult.data) {
    notFound()
  }

  const post = typedPostResult.data
  const blocks = typedBlocksResult.data ?? []
  const media = typedMediaResult.data ?? []
  const events = typedEventsResult.data ?? []
  const mediaPreviewUrls = await Promise.all(media.map(item => createPrivatePreviewUrl(showroomAdmin, item)))

  return (
    <BlogEditorClient
      initialPost={toEditorPost(post, media, blocks)}
      initialBlocks={blocks.map(toEditorBlock)}
      media={media.map((item, index) => toEditorMedia(item, mediaPreviewUrls[index] ?? null))}
      events={events.map(toEditorEvent)}
    />
  )
}
