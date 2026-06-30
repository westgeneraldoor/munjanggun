import 'server-only'
import { cache } from 'react'
import { createPublicShowroomClient, hasPublicShowroomEnv } from '@/lib/supabase/public'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { BlogBlockType, BlogContentCategory, BlogMediaUsageStatus, BlogPostStatus, Database, Json } from '@/types/database'

type BlogPostRow = Database['showroom']['Tables']['blog_posts']['Row']
type BlogPostRenderProjection = Pick<
  BlogPostRow,
  | 'id'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'seo_title'
  | 'meta_description'
  | 'canonical_url'
  | 'status'
  | 'category'
  | 'primary_keyword'
  | 'target_question'
  | 'summary_answer'
  | 'service_area'
  | 'product_type'
  | 'published_at'
  | 'updated_at'
> & {
  related_questions?: Json
}
type BlogBlockRow = Database['showroom']['Tables']['blog_blocks']['Row']
type BlogMediaRow = Database['showroom']['Tables']['blog_media']['Row']

export type BlogRenderMode = 'public' | 'preview'

export type BlogRenderPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  seoTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  category: BlogContentCategory
  status: BlogPostStatus
  primaryKeyword: string | null
  targetQuestion: string | null
  summaryAnswer: string | null
  relatedQuestions: string[]
  serviceArea: string | null
  productType: string | null
  publishedAt: string | null
  updatedAt: string
}

export type BlogRenderBlock = {
  id: string
  type: BlogBlockType
  headingLevel: number | null
  text: string | null
  mediaId: string | null
  metadata: Record<string, string>
  displayOrder: number
}

export type BlogRenderMedia = {
  id: string
  usageStatus: BlogMediaUsageStatus
  url: string | null
  altText: string | null
  caption: string | null
  sourceLabel: string | null
  usedAsCover: boolean
}

export type BlogRelatedPost = Pick<
  BlogRenderPost,
  | 'id'
  | 'title'
  | 'slug'
  | 'category'
  | 'primaryKeyword'
  | 'targetQuestion'
  | 'summaryAnswer'
  | 'serviceArea'
  | 'productType'
  | 'publishedAt'
> & {
  coverMedia: BlogRenderMedia | null
  relationLabel: string
}

export type BlogRenderData = {
  post: BlogRenderPost
  blocks: BlogRenderBlock[]
  media: BlogRenderMedia[]
  relatedPosts: BlogRelatedPost[]
  nextPost: BlogRelatedPost | null
}

export type BlogListItem = BlogRenderPost & {
  coverMedia: BlogRenderMedia | null
}

const PUBLIC_POST_SELECT = [
  'id',
  'title',
  'slug',
  'excerpt',
  'seo_title',
  'meta_description',
  'canonical_url',
  'status',
  'category',
  'primary_keyword',
  'target_question',
  'summary_answer',
  'service_area',
  'product_type',
  'published_at',
  'updated_at',
].join(', ')

const PREVIEW_POST_SELECT = [
  PUBLIC_POST_SELECT,
  'related_questions',
].join(', ')

const BLOCK_SELECT = [
  'id',
  'post_id',
  'display_order',
  'type',
  'heading_level',
  'text',
  'media_id',
  'metadata',
].join(', ')

const PUBLIC_MEDIA_SELECT = [
  'id',
  'post_id',
  'usage_status',
  'public_url',
  'alt_text',
  'caption',
  'used_as_cover',
].join(', ')

const PREVIEW_MEDIA_SELECT = [
  'id',
  'post_id',
  'usage_status',
  'private_bucket',
  'private_object_path',
  'public_url',
  'alt_text',
  'caption',
  'source_label',
  'used_as_cover',
].join(', ')

function isJsonArray(value: Json): value is Json[] {
  return Array.isArray(value)
}

function isJsonObject(value: Json): value is Record<string, Json> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function relatedQuestionsToStrings(value: Json) {
  if (!isJsonArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
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

function toRenderPost(post: BlogPostRenderProjection): BlogRenderPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    seoTitle: post.seo_title,
    metaDescription: post.meta_description,
    canonicalUrl: post.canonical_url,
    category: post.category,
    status: post.status,
    primaryKeyword: post.primary_keyword,
    targetQuestion: post.target_question,
    summaryAnswer: post.summary_answer,
    relatedQuestions: relatedQuestionsToStrings(post.related_questions ?? []),
    serviceArea: post.service_area,
    productType: post.product_type,
    publishedAt: post.published_at,
    updatedAt: post.updated_at,
  }
}

