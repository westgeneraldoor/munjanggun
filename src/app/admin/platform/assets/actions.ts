'use server'

import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { mergeContentAssetLabelsWithTags } from '@/lib/content-assets/content-asset-labels.mjs'
import {
  buildContentAssetObjectPath,
  CONTENT_ASSET_PRIVATE_BUCKET,
  CONTENT_ASSET_PUBLIC_BUCKET,
  extensionForContentAssetMimeType,
  transformContentAssetImage,
} from '@/lib/content-assets/image-transforms'
import { readUploadReviewChecks, type UploadReviewChecks } from '@/lib/content-assets/upload-review-checks'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { Database, Json } from '@/types/database'

const MAX_FILES_PER_UPLOAD = 12
const MAX_UPLOAD_TOTAL_BYTES = 120 * 1024 * 1024

type ContentAssetInsert = Database['showroom']['Tables']['content_assets']['Insert']
type ContentAssetFileInsert = Database['showroom']['Tables']['content_asset_files']['Insert']
type ContentAssetTagRow = Database['showroom']['Tables']['content_asset_tags']['Row']
type UploadFileMeta = {
  name: string
  size: number
  lastModified: number
  title?: string
  description?: string
}

export type UploadAssetItemResult = {
  fileName: string
  ok: boolean
  message: string
  assetId?: string
  duplicatePossible?: boolean
}

export type UploadContentAssetsResult = {
  ok: boolean
  message: string
  items: UploadAssetItemResult[]
}

export type UpdateContentAssetPayload = {
  assetId: string
  title: string | null
  description: string | null
  category: string | null
  tags: string[]
  productType: string | null
  spaceType: string | null
  region: string | null
  usagePurpose: string | null
  privacyChecked: boolean
  promotionConsentChecked: boolean
}

export type ContentAssetActionResult = {
  ok: boolean
  message: string
}

export type ContentAssetReference = {
  postId: string | null
  postTitle: string
  status: string
  location: 'cover' | 'body' | 'blog_media' | string
}

export type ArchiveContentAssetItemResult = {
  assetId: string
  changed: boolean
  reason: string
  references: ContentAssetReference[]
}

export type ArchiveContentAssetsResult = {
  ok: boolean
  message: string
  results: ArchiveContentAssetItemResult[]
}

function cleanText(value: FormDataEntryValue | string | null | undefined) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}

function fileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || fileName
}

function fileMetaKey(file: Pick<File, 'name' | 'size' | 'lastModified'>) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function parseUploadFileMeta(value: FormDataEntryValue | null): Map<string, UploadFileMeta> {
  if (typeof value !== 'string') return new Map()

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return new Map()

    const rows = parsed.filter((item): item is UploadFileMeta => (
      Boolean(item) &&
      typeof item === 'object' &&
      typeof item.name === 'string' &&
      typeof item.size === 'number' &&
      typeof item.lastModified === 'number'
    ))

    return new Map(rows.map(item => [fileMetaKey(item), item]))
  } catch {
    return new Map()
  }
}

function parseTags(value: FormDataEntryValue | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(item => item.trim()).filter(Boolean))].slice(0, 20)
  }

  if (typeof value !== 'string') return []

  return [...new Set(value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean))]
    .slice(0, 20)
}

function tagSlug(name: string) {
  const ascii = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (ascii) return ascii.slice(0, 80)

  const hash = createHash('sha1').update(name).digest('hex').slice(0, 12)
  return `tag-${hash}`
}

function labelsForTags(tags: string[]): Json {
  return { tags }
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
    throw new Error('관리자만 사용할 수 있습니다.')
  }

  return user.id
}

async function ensureTags(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  tagNames: string[],
) {
  if (tagNames.length === 0) return []

  const rows = tagNames.map(name => ({
    name,
    slug: tagSlug(name),
  }))

  const { error: upsertError } = await showroomAdmin
    .from('content_asset_tags')
    .upsert(rows as never, { onConflict: 'slug' })

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  const slugs = rows.map(row => row.slug)
  const { data, error } = await showroomAdmin
    .from('content_asset_tags')
    .select('id, name, slug, tag_group, created_at')
    .in('slug', slugs)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ContentAssetTagRow[]
}

async function replaceAssetTags(
  showroomAdmin: ReturnType<typeof createShowroomAdminClient>,
  assetId: string,
  tagNames: string[],
) {
  const tags = await ensureTags(showroomAdmin, tagNames)

  const { error: deleteError } = await showroomAdmin
    .from('content_asset_tag_links')
    .delete()
    .eq('asset_id', assetId)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  if (tags.length === 0) return

  const { error: insertError } = await showroomAdmin
    .from('content_asset_tag_links')
    .insert(tags.map(tag => ({
      asset_id: assetId,
      tag_id: tag.id,
    })) as never)

  if (insertError) {
    throw new Error(insertError.message)
  }
}

