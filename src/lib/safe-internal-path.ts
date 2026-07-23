const INTERNAL_BASE = 'https://internal.munjanggun.invalid'

export function getSafeInternalPath(value: string | null | undefined, fallback = '/portal') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback
  }

  try {
    const parsed = new URL(value, INTERNAL_BASE)
    if (parsed.origin !== INTERNAL_BASE) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
