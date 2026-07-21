function optionalText(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || null
}

export function validateOfficialAssetPlacementOptions(options = {}) {
  const placement = {
    postId: optionalText(options.postId),
    cover: options.cover === true,
    blockId: optionalText(options.blockId),
    insertAfterBlockId: optionalText(options.insertAfterBlockId),
  }

  if ((placement.cover || placement.blockId || placement.insertAfterBlockId) && !placement.postId) {
    throw new Error('--cover, --block-id, and --insert-after-block-id require --post-id.')
  }
  if (placement.blockId && placement.insertAfterBlockId) {
    throw new Error('--block-id and --insert-after-block-id are mutually exclusive.')
  }

  return placement
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeOfficialAssetPlacementResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Atomic blog placement returned an invalid result.')
  }

  const result = {
    mediaId: value.mediaId,
    blockId: value.blockId ?? null,
    createdMedia: value.createdMedia,
    cover: value.cover,
    insertedBlock: value.insertedBlock,
    shiftedBlocks: value.shiftedBlocks,
    eventsCreated: value.eventsCreated,
  }
  if (!UUID_PATTERN.test(result.mediaId)) {
    throw new Error('Atomic blog placement did not return a valid media ID.')
  }
  if (result.blockId !== null && !UUID_PATTERN.test(result.blockId)) {
    throw new Error('Atomic blog placement returned an invalid block ID.')
  }
  for (const key of ['createdMedia', 'cover', 'insertedBlock']) {
    if (typeof result[key] !== 'boolean') {
      throw new Error(`Atomic blog placement returned an invalid ${key} flag.`)
    }
  }
  for (const key of ['shiftedBlocks', 'eventsCreated']) {
    if (!Number.isInteger(result[key]) || result[key] < 0) {
      throw new Error(`Atomic blog placement returned an invalid ${key} count.`)
    }
  }
  return result
}
