/**
 * Builds a stable, presentation-ready sequence for the public showroom's
 * descendant gallery. This module deliberately has no Next.js or database
 * dependency so the ordering contract can be tested in isolation.
 */

function compareDisplayOrder(left, right) {
  const leftOrder = Number.isFinite(left.display_order) ? left.display_order : 0
  const rightOrder = Number.isFinite(right.display_order) ? right.display_order : 0

  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return String(left.slug ?? left.id).localeCompare(String(right.slug ?? right.id), 'ko')
    || String(left.id).localeCompare(String(right.id))
}

function comparePhotoOrder(left, right) {
  const leftOrder = Number.isFinite(left.display_order) ? left.display_order : 0
  const rightOrder = Number.isFinite(right.display_order) ? right.display_order : 0

  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return String(left.id).localeCompare(String(right.id))
}

function indexChildren(nodes) {
  const childrenByParentId = new Map()

  for (const node of nodes) {
    const parentKey = node.parent_id ?? null
    const children = childrenByParentId.get(parentKey) ?? []
    children.push(node)
    childrenByParentId.set(parentKey, children)
  }

  for (const children of childrenByParentId.values()) {
    children.sort(compareDisplayOrder)
  }

  return childrenByParentId
}

function buildNodeUrl(node, nodesById) {
  const segments = []
  let currentNode = node
  const visited = new Set()

  while (currentNode && !visited.has(currentNode.id)) {
    visited.add(currentNode.id)
    if (currentNode.slug) {
      segments.unshift(currentNode.slug)
    }
    currentNode = currentNode.parent_id ? nodesById.get(currentNode.parent_id) : null
  }

  return `/${segments.join('/')}`
}

function buildNodeBreadcrumb(node, nodesById) {
  const breadcrumb = []
  let currentNode = node
  const visited = new Set()

  while (currentNode && !visited.has(currentNode.id)) {
    visited.add(currentNode.id)
    if (currentNode.name) {
      breadcrumb.unshift(currentNode.name)
    }
    currentNode = currentNode.parent_id ? nodesById.get(currentNode.parent_id) : null
  }

  return breadcrumb
}

function collectNodeAndDescendants(nodeId, childrenByParentId) {
  const ids = []
  const queue = [nodeId]
  const visited = new Set()

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) continue
    if (visited.has(currentId)) continue

    visited.add(currentId)
    ids.push(currentId)

    for (const child of childrenByParentId.get(currentId) ?? []) {
      queue.push(child.id)
    }
  }

  return ids
}

function stableAssetKey(photo) {
  return String(
    photo.asset_id
    ?? photo.media_id
    ?? photo.source_id
    ?? photo.image_url
    ?? photo.id,
  )
}

function flattenBucketPhotos({
  bucket,
  photosByNodeId,
  childrenByParentId,
  nodesById,
}) {
  const records = []
  const queue = [bucket.nodeId]
  const visited = new Set()

  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId) continue
    if (visited.has(nodeId)) continue

    visited.add(nodeId)
    const sourceNode = nodesById.get(nodeId)
    if (!sourceNode) continue

    const photos = [...(photosByNodeId.get(nodeId) ?? [])].sort(comparePhotoOrder)
    for (const photo of photos) {
      records.push({
        id: photo.id,
        assetKey: stableAssetKey(photo),
        imageUrl: photo.image_url,
        caption: photo.caption ?? null,
        bucketId: bucket.id,
        bucketName: bucket.name,
        bucketUrl: bucket.url,
        optionId: sourceNode.id,
        optionName: sourceNode.name,
        optionUrl: buildNodeUrl(sourceNode, nodesById),
        optionBreadcrumb: buildNodeBreadcrumb(sourceNode, nodesById),
        sourceNodeId: sourceNode.id,
        sourceNodeName: sourceNode.name,
        sourceNodeUrl: buildNodeUrl(sourceNode, nodesById),
      })
    }

    if (bucket.includeDescendants !== false) {
      for (const child of childrenByParentId.get(nodeId) ?? []) {
        queue.push(child.id)
      }
    }
  }

  return records
}

