export function mergeContentAssetLabelsWithTags(labels, tags) {
  const normalizedTags = Array.isArray(tags) ? [...tags] : []
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return { tags: normalizedTags }
  return { ...labels, tags: normalizedTags }
}
