import type { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { Database } from '@/types/database'
import type { ContentAssetLibraryItem, ContentAssetTagOption } from './ContentAssetsClient'

export const ASSET_LIBRARY_SERVER_PAGE_SIZE = 96

type ShowroomAdmin = ReturnType<typeof createShowroomAdminClient>
type AssetRow = Database['showroom']['Tables']['content_assets']['Row']
type AssetFileRow = Pick<
  Database['showroom']['Tables']['content_asset_files']['Row'],
  'asset_id' | 'file_role' | 'width' | 'height' | 'size_bytes' | 'transform_status'
>
type TagRow = Database['showroom']['Tables']['content_asset_tags']['Row']
type TagLinkRow = Database['showroom']['Tables']['content_asset_tag_links']['Row']

function fileSummary(assetId: string, files: AssetFileRow[], role: 'web' | 'thumbnail') {
  const file = files.find(item => item.file_role === role)
  if (!file) return null

  return {
    url: `/admin/platform/assets/${assetId}/preview?variant=${role}`,
    width: file.width,
    height: file.height,
    sizeBytes: file.size_bytes,
    ready: file.transform_status === 'ready',
  }
}

export async function loadAssetLibraryServerPage(
  showroomAdmin: ShowroomAdmin,
  offset: number,
  includeTagOptions = false,
) {
  const safeOffset = Math.max(0, Math.min(Math.trunc(offset), 100_000))
  const assetResult = await showroomAdmin
    .from('content_assets')
    .select('id, title, description, category, labels, product_type, space_type, region, usage_purpose, library_state, privacy_checked, promotion_consent_checked, used_count, created_by, updated_by, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + ASSET_LIBRARY_SERVER_PAGE_SIZE)

  const fetchedAssets = (assetResult.data ?? []) as AssetRow[]
  const hasMore = fetchedAssets.length > ASSET_LIBRARY_SERVER_PAGE_SIZE
  const assets = fetchedAssets.slice(0, ASSET_LIBRARY_SERVER_PAGE_SIZE)
  const assetIds = assets.map(asset => asset.id)

  const [fileResult, tagResult, tagLinkResult] = await Promise.all([
    assetIds.length > 0
      ? showroomAdmin
        .from('content_asset_files')
        .select('asset_id, file_role, width, height, size_bytes, transform_status')
        .in('asset_id', assetIds)
        .in('file_role', ['web', 'thumbnail'])
      : Promise.resolve({ data: [], error: null }),
    showroomAdmin
      .from('content_asset_tags')
      .select('id, name, slug, tag_group, created_at')
      .order('name', { ascending: true }),
    assetIds.length > 0
      ? showroomAdmin
        .from('content_asset_tag_links')
        .select('asset_id, tag_id, created_at')
        .in('asset_id', assetIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const files = (fileResult.data ?? []) as AssetFileRow[]
  const tags = (tagResult.data ?? []) as TagRow[]
  const tagLinks = (tagLinkResult.data ?? []) as TagLinkRow[]
  const filesByAsset = files.reduce<Record<string, AssetFileRow[]>>((acc, file) => {
    acc[file.asset_id] = [...(acc[file.asset_id] ?? []), file]
    return acc
  }, {})
  const tagsById = new Map(tags.map(tag => [tag.id, tag]))
  const tagsByAsset = tagLinks.reduce<Record<string, string[]>>((acc, link) => {
    const tag = tagsById.get(link.tag_id)
    if (!tag) return acc
    acc[link.asset_id] = [...(acc[link.asset_id] ?? []), tag.name]
    return acc
  }, {})

  const items: ContentAssetLibraryItem[] = assets.map(asset => {
    const assetFiles = filesByAsset[asset.id] ?? []
    return {
      id: asset.id,
      libraryState: asset.library_state,
      title: asset.title,
      description: asset.description,
      category: asset.category,
      tags: tagsByAsset[asset.id] ?? [],
      productType: asset.product_type,
      spaceType: asset.space_type,
      region: asset.region,
      usagePurpose: asset.usage_purpose,
      privacyChecked: asset.privacy_checked,
      promotionConsentChecked: asset.promotion_consent_checked,
      usedCount: asset.used_count,
      updatedAt: asset.updated_at,
      createdAt: asset.created_at,
      thumbnail: fileSummary(asset.id, assetFiles, 'thumbnail'),
      web: fileSummary(asset.id, assetFiles, 'web'),
    }
  })

  const tagOptions: ContentAssetTagOption[] = includeTagOptions
    ? tags.map(tag => ({ id: tag.id, name: tag.name }))
    : []

  return {
    items,
    tagOptions,
    hasMore,
    nextOffset: safeOffset + items.length,
    loadError: assetResult.error
      ? '사진보관함을 불러오지 못했습니다.'
      : fileResult.error
        ? '사진 미리보기를 불러오지 못했습니다.'
        : tagResult.error || tagLinkResult.error
          ? '태그 정보를 불러오지 못했습니다.'
          : null,
  }
}
