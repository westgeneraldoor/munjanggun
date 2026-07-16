function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

export function centralBrandPublicationBlocker(labels) {
  const centralBrand = objectValue(objectValue(labels)?.centralBrand)
  if (!centralBrand) return null

  if (centralBrand.privacyStatus !== 'official_reviewed') {
    return 'Central brand media has not completed the official privacy review.'
  }
  if (centralBrand.claimRisk !== 'low') {
    return 'Central brand media has unresolved claim risk and cannot be published.'
  }
  if (centralBrand.externalPublish !== 'allowed_after_context_check') {
    return 'Central brand media requires a fresh claim review before publication.'
  }
  return null
}
