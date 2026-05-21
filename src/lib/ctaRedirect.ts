export type CtaRedirectKind = 'reservation' | 'store'

export const CTA_REDIRECT_PATHS: Record<CtaRedirectKind, string> = {
  reservation: '/go/reservation',
  store: '/go/store',
}

export function buildCtaRedirectUrl(origin: string, kind: CtaRedirectKind) {
  return new URL(CTA_REDIRECT_PATHS[kind], origin).toString()
}

export function selectCtaUrl(
  settings: { reservation_url?: string | null; store_url?: string | null } | null | undefined,
  kind: CtaRedirectKind
) {
  const value = kind === 'reservation' ? settings?.reservation_url : settings?.store_url
  const trimmed = value?.trim()
  return trimmed || null
}
