import 'server-only'

import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import { logError } from '@/lib/logger'
import { SHOWROOM_CATALOG_CACHE_TAG } from '@/lib/showroom/cache-tags'
import { createPublicShowroomClient, hasPublicShowroomEnv } from '@/lib/supabase/public'
import {
  loadShowroomImageSources,
  originalShowroomImageSource,
  type ShowroomImageSource,
  type ShowroomImageSourceMap,
} from '@/lib/showroom/image-sources'
import type { Database } from '@/types/database'
import {
  buildDescendantGallery,
  paginateDescendantGallery,
  type DescendantGallery,
  type DescendantGalleryItem,
  type DescendantGalleryNode,
  type DescendantGalleryPage,
  type DescendantGalleryPhoto,
} from './descendant-gallery.mjs'

export const DESCENDANT_GALLERY_INITIAL_PAGE_SIZE = 12
export const ROOT_DESCENDANT_GALLERY_ID = 'showroom-root'

const DATABASE_PAGE_SIZE = 1_000
const NODE_QUERY_CHUNK_SIZE = 200

type PublishedNodeRow = Pick<
  Database['showroom']['Tables']['nodes']['Row'],
  'id' | 'parent_id' | 'name' | 'slug' | 'display_order'
>

type GalleryPhotoRow = Pick<
  Database['showroom']['Tables']['gallery_photos']['Row'],
  'id' | 'node_id' | 'image_url' | 'caption' | 'display_order'
>

export type DescendantGalleryRenderableItem = DescendantGalleryItem & {
  imageSource: ShowroomImageSource
  aspectRatio: number
}

export class DescendantGallerySnapshotMismatchError extends Error {
  constructor() {
    super('The descendant gallery ordering has changed.')
    this.name = 'DescendantGallerySnapshotMismatchError'
  }
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function isPositiveDimension(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function imageAspectRatio(source: ShowroomImageSource) {
  const dimensions = source.variants.card
    ?? source.variants.display
    ?? source.variants.large

  if (dimensions && isPositiveDimension(dimensions.width) && isPositiveDimension(dimensions.height)) {
    return dimensions.width / dimensions.height
  }

  return 4 / 3
}

async function loadAllPublishedNodes(): Promise<DescendantGalleryNode[]> {
  if (!hasPublicShowroomEnv()) return []

  const showroomDb = createPublicShowroomClient().schema('showroom')
  const nodes: PublishedNodeRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await showroomDb
      .from('nodes')
      .select('id, parent_id, name, slug, display_order')
      .eq('status', 'published')
      .order('parent_id')
      .order('display_order')
      .order('id')
      .range(offset, offset + DATABASE_PAGE_SIZE - 1)

    if (error) throw error

    const page = (data ?? []) as PublishedNodeRow[]
    nodes.push(...page)
    if (page.length < DATABASE_PAGE_SIZE) break
    offset += page.length
  }

  return nodes
}

const getCachedPublishedNodes = unstable_cache(
  loadAllPublishedNodes,
  ['showroom-descendant-gallery-published-nodes-v2'],
  { revalidate: 60, tags: [SHOWROOM_CATALOG_CACHE_TAG] },
)

function collectSubtreeNodeIds(currentNodeId: string, nodes: DescendantGalleryNode[]) {
  const childrenByParentId = new Map<string, string[]>()

  for (const node of nodes) {
    if (!node.parent_id) continue
    const children = childrenByParentId.get(node.parent_id) ?? []
    children.push(node.id)
    childrenByParentId.set(node.parent_id, children)
  }

  const nodeIds: string[] = []
  const queue = [currentNodeId]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)
    nodeIds.push(nodeId)
    queue.push(...(childrenByParentId.get(nodeId) ?? []))
  }

  return nodeIds
}

async function loadGalleryPhotosForNodeIds(nodeIds: string[]): Promise<DescendantGalleryPhoto[]> {
  if (!hasPublicShowroomEnv() || nodeIds.length === 0) return []

  const showroomDb = createPublicShowroomClient().schema('showroom')
  const photos: GalleryPhotoRow[] = []

  for (const nodeIdChunk of chunk(nodeIds, NODE_QUERY_CHUNK_SIZE)) {
    let offset = 0

    while (true) {
      const { data, error } = await showroomDb
        .from('gallery_photos')
        .select('id, node_id, image_url, caption, display_order')
        .in('node_id', nodeIdChunk)
        .order('node_id')
        .order('display_order')
        .order('id')
        .range(offset, offset + DATABASE_PAGE_SIZE - 1)

      if (error) throw error

      const page = (data ?? []) as GalleryPhotoRow[]
      photos.push(...page)
      if (page.length < DATABASE_PAGE_SIZE) break
      offset += page.length
    }
  }

  return photos
}

async function loadDescendantGallery(currentNodeId: string) {
  const nodes = await getCachedPublishedNodes()
  if (!nodes.some(node => node.id === currentNodeId)) {
    return buildDescendantGallery({ currentNodeId, nodes, photos: [] })
  }

  const photos = await loadGalleryPhotosForNodeIds(
    collectSubtreeNodeIds(currentNodeId, nodes),
  )

  return buildDescendantGallery({ currentNodeId, nodes, photos })
}