function roundRobin(buckets) {
  const ordered = []
  const maxLength = Math.max(0, ...buckets.map(bucket => bucket.photos.length))

  for (let photoIndex = 0; photoIndex < maxLength; photoIndex += 1) {
    for (const bucket of buckets) {
      const photo = bucket.photos[photoIndex]
      if (photo) ordered.push(photo)
    }
  }

  return ordered
}

function interleavePhotosByOwner(photos) {
  const owners = []
  const photosByOwnerId = new Map()

  for (const photo of photos) {
    const ownerId = photo.optionId
    let owner = photosByOwnerId.get(ownerId)
    if (!owner) {
      owner = { id: ownerId, photos: [] }
      photosByOwnerId.set(ownerId, owner)
      owners.push(owner)
    }
    owner.photos.push(photo)
  }

  return roundRobin(owners)
}

/**
 * @param {{ currentNodeId: string, nodes: Array<object>, photos: Array<object> }} input
 */
export function buildDescendantGallery(input) {
  const nodes = [...input.nodes].sort(compareDisplayOrder)
  const nodesById = new Map(nodes.map(node => [node.id, node]))
  const currentNode = nodesById.get(input.currentNodeId)
  if (!currentNode) return { buckets: [], items: [], total: 0 }

  const childrenByParentId = indexChildren(nodes)
  const photosByNodeId = new Map()
  for (const photo of input.photos) {
    const photos = photosByNodeId.get(photo.node_id) ?? []
    photos.push(photo)
    photosByNodeId.set(photo.node_id, photos)
  }

  const buckets = []
  const currentPhotos = photosByNodeId.get(currentNode.id) ?? []
  if (currentPhotos.length > 0) {
    buckets.push({
      id: `all:${currentNode.id}`,
      nodeId: currentNode.id,
      name: '전체',
      url: buildNodeUrl(currentNode, nodesById),
      includeDescendants: false,
    })
  }

  for (const child of childrenByParentId.get(currentNode.id) ?? []) {
    const descendantIds = collectNodeAndDescendants(child.id, childrenByParentId)
    const hasPhotos = descendantIds.some(nodeId => (photosByNodeId.get(nodeId) ?? []).length > 0)
    if (!hasPhotos) continue

    buckets.push({
      id: child.id,
      nodeId: child.id,
      name: child.name,
      url: buildNodeUrl(child, nodesById),
      includeDescendants: true,
    })
  }

  const usedAssetKeys = new Set()
  const bucketsWithPhotos = buckets.map(bucket => ({
    ...bucket,
    photos: interleavePhotosByOwner(flattenBucketPhotos({
      bucket,
      photosByNodeId,
      childrenByParentId,
      nodesById,
    }).filter(photo => {
      if (usedAssetKeys.has(photo.assetKey)) return false
      usedAssetKeys.add(photo.assetKey)
      return true
    })),
  })).filter(bucket => bucket.photos.length > 0)

  const items = roundRobin(bucketsWithPhotos).map((photo, index) => ({
    ...photo,
    sequence: index,
  }))

  return {
    buckets: bucketsWithPhotos.map(bucket => ({
      id: bucket.id,
      nodeId: bucket.nodeId,
      name: bucket.name,
      url: bucket.url,
      photoCount: bucket.photos.length,
    })),
    items,
    total: items.length,
  }
}

export function paginateDescendantGallery(gallery, offset, limit) {
  const safeOffset = Math.max(0, Number.isFinite(offset) ? Math.floor(offset) : 0)
  const safeLimit = Math.min(24, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 12))
  const items = gallery.items.slice(safeOffset, safeOffset + safeLimit)
  const nextOffset = safeOffset + items.length

  return {
    buckets: gallery.buckets,
    items,
    total: gallery.total,
    offset: safeOffset,
    nextOffset: nextOffset < gallery.total ? nextOffset : null,
    hasMore: nextOffset < gallery.total,
  }
}