async function uploadOneAsset(params: {
  actorId: string
  file: File
  formData: FormData
  reviewChecks: UploadReviewChecks
  fileMeta?: UploadFileMeta
}): Promise<UploadAssetItemResult> {
  const { actorId, file, formData, reviewChecks, fileMeta } = params
  const showroomAdmin = createShowroomAdminClient()
  let assetId: string | null = null
  const uploaded: Array<{ bucket: string; path: string }> = []
  const tagNames = parseTags(formData.get('tags'))

  try {
    const transformed = await transformContentAssetImage(file, file.type)

    const { data: duplicateRows } = await showroomAdmin
      .from('content_asset_files')
      .select('asset_id')
      .eq('file_role', 'original')
      .eq('checksum_sha256', transformed.original.checksumSha256)
      .limit(3)

    const duplicatePossible = Boolean(duplicateRows && duplicateRows.length > 0)

    const now = new Date().toISOString()
    const insertAsset: ContentAssetInsert = {
      title: cleanText(fileMeta?.title) ?? cleanText(formData.get('title')) ?? fileTitle(file.name),
      description: cleanText(fileMeta?.description) ?? cleanText(formData.get('description')),
      category: cleanText(formData.get('category')),
      labels: labelsForTags(tagNames),
      product_type: cleanText(formData.get('productType')),
      space_type: cleanText(formData.get('spaceType')),
      region: cleanText(formData.get('region')),
      usage_purpose: cleanText(formData.get('usagePurpose')),
      privacy_checked: reviewChecks.privacyChecked,
      promotion_consent_checked: reviewChecks.promotionConsentChecked,
      created_by: actorId,
      updated_by: actorId,
      created_at: now,
      updated_at: now,
    }

    const { data: assetData, error: assetError } = await showroomAdmin
      .from('content_assets')
      .insert(insertAsset as never)
      .select('id')
      .single()

    if (assetError || !assetData) {
      throw new Error(assetError?.message ?? '사진 정보를 저장하지 못했습니다.')
    }

    assetId = (assetData as { id: string }).id

    const originalPath = buildContentAssetObjectPath({
      assetId,
      role: 'original',
      extension: extensionForContentAssetMimeType(file.type),
    })
    const webPath = buildContentAssetObjectPath({ assetId, role: 'web', extension: 'webp' })
    const thumbnailPath = buildContentAssetObjectPath({ assetId, role: 'thumbnail', extension: 'webp' })

    const uploadOriginal = await showroomAdmin.storage
      .from(CONTENT_ASSET_PRIVATE_BUCKET)
      .upload(originalPath, transformed.original.buffer, {
        cacheControl: '3600',
        contentType: transformed.original.mimeType,
        upsert: false,
      })

    if (uploadOriginal.error) throw new Error(uploadOriginal.error.message)
    uploaded.push({ bucket: CONTENT_ASSET_PRIVATE_BUCKET, path: originalPath })

    const uploadWeb = await showroomAdmin.storage
      .from(CONTENT_ASSET_PUBLIC_BUCKET)
      .upload(webPath, transformed.web.buffer, {
        cacheControl: '31536000',
        contentType: transformed.web.mimeType,
        upsert: false,
      })

    if (uploadWeb.error) throw new Error(uploadWeb.error.message)
    uploaded.push({ bucket: CONTENT_ASSET_PUBLIC_BUCKET, path: webPath })

    const uploadThumbnail = await showroomAdmin.storage
      .from(CONTENT_ASSET_PUBLIC_BUCKET)
      .upload(thumbnailPath, transformed.thumbnail.buffer, {
        cacheControl: '31536000',
        contentType: transformed.thumbnail.mimeType,
        upsert: false,
      })

    if (uploadThumbnail.error) throw new Error(uploadThumbnail.error.message)
    uploaded.push({ bucket: CONTENT_ASSET_PUBLIC_BUCKET, path: thumbnailPath })

    const webUrl = showroomAdmin.storage.from(CONTENT_ASSET_PUBLIC_BUCKET).getPublicUrl(webPath).data.publicUrl
    const thumbnailUrl = showroomAdmin.storage.from(CONTENT_ASSET_PUBLIC_BUCKET).getPublicUrl(thumbnailPath).data.publicUrl

    const fileRows: ContentAssetFileInsert[] = [
      {
        asset_id: assetId,
        file_role: 'original',
        bucket: CONTENT_ASSET_PRIVATE_BUCKET,
        object_path: originalPath,
        public_url: null,
        mime_type: transformed.original.mimeType,
        size_bytes: transformed.original.sizeBytes,
        width: transformed.original.width,
        height: transformed.original.height,
        checksum_sha256: transformed.original.checksumSha256,
        transform_status: 'ready',
      },
      {
        asset_id: assetId,
        file_role: 'web',
        bucket: CONTENT_ASSET_PUBLIC_BUCKET,
        object_path: webPath,
        public_url: webUrl,
        mime_type: transformed.web.mimeType,
        size_bytes: transformed.web.sizeBytes,
        width: transformed.web.width,
        height: transformed.web.height,
        checksum_sha256: transformed.web.checksumSha256,
        transform_status: 'ready',
      },
      {
        asset_id: assetId,
        file_role: 'thumbnail',
        bucket: CONTENT_ASSET_PUBLIC_BUCKET,
        object_path: thumbnailPath,
        public_url: thumbnailUrl,
        mime_type: transformed.thumbnail.mimeType,
        size_bytes: transformed.thumbnail.sizeBytes,
        width: transformed.thumbnail.width,
        height: transformed.thumbnail.height,
        checksum_sha256: transformed.thumbnail.checksumSha256,
        transform_status: 'ready',
      },
    ]

    const { error: filesError } = await showroomAdmin
      .from('content_asset_files')
      .insert(fileRows as never)

    if (filesError) throw new Error(filesError.message)

    await replaceAssetTags(showroomAdmin, assetId, tagNames)

    await showroomAdmin
      .from('content_asset_events')
      .insert({
        asset_id: assetId,
        event_type: 'uploaded',
        actor_id: actorId,
        metadata: {
          file_name: file.name,
          duplicate_possible: duplicatePossible,
        },
      } as never)

    return {
      fileName: file.name,
      ok: true,
      assetId,
      duplicatePossible,
      message: duplicatePossible
        ? '업로드했습니다. 같은 사진일 가능성이 있는 항목이 있습니다.'
        : '업로드했습니다.',
    }
  } catch (error) {
    await Promise.all(uploaded.map(item => showroomAdmin.storage.from(item.bucket).remove([item.path])))

    if (assetId) {
      await showroomAdmin.from('content_assets').delete().eq('id', assetId)
    }

    return {
      fileName: file.name,
      ok: false,
      message: error instanceof Error ? error.message : '사진을 처리하지 못했습니다.',
    }
  }
}

