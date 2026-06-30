'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { BlogBlockType, BlogContentCategory, BlogMediaUsageStatus, Database, Json } from '@/types/database'

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
    lastFactCheckedAt: string | null
  }
  blocks: SaveableBlock[]
}

export type SaveBlogEditorResult = {
  ok: boolean
  message: string
  savedAt?: string
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
  ok: boolean
  message: string
  publishedAt?: string
  slug?: string
  issues?: string[]
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
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

type BlogPost = Database['showroom']['Tables']['blog_posts']['Row']
type BlogBlock = Database['showroom']['Tables']['blog_blocks']['Row']
type BlogMedia = Database['showroom']['Tables']['blog_media']['Row']
type ContentAsset = Database['showroom']['Tables']['content_assets']['Row']
type ContentAssetFile = Database['showroom']['Tables']['content_asset_files']['Row']

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
  if (!title) return '제목을 입력해야 합니다.'
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return '주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'
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
    .select('id, post_id, usage_status')
    .eq('id', mediaId)
    .single()

  const media = mediaData as Pick<Database['showroom']['Tables']['blog_media']['Row'], 'id' | 'post_id' | 'usage_status'> | null

  if (mediaError || !media) {
    return { ok: false as const, message: '수정할 사진을 찾지 못했습니다.' }
  }

  if (media.post_id !== postId) {
    return { ok: false as const, message: '다른 글의 사진은 수정할 수 없습니다.' }
  }

  return { ok: true as const, media }
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
  previewUrl: string | null,
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
    previewUrl,
    approvedAt: media.approved_at,
    createdAt: media.created_at,
  }
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
  try {
    const actorId = await requireAdministrator()

    const validationError = validatePayload(payload)
    if (validationError) {
      return { ok: false, message: validationError }
    }

    const showroomAdmin = createShowroomAdminClient()
    const { data: currentPostData, error: currentPostError } = await showroomAdmin
      .from('blog_posts')
      .select('id, status, slug')
      .eq('id', payload.postId)
      .single()

    const currentPost = currentPostData as Pick<Database['showroom']['Tables']['blog_posts']['Row'], 'id' | 'status' | 'slug'> | null

    if (currentPostError || !currentPost) {
      return { ok: false, message: '저장할 글을 찾지 못했습니다.' }
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
      last_fact_checked_at: cleanText(payload.post.lastFactCheckedAt),
      updated_at: new Date().toISOString(),
    }

    const { data: updatedPostData, error: postError } = await showroomAdmin
      .from('blog_posts')
      .update(postUpdate as never)
      .eq('id', payload.postId)
      .eq('status', currentPost.status)
      .select('id')

    if (postError) {
      return { ok: false, message: '글 기본 정보를 저장하지 못했습니다.' }
    }

    const updatedPostRows = (updatedPostData ?? []) as Array<{ id: string }>
    if (updatedPostRows.length !== 1) {
      return { ok: false, message: '글 상태가 바뀌었습니다. 새로고침 후 다시 저장해주세요.' }
    }

    const { data: existingBlocksData, error: existingBlocksError } = await showroomAdmin
      .from('blog_blocks')
      .select('id, display_order')
      .eq('post_id', payload.postId)

    if (existingBlocksError) {
      return { ok: false, message: '기존 본문을 확인하지 못했습니다.' }
    }

    const existingBlocks = (existingBlocksData ?? []) as Array<{ id: string; display_order: number }>
    const existingBlockIds = new Set(existingBlocks.map(block => block.id))
    const incomingExistingIds = new Set(payload.blocks.map(block => block.id).filter(Boolean) as string[])
    const removedIds = [...existingBlockIds].filter(id => !incomingExistingIds.has(id))

    if (existingBlocks.length > 0) {
      await Promise.all(existingBlocks.map(block => showroomAdmin
        .from('blog_blocks')
        .update({ display_order: block.display_order + 10000 } as never)
        .eq('id', block.id)
      ))
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

    const savedAt = new Date().toISOString()
    revalidateBlogEditorPaths(payload.postId, [currentPost.slug, payload.post.slug], currentPost.status === 'published')

    return { ok: true, message: '저장했습니다.', savedAt }
  } catch {
    return {
      ok: false,
      message: '저장 중 오류가 발생했습니다.',
    }
  }
}