function toRenderBlock(block: BlogBlockRow): BlogRenderBlock {
  return {
    id: block.id,
    type: block.type,
    headingLevel: block.heading_level,
    text: block.text,
    mediaId: block.media_id,
    metadata: metadataToStringMap(block.metadata),
    displayOrder: block.display_order,
  }
}

function toPublicRenderMedia(media: BlogMediaRow): BlogRenderMedia {
  return {
    id: media.id,
    usageStatus: media.usage_status,
    url: media.public_url,
    altText: media.alt_text,
    caption: media.caption,
    sourceLabel: null,
    usedAsCover: media.used_as_cover,
  }
}

function normalizeSearchValue(value: string | null | undefined) {
  return value?.toLocaleLowerCase('ko-KR').trim() ?? ''
}

function publishedTime(value: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function extractSearchTokens(values: Array<string | null | undefined>) {
  return Array.from(new Set(
    values
      .flatMap(value => normalizeSearchValue(value).split(/[\s,./?？!！:：;；()[\]{}"'“”‘’·|]+/))
      .map(value => value.trim())
      .filter(value => value.length >= 2),
  ))
}

function relatedPostText(post: BlogListItem) {
  return [
    post.title,
    post.excerpt,
    post.primaryKeyword,
    post.targetQuestion,
    post.summaryAnswer,
    post.serviceArea,
    post.productType,
    ...post.relatedQuestions,
  ].map(normalizeSearchValue).join(' ')
}

function scoreRelatedPost(current: BlogRenderPost, candidate: BlogListItem) {
  let score = 0

  if (current.productType && current.productType === candidate.productType) score += 4
  if (current.serviceArea && current.serviceArea === candidate.serviceArea) score += 3
  if (current.primaryKeyword && current.primaryKeyword === candidate.primaryKeyword) score += 3
  if (current.category === candidate.category) score += 2

  const candidateText = relatedPostText(candidate)
  const tokens = extractSearchTokens([
    current.targetQuestion,
    current.primaryKeyword,
    current.productType,
    current.serviceArea,
    ...current.relatedQuestions,
  ])
  const matchedTokenCount = tokens.filter(token => candidateText.includes(token)).length

  return score + Math.min(matchedTokenCount, 3)
}

function relationLabelFor(current: BlogRenderPost, candidate: BlogListItem, score: number) {
  if (current.productType && current.productType === candidate.productType) return '같은 제품군'
  if (current.serviceArea && current.serviceArea === candidate.serviceArea) return '비슷한 지역'
  if (current.category === candidate.category) return '같은 주제'
  if (score > 0) return '관련 질문'
  return '이어 읽기'
}

function toRelatedPost(current: BlogRenderPost, post: BlogListItem, score = 0): BlogRelatedPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    category: post.category,
    primaryKeyword: post.primaryKeyword,
    targetQuestion: post.targetQuestion,
    summaryAnswer: post.summaryAnswer,
    serviceArea: post.serviceArea,
    productType: post.productType,
    publishedAt: post.publishedAt,
    coverMedia: post.coverMedia,
    relationLabel: relationLabelFor(current, post, score),
  }
}

function selectRelatedPosts(current: BlogRenderPost, posts: BlogListItem[]) {
  const candidates = posts.filter(post => post.id !== current.id)
  const ranked = candidates
    .map(post => ({
      post,
      score: scoreRelatedPost(current, post),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return publishedTime(b.post.publishedAt) - publishedTime(a.post.publishedAt)
    })

  const relatedSlotCount = Math.max(0, Math.min(3, ranked.length - 1))
  const relatedPosts = ranked.slice(0, relatedSlotCount).map(item => toRelatedPost(current, item.post, item.score))
  const relatedIds = new Set(relatedPosts.map(post => post.id))
  const nextCandidate = ranked.find(item => !relatedIds.has(item.post.id)) ?? null

  return {
    relatedPosts,
    nextPost: nextCandidate ? toRelatedPost(current, nextCandidate.post, nextCandidate.score) : null,
  }
}

async function toPreviewRenderMedia(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  media: BlogMediaRow,
): Promise<BlogRenderMedia> {
  let url = media.public_url

  if (!url && media.private_bucket && media.private_object_path) {
    const { data } = await showroomAdmin.storage
      .from(media.private_bucket)
      .createSignedUrl(media.private_object_path, 300)

    url = data?.signedUrl ?? null
  }

  return {
    id: media.id,
    usageStatus: media.usage_status,
    url,
    altText: media.alt_text,
    caption: media.caption,
    sourceLabel: media.source_label,
    usedAsCover: media.used_as_cover,
  }
}

export const getPublishedBlogPosts = cache(async (): Promise<BlogListItem[]> => {
  if (!hasPublicShowroomEnv()) return []

  const showroom = createPublicShowroomClient().schema('showroom')

  const { data: postRows } = await showroom
    .from('blog_posts')
    .select(PUBLIC_POST_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })

  const posts = (postRows ?? []) as unknown as BlogPostRenderProjection[]
  if (posts.length === 0) return []

  const postIds = posts.map(post => post.id)
  const { data: mediaRows } = await showroom
    .from('blog_media')
    .select(PUBLIC_MEDIA_SELECT)
    .eq('usage_status', 'published')
    .eq('used_as_cover', true)
    .in('post_id', postIds)

  const coverByPostId = new Map<string, BlogRenderMedia>()
  for (const media of (mediaRows ?? []) as unknown as BlogMediaRow[]) {
    if (media.post_id && !coverByPostId.has(media.post_id)) {
      coverByPostId.set(media.post_id, toPublicRenderMedia(media))
    }
  }

  return posts.map(post => ({
    ...toRenderPost(post),
    coverMedia: coverByPostId.get(post.id) ?? null,
  }))
})

export const getPublishedBlogPostBySlug = cache(async (slug: string): Promise<BlogRenderData | null> => {
  if (!hasPublicShowroomEnv()) return null

  const showroom = createPublicShowroomClient().schema('showroom')

  const { data: postRow, error } = await showroom
    .from('blog_posts')
    .select(PUBLIC_POST_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !postRow) return null

  const post = postRow as unknown as BlogPostRenderProjection
  const [blocksResult, mediaResult] = await Promise.all([
    showroom
      .from('blog_blocks')
      .select(BLOCK_SELECT)
      .eq('post_id', post.id)
      .order('display_order', { ascending: true }),
    showroom
      .from('blog_media')
      .select(PUBLIC_MEDIA_SELECT)
      .eq('post_id', post.id)
      .eq('usage_status', 'published'),
  ])

  const renderPost = toRenderPost(post)
  const allPublishedPosts = await getPublishedBlogPosts()
  const related = selectRelatedPosts(renderPost, allPublishedPosts)

  return {
    post: renderPost,
    blocks: ((blocksResult.data ?? []) as unknown as BlogBlockRow[]).map(toRenderBlock),
    media: ((mediaResult.data ?? []) as unknown as BlogMediaRow[]).map(toPublicRenderMedia),
    ...related,
  }
})

export async function getAdminPreviewBlogPost(postId: string): Promise<BlogRenderData | null> {
  const showroomAdmin = createShowroomAdminClient()

  const { data: postRow, error } = await showroomAdmin
    .from('blog_posts')
    .select(PREVIEW_POST_SELECT)
    .eq('id', postId)
    .maybeSingle()

  if (error || !postRow) return null

  const post = postRow as unknown as BlogPostRenderProjection
  const [blocksResult, mediaResult] = await Promise.all([
    showroomAdmin
      .from('blog_blocks')
      .select(BLOCK_SELECT)
      .eq('post_id', post.id)
      .order('display_order', { ascending: true }),
    showroomAdmin
      .from('blog_media')
      .select(PREVIEW_MEDIA_SELECT)
      .eq('post_id', post.id)
      .in('usage_status', ['approved', 'published']),
  ])

  const media = await Promise.all(((mediaResult.data ?? []) as unknown as BlogMediaRow[]).map(item => toPreviewRenderMedia(showroomAdmin, item)))

  return {
    post: toRenderPost(post),
    blocks: ((blocksResult.data ?? []) as unknown as BlogBlockRow[]).map(toRenderBlock),
    media,
    relatedPosts: [],
    nextPost: null,
  }
}
