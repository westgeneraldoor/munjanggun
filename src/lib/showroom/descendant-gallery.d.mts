export type DescendantGalleryNode = {
  id: string
  parent_id: string | null
  name: string
  slug: string
  display_order: number
}

export type DescendantGalleryPhoto = {
  id: string
  node_id: string
  image_url: string
  caption: string | null
  display_order: number
  asset_id?: string | null
  media_id?: string | null
  source_id?: string | null
}

export type DescendantGalleryItem = {
  id: string
  assetKey: string
  imageUrl: string
  caption: string | null
  bucketId: string
  bucketName: string
  bucketUrl: string
  optionId: string
  optionName: string
  optionUrl: string
  optionBreadcrumb: string[]
  sourceNodeId: string
  sourceNodeName: string
  sourceNodeUrl: string
  sequence: number
}

export type DescendantGalleryBucket = {
  id: string
  nodeId: string
  name: string
  url: string
  photoCount: number
}

export type DescendantGallery = {
  buckets: DescendantGalleryBucket[]
  items: DescendantGalleryItem[]
  total: number
}

export type DescendantGalleryPage = DescendantGallery & {
  offset: number
  nextOffset: number | null
  hasMore: boolean
  snapshot: string
}

export function buildDescendantGallery(input: {
  currentNodeId: string
  nodes: DescendantGalleryNode[]
  photos: DescendantGalleryPhoto[]
}): DescendantGallery

export function paginateDescendantGallery(
  gallery: DescendantGallery,
  offset: number,
  limit: number,
): DescendantGalleryPage