function extensionForFile(file: File) {
  const nameExtension = file.name.split('.').pop()?.toLowerCase()
  if (nameExtension && /^[a-z0-9]+$/.test(nameExtension)) return nameExtension

  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
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
      return { ok: false, message: 'jpeg, png, webp, heic 이미지만 업로드할 수 있습니다.' }
    }

    const showroomAdmin = createShowroomAdminClient()
    const editablePost = await requireEditablePost(showroomAdmin, postId)
    if (!editablePost.ok) return { ok: false, message: editablePost.message }

    const objectPath = `${postId}/${Date.now()}-${randomUUID()}.${extensionForFile(file)}`
    const { error: uploadError } = await showroomAdmin.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .upload(objectPath, file, {
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
    const webFile = files.find(file => file.file_role === 'web' && file.transform_status === 'ready')
    const thumbnailFile = files.find(file => file.file_role === 'thumbnail' && file.transform_status === 'ready')
    const previewUrl = thumbnailFile?.public_url ?? webFile?.public_url ?? null
    const attachAsPublished = editablePost.post.status === 'published'

    if (!originalFile) {
      return { ok: false, message: '선택한 사진의 원본을 확인하지 못했습니다.' }
    }

    if (attachAsPublished && (!webFile?.bucket || !webFile.object_path || !webFile.public_url)) {
      return { ok: false, message: '공개 글에 넣을 웹용 사진을 확인하지 못했습니다.' }
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
        usage_status: attachAsPublished ? 'published' as const : existingMedia.usage_status,
        privacy_checked: true,
        promotion_consent_checked: true,
      }

      if (attachAsPublished && existingMedia.usage_status !== 'published') {
        const now = new Date().toISOString()
        const { error: publishExistingError } = await showroomAdmin
          .from('blog_media')
          .update({
            usage_status: 'published',
            privacy_checked: true,
            promotion_consent_checked: true,
            public_bucket: webFile?.bucket,
            public_object_path: webFile?.object_path,
            public_url: webFile?.public_url,
            published_at: now,
            updated_at: now,
          } as never)
          .eq('id', existingMedia.id)

        if (publishExistingError) {
          return { ok: false, message: '선택한 사진을 공개 글에 연결하지 못했습니다.' }
        }
      } else if (!existingMedia.privacy_checked || !existingMedia.promotion_consent_checked) {
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
        media: toAttachedMedia(normalizedMedia, previewUrl),
      }
    }

    const altText = cleanText(asset.title) ?? cleanText(asset.description) ?? '문장군 현장 사진'
    const caption = cleanText(asset.description)
    const sourceLabel = cleanText(asset.title) ?? cleanText(asset.category) ?? '사진보관함 사진'

    const now = new Date().toISOString()
    const initialUsageStatus: BlogMediaUsageStatus = attachAsPublished ? 'published' : 'approved'

    const insertPayload: Database['showroom']['Tables']['blog_media']['Insert'] = {
      post_id: postId,
      content_asset_id: asset.id,
      source_type: 'showroom_asset',
      private_bucket: originalFile.bucket,
      private_object_path: originalFile.object_path,
      source_label: sourceLabel,
      alt_text: altText,
      caption,
      usage_status: initialUsageStatus,
      privacy_checked: true,
      promotion_consent_checked: true,
      used_as_cover: false,
      approved_by: actorId,
      approved_at: now,
      public_bucket: attachAsPublished ? webFile?.bucket : null,
      public_object_path: attachAsPublished ? webFile?.object_path : null,
      public_url: attachAsPublished ? webFile?.public_url : null,
      published_at: attachAsPublished ? now : null,
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

    revalidateBlogEditorPaths(postId, [editablePost.post.slug], attachAsPublished)

    return {
      ok: true,
      message: '사진을 본문에 넣었습니다.',
      media: toAttachedMedia(media, previewUrl),
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

    revalidateBlogEditorPaths(payload.postId, [editablePost.post.slug], editablePost.post.status === 'published')
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

  if (post.status !== 'ready') issues.push('발행 준비 상태인 글만 공개할 수 있습니다.')
  if (!cleanText(post.title)) issues.push('제목이 필요합니다.')
  if (!cleanText(post.slug) || !SLUG_PATTERN.test(post.slug)) issues.push('글 주소 형식이 올바르지 않습니다.')
  const metaDescription = cleanText(post.meta_description)
  if (!metaDescription) issues.push('검색 설명이 필요합니다.')
  if (metaDescription && (metaDescription.length < 50 || metaDescription.length > 180)) {
    issues.push('검색 설명은 50-180자로 작성해야 합니다.')
  }
  if (!cleanText(post.target_question)) issues.push('대표 질문이 필요합니다.')
  if (!cleanText(post.summary_answer)) issues.push('요약 답변이 필요합니다.')
  if (!post.last_fact_checked_at) issues.push('사실 확인 날짜가 필요합니다.')
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

  const usedImageMediaIds = new Set(imageBlocks.map(block => block.media_id).filter(Boolean) as string[])
  const mediaToPublish = media.filter(item => usedImageMediaIds.has(item.id) || item.used_as_cover)

  return {
    issues: [...new Set(issues)],
    mediaToPublish,
  }
}

function publicObjectPathForMedia(postId: string, mediaId: string) {
  return `${postId}/${mediaId}.webp`
}

async function convertToPublicWebp(source: Blob) {
  const { default: sharp } = await import('sharp')
  const input = Buffer.from(await source.arrayBuffer())
  return sharp(input)
    .rotate()
    .webp({ quality: 84, effort: 4 })
    .toBuffer()
}

async function cleanupPublicObjects(paths: string[]) {
  if (paths.length === 0) return
  const showroomAdmin = createShowroomAdminClient()
  await showroomAdmin.storage.from(PUBLIC_MEDIA_BUCKET).remove(paths)
}

async function rollbackPublishedMedia(mediaIds: string[]) {
  if (mediaIds.length === 0) return
  const showroomAdmin = createShowroomAdminClient()
  await showroomAdmin
    .from('blog_media')
    .update({
      usage_status: 'approved',
      public_bucket: null,
      public_object_path: null,
      public_url: null,
      published_at: null,
      updated_at: new Date().toISOString(),
    } as never)
    .in('id', mediaIds)
}

async function promoteMediaForPublish(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  postId: string,
  mediaRows: BlogMedia[],
  publishedAt: string,
) {
  const uploadedPaths: string[] = []
  const publishedMediaIds: string[] = []

  try {
    for (const media of mediaRows) {
      if (!media.private_bucket || !media.private_object_path) {
        throw new Error('사진 원본을 확인할 수 없습니다.')
      }

      const { data: privateObject, error: downloadError } = await showroomAdmin.storage
        .from(media.private_bucket)
        .download(media.private_object_path)

      if (downloadError || !privateObject) {
        throw new Error('사진 원본을 불러오지 못했습니다.')
      }

      const publicObjectPath = publicObjectPathForMedia(postId, media.id)
      const publicWebp = await convertToPublicWebp(privateObject)
      const { error: uploadError } = await showroomAdmin.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(publicObjectPath, publicWebp, {
          cacheControl: '31536000',
          contentType: 'image/webp',
          upsert: false,
        })

      if (uploadError) {
        throw new Error('공개용 사진을 준비하지 못했습니다.')
      }

      uploadedPaths.push(publicObjectPath)

      const { data: publicUrlData } = showroomAdmin.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .getPublicUrl(publicObjectPath)

      const { data: updatedMediaData, error: updateError } = await showroomAdmin
        .from('blog_media')
        .update({
          usage_status: 'published',
          public_bucket: PUBLIC_MEDIA_BUCKET,
          public_object_path: publicObjectPath,
          public_url: publicUrlData.publicUrl,
          published_at: publishedAt,
          updated_at: publishedAt,
        } as never)
        .eq('id', media.id)
        .eq('post_id', postId)
        .eq('usage_status', 'approved')
        .select('id')

      if (updateError) {
        throw new Error('공개용 사진 정보를 저장하지 못했습니다.')
      }

      const updatedRows = (updatedMediaData ?? []) as Array<{ id: string }>
      if (updatedRows.length !== 1) {
        throw new Error('확인된 사진만 발행용으로 준비할 수 있습니다.')
      }

      publishedMediaIds.push(media.id)
    }

    return {
      uploadedPaths,
      publishedMediaIds,
    }
  } catch (error) {
    await rollbackPublishedMedia(publishedMediaIds)
    await cleanupPublicObjects(uploadedPaths)
    throw error
  }
}

export async function publishBlogPost(postId: string): Promise<PublishBlogPostResult> {
  let uploadedPaths: string[] = []
  let publishedMediaIds: string[] = []

  try {
    const actorId = await requireAdministrator()

    if (!postId) {
      return { ok: false, message: '글 ID가 없습니다.' }
    }

    const showroomAdmin = createShowroomAdminClient()
    const [postResult, blocksResult, mediaResult] = await Promise.all([
      showroomAdmin
        .from('blog_posts')
        .select('id, title, slug, excerpt, seo_title, meta_description, canonical_url, status, category, primary_keyword, target_question, summary_answer, related_questions, service_area, product_type, source_evidence, brand_check_result, ai_citation_ready, last_fact_checked_at, media_missing_reason, created_by, reviewed_by, published_by, published_at, created_at, updated_at')
        .eq('id', postId)
        .single(),
      showroomAdmin
        .from('blog_blocks')
        .select('id, post_id, display_order, type, heading_level, text, media_id, metadata, created_at, updated_at')
        .eq('post_id', postId)
        .order('display_order', { ascending: true }),
      showroomAdmin
        .from('blog_media')
        .select('id, post_id, source_type, source_measurement_media_id, source_as_media_id, private_bucket, private_object_path, public_bucket, public_object_path, public_url, alt_text, caption, source_label, usage_status, privacy_checked, promotion_consent_checked, used_as_cover, approved_by, approved_at, published_at, rejection_reason, created_at, updated_at')
        .eq('post_id', postId),
    ])

    const post = postResult.data as BlogPost | null
    const blocks = (blocksResult.data ?? []) as BlogBlock[]
    const media = (mediaResult.data ?? []) as BlogMedia[]

    if (postResult.error || !post) {
      return { ok: false, message: '발행할 글을 찾지 못했습니다.' }
    }

    if (blocksResult.error) {
      return { ok: false, message: '본문 정보를 불러오지 못했습니다.' }
    }

    if (mediaResult.error) {
      return { ok: false, message: '사진 정보를 불러오지 못했습니다.' }
    }

    const gate = validatePublishGate(post, blocks, media)
    if (gate.issues.length > 0) {
      return {
        ok: false,
        message: '발행 전 검수 게이트를 통과하지 못했습니다.',
        issues: gate.issues,
      }
    }

    const publishedAt = new Date().toISOString()
    const promotion = await promoteMediaForPublish(showroomAdmin, post.id, gate.mediaToPublish, publishedAt)
    uploadedPaths = promotion.uploadedPaths
    publishedMediaIds = promotion.publishedMediaIds

    const { data: updatedPostData, error: postUpdateError } = await showroomAdmin
      .from('blog_posts')
      .update({
        status: 'published',
        published_by: actorId,
        published_at: publishedAt,
        updated_at: publishedAt,
      } as never)
      .eq('id', post.id)
      .eq('status', 'ready')
      .select('id, slug')

    if (postUpdateError) {
      throw new Error('글을 공개 상태로 바꾸지 못했습니다.')
    }

    const updatedPostRows = (updatedPostData ?? []) as Array<{ id: string; slug: string }>
    if (updatedPostRows.length !== 1) {
      throw new Error('발행 준비가 끝난 글만 공개할 수 있습니다.')
    }

    const { error: eventError } = await showroomAdmin
      .from('blog_post_events')
      .insert({
        post_id: post.id,
        actor_id: actorId,
        event_type: 'published',
        from_status: post.status,
        to_status: 'published',
        memo: '발행 검수를 통과해 공개용 사진 준비까지 완료했습니다.',
        metadata: {
          published_media_ids: publishedMediaIds,
          public_bucket: PUBLIC_MEDIA_BUCKET,
        },
      } as never)

    if (eventError) {
      await showroomAdmin
        .from('blog_posts')
        .update({
          status: 'ready',
          published_by: null,
          published_at: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', post.id)
        .eq('status', 'published')

      throw new Error('발행 기록을 남기지 못했습니다.')
    }

    revalidatePath('/blog')
    revalidatePath(`/blog/${post.slug}`)
    revalidatePath('/sitemap.xml')
    revalidatePath(`/admin/platform/blog/${post.id}`)
    revalidatePath(`/admin/platform/blog/${post.id}/preview`)

    return {
      ok: true,
      message: '발행이 완료되었습니다.',
      publishedAt,
      slug: post.slug,
    }
  } catch (error) {
    await rollbackPublishedMedia(publishedMediaIds)
    await cleanupPublicObjects(uploadedPaths)

    return {
      ok: false,
      message: error instanceof Error ? error.message : '발행 중 오류가 발생했습니다.',
    }
  }
}
