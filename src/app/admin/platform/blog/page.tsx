import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type {
  BlogContentCategory,
  BlogMediaUsageStatus,
  BlogPostStatus,
  Database,
  Json,
} from '@/types/database'
import BlogDraftQueueClient, { type BlogDraftQueueRow } from './BlogDraftQueueClient'

export const metadata = {
  title: '블로그 콘텐츠 큐 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

type BlogPostRow = Pick<
  Database['showroom']['Tables']['blog_posts']['Row'],
  | 'id'
  | 'title'
  | 'slug'
  | 'status'
  | 'category'
  | 'primary_keyword'
  | 'target_question'
  | 'summary_answer'
  | 'service_area'
  | 'product_type'
  | 'seo_title'
  | 'meta_description'
  | 'brand_check_result'
  | 'last_fact_checked_at'
  | 'media_missing_reason'
  | 'updated_at'
  | 'created_at'
>

type MediaSummaryRow = Pick<
  Database['showroom']['Tables']['blog_media']['Row'],
  'post_id' | 'usage_status' | 'alt_text' | 'used_as_cover' | 'privacy_checked' | 'promotion_consent_checked'
>

type BlockSummaryRow = Pick<
  Database['showroom']['Tables']['blog_blocks']['Row'],
  'post_id' | 'type'
>

type EventSummaryRow = Pick<
  Database['showroom']['Tables']['blog_post_events']['Row'],
  'post_id' | 'event_type' | 'created_at' | 'memo'
>

function isRecord(value: Json): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function jsonNumber(value: Json | undefined) {
  return typeof value === 'number' ? value : 0
}

function jsonArrayLength(value: Json | undefined) {
  return Array.isArray(value) ? value.length : 0
}

function hasForbiddenExpression(value: Json) {
  if (!isRecord(value)) return false

  const passed = value.passed
  const status = typeof value.status === 'string' ? value.status : ''
  const forbiddenCount =
    jsonNumber(value.forbidden_count) +
    jsonNumber(value.prohibited_count) +
    jsonArrayLength(value.forbidden_terms) +
    jsonArrayLength(value.prohibited_terms) +
    jsonArrayLength(value.blockers)

  return passed === false || status === 'failed' || status === 'blocked' || forbiddenCount > 0
}

function summarizeMedia(rows: MediaSummaryRow[]) {
  const byStatus = rows.reduce<Record<BlogMediaUsageStatus, number>>((acc, row) => {
    acc[row.usage_status] += 1
    return acc
  }, {
    candidate: 0,
    approved: 0,
    published: 0,
    rejected: 0,
  })

  const publicReadyRows = rows.filter(row => row.usage_status === 'approved' || row.usage_status === 'published')
  const altMissing = publicReadyRows.some(row => !row.alt_text?.trim())
  const coverReady = publicReadyRows.some(row => row.used_as_cover)
  const approvalGateIncomplete = publicReadyRows.some(row => !row.privacy_checked || !row.promotion_consent_checked)

  return {
    total: rows.length,
    byStatus,
    altMissing,
    coverReady,
    approvalGateIncomplete,
    hasCandidate: byStatus.candidate > 0,
    hasApprovedOrPublished: publicReadyRows.length > 0,
  }
}

function latestEvent(rows: EventSummaryRow[]) {
  return rows
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .at(0)
}

export default async function AdminPlatformBlogPage() {
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

  const { data: postsData, error: postsError } = await showroomAdmin
    .from('blog_posts')
    .select('id, title, slug, status, category, primary_keyword, target_question, summary_answer, service_area, product_type, seo_title, meta_description, brand_check_result, last_fact_checked_at, media_missing_reason, updated_at, created_at')
    .order('updated_at', { ascending: false })
    .limit(200)

  if (postsError) {
    return <BlogDraftQueueClient initialRows={[]} loadError="블로그 콘텐츠 목록을 불러오지 못했습니다." />
  }

  const posts = (postsData ?? []) as BlogPostRow[]
  const postIds = posts.map(post => post.id)

  const [mediaResult, blocksResult, eventsResult] = await Promise.all([
    postIds.length > 0
      ? showroomAdmin
        .from('blog_media')
        .select('post_id, usage_status, alt_text, used_as_cover, privacy_checked, promotion_consent_checked')
        .in('post_id', postIds)
      : Promise.resolve({ data: [] as MediaSummaryRow[], error: null }),
    postIds.length > 0
      ? showroomAdmin
        .from('blog_blocks')
        .select('post_id, type')
        .in('post_id', postIds)
      : Promise.resolve({ data: [] as BlockSummaryRow[], error: null }),
    postIds.length > 0
      ? showroomAdmin
        .from('blog_post_events')
        .select('post_id, event_type, created_at, memo')
        .in('post_id', postIds)
        .order('created_at', { ascending: false })
        .limit(300)
      : Promise.resolve({ data: [] as EventSummaryRow[], error: null }),
  ])

  const mediaRows = (mediaResult.data ?? []) as MediaSummaryRow[]
  const blockRows = (blocksResult.data ?? []) as BlockSummaryRow[]
  const eventRows = (eventsResult.data ?? []) as EventSummaryRow[]

  const mediaByPost = mediaRows.reduce<Record<string, MediaSummaryRow[]>>((acc, row) => {
    if (!row.post_id) return acc
    acc[row.post_id] = [...(acc[row.post_id] ?? []), row]
    return acc
  }, {})

  const ctaPostIds = new Set(blockRows.filter(row => row.type === 'cta').map(row => row.post_id))
  const eventsByPost = eventRows.reduce<Record<string, EventSummaryRow[]>>((acc, row) => {
    acc[row.post_id] = [...(acc[row.post_id] ?? []), row]
    return acc
  }, {})

  const rows: BlogDraftQueueRow[] = posts.map(post => {
    const media = summarizeMedia(mediaByPost[post.id] ?? [])
    const event = latestEvent(eventsByPost[post.id] ?? [])
    const needsMediaApproval =
      post.status === 'needs_media' ||
      media.hasCandidate ||
      (!media.hasApprovedOrPublished && !post.media_missing_reason)

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status as BlogPostStatus,
      category: post.category as BlogContentCategory,
      targetQuestion: post.target_question,
      primaryKeyword: post.primary_keyword,
      serviceArea: post.service_area,
      productType: post.product_type,
      summaryAnswer: post.summary_answer,
      seoTitle: post.seo_title,
      metaDescription: post.meta_description,
      mediaMissingReason: post.media_missing_reason,
      mediaSummary: media,
      updatedAt: post.updated_at,
      createdAt: post.created_at,
      latestEvent: event
        ? {
          type: event.event_type,
          memo: event.memo,
          createdAt: event.created_at,
        }
        : null,
      risks: {
        forbiddenExpression: hasForbiddenExpression(post.brand_check_result),
        evidenceNeeded: !post.last_fact_checked_at,
        mediaApprovalNeeded: needsMediaApproval || media.approvalGateIncomplete,
        altMissing: media.altMissing,
        ctaMissing: !ctaPostIds.has(post.id),
      },
    }
  })

  return <BlogDraftQueueClient initialRows={rows} loadError={null} />
}
