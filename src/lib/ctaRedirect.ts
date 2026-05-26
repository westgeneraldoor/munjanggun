export type CtaRedirectKind = 'reservation' | 'store'

export function selectCtaUrl(
  settings: { reservation_url?: string | null; store_url?: string | null } | null | undefined,
  kind: CtaRedirectKind
) {
  const value = kind === 'reservation' ? settings?.reservation_url : settings?.store_url
  const trimmed = value?.trim()
  return trimmed || null
}
