import {
  buildShowroomDerivativeObjectPath,
  SHOWROOM_IMAGE_VARIANT_SPECS,
} from './showroom-image-derivatives.mjs'

export function showroomBackfillStateComplete(states) {
  return Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS).every(variant => (
    states?.get(variant)?.status === 'ready' || states?.get(variant)?.status === 'skipped'
  ))
}

export function shouldProcessShowroomBackfillState(
  states,
  { retryFailed = false, metadataRefreshRequired = false } = {},
) {
  if (!states || states.size === 0) return true
  if (showroomBackfillStateComplete(states)) return metadataRefreshRequired
  const hasFailed = [...states.values()].some(state => state.status === 'failed')
  return !hasFailed || retryFailed
}

export function createShowroomBackfillEstimate(existingReadyObjectPaths = []) {
  const existingObjects = new Set(existingReadyObjectPaths)
  const outputObjects = new Map()
  const newObjects = new Map()
  const variantObjects = Object.fromEntries(
    Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS).map(variant => [variant, new Map()]),
  )
  const newVariantObjects = Object.fromEntries(
    Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS).map(variant => [variant, new Map()]),
  )
  const variants = Object.fromEntries(
    Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS).map(variant => [variant, {
      readyRecords: 0,
      skippedRecords: 0,
      uniqueFiles: 0,
      bytes: 0,
      averageBytes: 0,
      maxBytes: 0,
      selectedRecords: 0,
      originalFallbackRecords: 0,
      selectedBytes: 0,
      selectedAverageBytes: 0,
      selectedMaxBytes: 0,
      newUniqueFiles: 0,
      newBytes: 0,
    }]),
  )
  let sourceCount = 0
  let sourceBytes = 0
  let sourceMaxBytes = 0
  let readyDerivativeRecords = 0
  let skippedVariantRecords = 0
  let newDerivativeRecords = 0
  let pendingVariantWrites = 0

  return {
    add(transformed, states = new Map()) {
      sourceCount += 1
      sourceBytes += transformed.original.sizeBytes
      sourceMaxBytes = Math.max(sourceMaxBytes, transformed.original.sizeBytes)

      for (const [variant, derivative] of Object.entries(transformed.variants)) {
        variants[variant].selectedRecords += 1
        const state = states.get(variant)
        const stateIsComplete = state?.status === 'ready' || state?.status === 'skipped'
        if (!stateIsComplete) pendingVariantWrites += 1
        if (!state) newDerivativeRecords += 1

        if (derivative.status === 'skipped') {
          skippedVariantRecords += 1
          variants[variant].skippedRecords += 1
          variants[variant].originalFallbackRecords += 1
          variants[variant].selectedBytes += transformed.original.sizeBytes
          variants[variant].selectedMaxBytes = Math.max(
            variants[variant].selectedMaxBytes,
            transformed.original.sizeBytes,
          )
          continue
        }

        const objectPath = buildShowroomDerivativeObjectPath(
          transformed.original.checksumSha256,
          variant,
        )
        readyDerivativeRecords += 1
        variants[variant].readyRecords += 1
        variants[variant].selectedBytes += derivative.sizeBytes
        variants[variant].selectedMaxBytes = Math.max(
          variants[variant].selectedMaxBytes,
          derivative.sizeBytes,
        )
        outputObjects.set(objectPath, derivative.sizeBytes)
        variantObjects[variant].set(objectPath, derivative.sizeBytes)
        if (!existingObjects.has(objectPath)) {
          newObjects.set(objectPath, derivative.sizeBytes)
          newVariantObjects[variant].set(objectPath, derivative.sizeBytes)
        }
      }
    },

    snapshot() {
      for (const [variant, objects] of Object.entries(variantObjects)) {
        const sizes = [...objects.values()]
        const newSizes = [...newVariantObjects[variant].values()]
        variants[variant].uniqueFiles = sizes.length
        variants[variant].bytes = sizes.reduce((total, sizeBytes) => total + sizeBytes, 0)
        variants[variant].averageBytes = sizes.length === 0
          ? 0
          : Math.round(variants[variant].bytes / sizes.length)
        variants[variant].maxBytes = sizes.length === 0 ? 0 : Math.max(...sizes)
        variants[variant].selectedAverageBytes = variants[variant].selectedRecords === 0
          ? 0
          : Math.round(variants[variant].selectedBytes / variants[variant].selectedRecords)
        variants[variant].newUniqueFiles = newSizes.length
        variants[variant].newBytes = newSizes.reduce((total, sizeBytes) => total + sizeBytes, 0)
      }

      return {
        sourceCount,
        sourceBytes,
        sourceAverageBytes: sourceCount === 0 ? 0 : Math.round(sourceBytes / sourceCount),
        sourceMaxBytes,
        readyDerivativeRecords,
        skippedVariantRecords,
        outputDerivativeFiles: outputObjects.size,
        outputDerivativeBytes: [...outputObjects.values()]
          .reduce((total, sizeBytes) => total + sizeBytes, 0),
        newDerivativeRecords,
        pendingVariantWrites,
        newDerivativeFiles: newObjects.size,
        newDerivativeBytes: [...newObjects.values()]
          .reduce((total, sizeBytes) => total + sizeBytes, 0),
        variants,
      }
    },
  }
}