export async function uploadContentAssets(formData: FormData): Promise<UploadContentAssetsResult> {
  try {
    const actorId = await requireAdministrator()
    const files = formData.getAll('files').filter((item): item is File => item instanceof File && item.size > 0)

    if (files.length === 0) {
      return { ok: false, message: '업로드할 사진을 선택해주세요.', items: [] }
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return {
        ok: false,
        message: `한 번에 ${MAX_FILES_PER_UPLOAD}장까지만 업로드할 수 있습니다.`,
        items: [],
      }
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    if (totalBytes > MAX_UPLOAD_TOTAL_BYTES) {
      return {
        ok: false,
        message: '한 번에 올릴 수 있는 사진 용량은 합계 120MB까지입니다.',
        items: [],
      }
    }

    const reviewChecks = readUploadReviewChecks(formData)
    if (!reviewChecks) {
      return {
        ok: false,
        message: '사진의 민감정보 확인과 블로그 사용 가능 여부 확인이 모두 필요합니다.',
        items: [],
      }
    }

    const items: UploadAssetItemResult[] = []
    const fileMetaByKey = parseUploadFileMeta(formData.get('fileMeta'))
    for (const file of files) {
      items.push(await uploadOneAsset({
        actorId,
        file,
        formData,
        reviewChecks,
        fileMeta: fileMetaByKey.get(fileMetaKey(file)),
      }))
    }

    revalidatePath('/admin/platform/assets')

    const successCount = items.filter(item => item.ok).length
    return {
      ok: successCount > 0,
      message: `${successCount}/${items.length}장 업로드 완료`,
      items,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '사진 업로드 중 오류가 발생했습니다.',
      items: [],
    }
  }
}

export async function updateContentAsset(payload: UpdateContentAssetPayload): Promise<ContentAssetActionResult> {
  try {
    const actorId = await requireAdministrator()
    const showroomAdmin = createShowroomAdminClient()
    const tagNames = parseTags(payload.tags)
    const now = new Date().toISOString()

    if (!payload.assetId) {
      return { ok: false, message: '사진을 찾을 수 없습니다.' }
    }

    const { data: currentAssetData, error: currentAssetError } = await showroomAdmin
      .from('content_assets')
      .select('id, labels')
      .eq('id', payload.assetId)
      .single()
    const currentAsset = currentAssetData as Pick<Database['showroom']['Tables']['content_assets']['Row'], 'id' | 'labels'> | null
    if (currentAssetError || !currentAsset) {
      return { ok: false, message: currentAssetError?.message ?? 'Content asset was not found.' }
    }

    const updatePayload: Database['showroom']['Tables']['content_assets']['Update'] = {
      title: cleanText(payload.title),
      description: cleanText(payload.description),
      category: cleanText(payload.category),
      labels: mergeContentAssetLabelsWithTags(currentAsset.labels, tagNames),
      product_type: cleanText(payload.productType),
      space_type: cleanText(payload.spaceType),
      region: cleanText(payload.region),
      usage_purpose: cleanText(payload.usagePurpose),
      privacy_checked: payload.privacyChecked,
      promotion_consent_checked: payload.promotionConsentChecked,
      updated_by: actorId,
      updated_at: now,
    }

    const { data, error } = await showroomAdmin
      .from('content_assets')
      .update(updatePayload as never)
      .eq('id', payload.assetId)
      .select('id')

    if (error) return { ok: false, message: error.message }
    if (!data || data.length !== 1) return { ok: false, message: '사진 정보를 저장하지 못했습니다.' }

    await replaceAssetTags(showroomAdmin, payload.assetId, tagNames)

    await showroomAdmin
      .from('content_asset_events')
      .insert({
        asset_id: payload.assetId,
        event_type: 'metadata_updated',
        actor_id: actorId,
        metadata: { tags: tagNames },
      } as never)

    revalidatePath('/admin/platform/assets')
    return { ok: true, message: '저장했습니다.' }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.',
    }
  }
}

