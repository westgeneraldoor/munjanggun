export const ASSET_LIBRARY_PAGE_SIZE = 48

export type AssetLibraryView = 'active' | 'archived'
export type AssetLibrarySort = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'sizeDesc' | 'sizeAsc'

export type AssetLibraryQuery = {
  search: string
  view: AssetLibraryView
  category: string
  productType: string
  spaceType: string
  region: string
  usagePurpose: string
  tagId: string
  sort: AssetLibrarySort
  page: number
}

export type AssetLibrarySearchParams = Record<string, string | string[] | undefined>

const SORTS = new Set<AssetLibrarySort>(['newest', 'oldest', 'nameAsc', 'nameDesc', 'sizeDesc', 'sizeAsc'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function scalar(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : ''
}

function clean(value: string | string[] | undefined, maxLength = 80) {
  return scalar(value).trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function positivePage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(scalar(value), 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100_000) : 1
}

export function parseAssetLibrarySearchParams(params: AssetLibrarySearchParams): AssetLibraryQuery {
  const sort = scalar(params.sort) as AssetLibrarySort
  const tagId = clean(params.tag, 36)

  return {
    search: clean(params.q, 120),
    view: scalar(params.view) === 'archived' ? 'archived' : 'active',
    category: clean(params.category),
    productType: clean(params.product),
    spaceType: clean(params.space),
    region: clean(params.region),
    usagePurpose: clean(params.purpose),
    tagId: UUID_PATTERN.test(tagId) ? tagId : '',
    sort: SORTS.has(sort) ? sort : 'newest',
    page: positivePage(params.page),
  }
}

export function assetLibraryQueryKey(query: AssetLibraryQuery) {
  return JSON.stringify(query)
}

export function buildAssetLibraryUrl(query: AssetLibraryQuery) {
  const params = new URLSearchParams()
  if (query.search) params.set('q', query.search)
  if (query.view === 'archived') params.set('view', query.view)
  if (query.category) params.set('category', query.category)
  if (query.productType) params.set('product', query.productType)
  if (query.spaceType) params.set('space', query.spaceType)
  if (query.region) params.set('region', query.region)
  if (query.usagePurpose) params.set('purpose', query.usagePurpose)
  if (query.tagId) params.set('tag', query.tagId)
  if (query.sort !== 'newest') params.set('sort', query.sort)
  if (query.page > 1) params.set('page', String(query.page))
  const suffix = params.toString()
  return suffix ? `/admin/platform/assets?${suffix}` : '/admin/platform/assets'
}

export function assetLibraryRpcArgs(query: AssetLibraryQuery) {
  return {
    p_search: query.search || null,
    p_view: query.view,
    p_category: query.category || null,
    p_product_type: query.productType || null,
    p_space_type: query.spaceType || null,
    p_region: query.region || null,
    p_usage_purpose: query.usagePurpose || null,
    p_tag_id: query.tagId || null,
    p_sort: query.sort,
    p_page: query.page,
    p_page_size: ASSET_LIBRARY_PAGE_SIZE,
  }
}
