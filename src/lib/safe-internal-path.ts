const INTERNAL_BASE = 'https://internal.munjanggun.invalid'
const MAX_PATH_DECODE_PASSES = 4

function hasSafePathname(pathname: string) {
  let candidate = pathname

  for (let pass = 0; pass <= MAX_PATH_DECODE_PASSES; pass += 1) {
    if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
      return false
    }

    try {
      const normalized = new URL(candidate, INTERNAL_BASE)
      if (
        normalized.origin !== INTERNAL_BASE
        || !normalized.pathname.startsWith('/')
        || normalized.pathname.startsWith('//')
        || normalized.pathname.includes('\\')
      ) {
        return false
      }

      const decoded = decodeURIComponent(candidate)
      if (decoded === candidate) return true
      candidate = decoded
    } catch {
      return false
    }
  }

  return false
}

function normalizeInternalPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }

  try {
    const parsed = new URL(value, INTERNAL_BASE)
    if (parsed.origin !== INTERNAL_BASE || !hasSafePathname(parsed.pathname)) return null

    const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    const verified = new URL(normalizedPath, INTERNAL_BASE)
    if (verified.origin !== INTERNAL_BASE || !hasSafePathname(verified.pathname)) return null

    return normalizedPath
  } catch {
    return null
  }
}

export function getSafeInternalPath(value: string | null | undefined, fallback = '/portal') {
  const safeFallback = normalizeInternalPath(fallback) ?? '/portal'
  return normalizeInternalPath(value) ?? safeFallback
}

export function getSafeInternalUrl(
  value: string | null | undefined,
  origin: string,
  fallback = '/portal'
) {
  const baseUrl = new URL(origin)
  const safeFallback = getSafeInternalPath(fallback)
  const redirectUrl = new URL(getSafeInternalPath(value, safeFallback), baseUrl)

  if (redirectUrl.origin !== baseUrl.origin || !hasSafePathname(redirectUrl.pathname)) {
    return new URL(safeFallback, baseUrl)
  }

  return redirectUrl
}