const getCachedDescendantGallery = unstable_cache(
  loadDescendantGallery,
  ['showroom-descendant-gallery-v2'],
  { revalidate: 60, tags: [SHOWROOM_CATALOG_CACHE_TAG] },
)

function withVirtualShowroomRoot(nodes: DescendantGalleryNode[]): DescendantGalleryNode[] {
  const virtualRoot: DescendantGalleryNode = {
    id: ROOT_DESCENDANT_GALLERY_ID,
    parent_id: null,
    name: '',
    slug: '',
    display_order: -1,
  }

  return [
    virtualRoot,
    ...nodes.map(node => (
      node.parent_id === null
        ? { ...node, parent_id: ROOT_DESCENDANT_GALLERY_ID }
        : node
    )),
  ]
}

async function loadRootDescendantGallery() {
  const nodes = await getCachedPublishedNodes()
  const photos = await loadGalleryPhotosForNodeIds(nodes.map(node => node.id))

  return buildDescendantGallery({
    currentNodeId: ROOT_DESCENDANT_GALLERY_ID,
    nodes: withVirtualShowroomRoot(nodes),
    photos,
  })
}

const getCachedRootDescendantGallery = unstable_cache(
  loadRootDescendantGallery,
  ['showroom-root-descendant-gallery-v2'],
  { revalidate: 60, tags: [SHOWROOM_CATALOG_CACHE_TAG] },
)

function snapshotDescendantGallery(gallery: DescendantGallery) {
  const orderedIdentity = gallery.items.map(item => `${item.sequence}:${item.assetKey}:${item.id}`).join('\n')
  return createHash('sha256').update(orderedIdentity).digest('base64url')
}

export async function loadDescendantGalleryPage(
  currentNodeId: string,
  offset = 0,
  limit = DESCENDANT_GALLERY_INITIAL_PAGE_SIZE,
  expectedSnapshot?: string | null,
): Promise<DescendantGalleryPage> {
  const gallery = await getCachedDescendantGallery(currentNodeId)
  const snapshot = snapshotDescendantGallery(gallery)
  if (expectedSnapshot && expectedSnapshot !== snapshot) {
    throw new DescendantGallerySnapshotMismatchError()
  }

  return {
    ...paginateDescendantGallery(gallery, offset, limit),
    snapshot,
  }
}

export async function loadRootDescendantGalleryPage(
  offset = 0,
  limit = DESCENDANT_GALLERY_INITIAL_PAGE_SIZE,
  expectedSnapshot?: string | null,
): Promise<DescendantGalleryPage> {
  const gallery = await getCachedRootDescendantGallery()
  const snapshot = snapshotDescendantGallery(gallery)
  if (expectedSnapshot && expectedSnapshot !== snapshot) {
    throw new DescendantGallerySnapshotMismatchError()
  }

  return {
    ...paginateDescendantGallery(gallery, offset, limit),
    snapshot,
  }
}

export function decorateDescendantGalleryItems(
  items: DescendantGalleryItem[],
  imageSources: ShowroomImageSourceMap,
): DescendantGalleryRenderableItem[] {
  return items.map(item => {
    const imageSource = imageSources[item.imageUrl] ?? originalShowroomImageSource(item.imageUrl)
    return {
      ...item,
      imageSource,
      aspectRatio: imageAspectRatio(imageSource),
    }
  })
}

export async function loadRenderableDescendantGalleryPage(
  currentNodeId: string,
  offset = 0,
  limit = DESCENDANT_GALLERY_INITIAL_PAGE_SIZE,
  expectedSnapshot?: string | null,
) {
  const page = await loadDescendantGalleryPage(currentNodeId, offset, limit, expectedSnapshot)

  try {
    const supabase = createPublicShowroomClient()
    const imageSources = await loadShowroomImageSources(
      supabase,
      page.items.map(item => item.imageUrl),
    )
    return {
      ...page,
      items: decorateDescendantGalleryItems(page.items, imageSources),
    }
  } catch (error) {
    logError('Failed to prepare descendant showroom gallery images.', error)
    return {
      ...page,
      items: decorateDescendantGalleryItems(page.items, {}),
    }
  }
}

export async function loadRenderableRootDescendantGalleryPage(
  offset = 0,
  limit = DESCENDANT_GALLERY_INITIAL_PAGE_SIZE,
  expectedSnapshot?: string | null,
) {
  const page = await loadRootDescendantGalleryPage(offset, limit, expectedSnapshot)

  try {
    const supabase = createPublicShowroomClient()
    const imageSources = await loadShowroomImageSources(
      supabase,
      page.items.map(item => item.imageUrl),
    )
    return {
      ...page,
      items: decorateDescendantGalleryItems(page.items, imageSources),
    }
  } catch (error) {
    logError('Failed to prepare root showroom gallery images.', error)
    return {
      ...page,
      items: decorateDescendantGalleryItems(page.items, {}),
    }
  }
}
