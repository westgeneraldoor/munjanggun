import type { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { Database } from '@/types/database'
import type { ContentAssetLibraryItem, ContentAssetTagOption } from './ContentAssetsClient'
import {
  ASSET_LIBRARY_PAGE_SIZE,
  assetLibraryRpcArgs,
  type AssetLibraryQuery,
} from './query-state'

export const ASSET_LIBRARY_SERVER_PAGE_SIZE = ASSET_LIBRARY_PAGE_SIZE

type ShowroomAdmin = ReturnType<typeof createShowroomAdminClient>
type AssetRow = Database['showroom']['Tables']['content_assets']['Row']
type AssetFileRow = Pick<
  Database['showroom']['Tables']['content_asset_files']['Row'],
  'asset_id' | 'file_role' | 'width' | 'height' | 'size_bytes' | 'transform_status'
>
type TagRow = Database['showroom']['Tables']['content_asset_tags']['Row']
type TagLinkRow = Database['showroom']['Tables']['content_asset_tag_links']['Row']
export type AssetLibraryFilterOptions = {
  category: string[]
  productType: string[]
  spaceType: string[]
  region: string[]
  usagePurpose: string[]
}

type AssetLibraryRpcPayload = {
  assetIds: string[]
  totalCount: number
  selectionToken: string
  page: number
  pageSize: number
  totalPages: number
  facets: {
    categories: string[]
    productTypes: string[]
    spaceTypes: string[]
    regions: string[]
    usagePurposes: string[]
  }
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function parseRpcPayload(value: unknown, fallbackPage: number): AssetLibraryRpcPayload | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Record<string, unknown>
  const facets = payload.facets && typeof payload.facets === 'object'
    ? payload.facets as Record<string, unknown>
    : {}
  const totalCount = Number(payload.totalCount)
  const page = Number(payload.page)
  const pageSize = Number(payload.pageSize)
  const totalPages = Number(payload.totalPages)
  const selectionToken = typeof payload.selectionToken === 'string' ? payload.selectionToken : ''
  if (![totalCount, page, pageSize, totalPages].every(Number.isSafeInteger) || !/^[0-9a-f]{32}$/.test(selectionToken)) return null

  return {
    assetIds: stringArray(payload.assetIds),
    totalCount: Math.max(0, totalCount),
    selectionToken,
    page: Math.max(1, page || fallbackPage),
    pageSize: Math.max(1, pageSize || ASSET_LIBRARY_SERVER_PAGE_SIZE),
    totalPages: Math.max(1, totalPages),
    facets: {
      categories: stringArray(facets.categories),
      productTypes: stringArray(facets.productTypes),
      spaceTypes: stringArray(facets.spaceTypes),
      regions: stringArray(facets.regions),
      usagePurposes: stringArray(facets.usagePurposes),
    },
  }
}

async function invokeAssetLibraryListRpc(showroomAdmin: ShowroomAdmin, query: AssetLibraryQuery) {
  const showroom = showroomAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: unknown
      error: { message: string } | null
    }>
  }
  return showroom.rpc('list_content_assets_admin', assetLibraryRpcArgs(query))
}

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
  query: AssetLibraryQuery,
  includeTagOptions = false,
) {
  const listResult = await invokeAssetLibraryListRpc(showroomAdmin, query)
  const listing = listResult.error ? null : parseRpcPayload(listResult.data, query.page)
  const assetIds = listing?.assetIds ?? []
  const assetResult = assetIds.length > 0
    ? await showroomAdmin
      .from('content_assets')
      .select('id, title, description, category, labels, product_type, space_type, region, usage_purpose, library_state, privacy_checked, promotion_consent_checked, used_count, created_by, updated_by, created_at, updated_at')
      .in('id', assetIds)
    : { data: [], error: null }
  const assetsById = new Map(((assetResult.data ?? []) as AssetRow[]).map(asset => [asset.id, asset]))
  const assets = assetIds.map(id => assetsById.get(id)).filter((asset): asset is AssetRow => Boolean(asset))

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
  const filterOptions: AssetLibraryFilterOptions = {
    category: listing?.facets.categories ?? [],
    productType: listing?.facets.productTypes ?? [],
    spaceType: listing?.facets.spaceTypes ?? [],
    region: listing?.facets.regions ?? [],
    usagePurpose: listing?.facets.usagePurposes ?? [],
  }

  return {
    items,
    tagOptions,
    filterOptions,
    totalCount: listing?.totalCount ?? 0,
    selectionToken: listing?.selectionToken ?? '',
    page: listing?.page ?? query.page,
    pageSize: listing?.pageSize ?? ASSET_LIBRARY_SERVER_PAGE_SIZE,
    totalPages: listing?.totalPages ?? 1,
    loadError: listResult.error || !listing
      ? '사진 검색 결과를 불러오지 못했습니다.'
      : assetResult.error
      ? '사진보관함을 불러오지 못했습니다.'
      : fileResult.error
        ? '사진 미리보기를 불러오지 못했습니다.'
        : tagResult.error || tagLinkResult.error
          ? '태그 정보를 불러오지 못했습니다.'
          : null,
  }
}