function isArchiveResult(value: unknown): value is ArchiveContentAssetItemResult {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.assetId === 'string'
    && typeof item.changed === 'boolean'
    && typeof item.reason === 'string'
    && Array.isArray(item.references)
}

/**
 * The generated database types intentionally lag unapplied migrations. Keep the
 * service-role RPC boundary explicit here instead of exposing any storage operation
 * or falling back to client-side `used_count` checks.
 */
async function invokeArchiveRpc(assetIds: string[], actorId: string, restore: boolean) {
  const showroom = createShowroomAdminClient() as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }
  return showroom.rpc('archive_content_assets_safely', {
    p_asset_ids: assetIds,
    p_actor_id: actorId,
    p_restore: restore,
  })
}

export async function archiveContentAssets(assetIds: string[]): Promise<ArchiveContentAssetsResult> {
  try {
    const actorId = await requireAdministrator()
    const ids = [...new Set(assetIds.filter(value => /^[0-9a-f]{8}-[0-9a-f-]{35}$/i.test(value)))].slice(0, 300)
    if (ids.length === 0) return { ok: false, message: '보관할 사진을 선택해 주세요.', results: [] }

    const { data, error } = await invokeArchiveRpc(ids, actorId, false)
    if (error) return { ok: false, message: '사진 보관 여부를 확인하지 못했습니다.', results: [] }
    const rawResults = (data as { results?: unknown } | null)?.results
    const results = Array.isArray(rawResults) ? rawResults.filter(isArchiveResult) : []
    if (results.length !== ids.length) return { ok: false, message: '사진 보관 결과를 안전하게 확인하지 못했습니다.', results: [] }

    revalidatePath('/admin/platform/assets')
    const archived = results.filter(item => item.changed).length
    const blocked = results.filter(item => item.reason === 'in_use').length
    return {
      ok: true,
      message: blocked > 0
        ? `${archived}장을 보관했습니다. ${blocked}장은 사용 중이라 보관하지 않았습니다.`
        : `${archived}장을 보관했습니다. 사진 파일은 삭제하지 않았습니다.`,
      results,
    }
  } catch {
    return { ok: false, message: '사진 보관 중 오류가 발생했습니다. 다시 시도해 주세요.', results: [] }
  }
}

export async function restoreContentAssets(assetIds: string[]): Promise<ArchiveContentAssetsResult> {
  try {
    const actorId = await requireAdministrator()
    const ids = [...new Set(assetIds.filter(value => /^[0-9a-f]{8}-[0-9a-f-]{35}$/i.test(value)))].slice(0, 300)
    if (ids.length === 0) return { ok: false, message: '복원할 사진을 선택해 주세요.', results: [] }

    const { data, error } = await invokeArchiveRpc(ids, actorId, true)
    if (error) return { ok: false, message: '사진을 복원하지 못했습니다.', results: [] }
    const rawResults = (data as { results?: unknown } | null)?.results
    const results = Array.isArray(rawResults) ? rawResults.filter(isArchiveResult) : []
    if (results.length !== ids.length) return { ok: false, message: '사진 복원 결과를 안전하게 확인하지 못했습니다.', results: [] }

    revalidatePath('/admin/platform/assets')
    return { ok: true, message: `${results.filter(item => item.changed).length}장을 복원했습니다.`, results }
  } catch {
    return { ok: false, message: '사진 복원 중 오류가 발생했습니다. 다시 시도해 주세요.', results: [] }
  }
}
