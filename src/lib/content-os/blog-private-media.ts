import { isIP } from 'node:net'

export const ALLOWED_BLOG_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
])

export function normalizeBlogImageContentType(value: string | null): string | null {
  if (!value) return null

  const contentType = value.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  return ALLOWED_BLOG_IMAGE_TYPES.has(contentType) ? contentType : null
}

export function isAllowedBlogPrivateMediaUrl(value: string, allowedHostname: string): boolean {
  const expectedHostname = allowedHostname.trim().toLowerCase()
  if (!expectedHostname || expectedHostname === 'localhost' || isIP(expectedHostname.replace(/^\[|\]$/g, ''))) {
    return false
  }

  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()

    const publicBlogMediaPrefix = '/storage/v1/object/public/blog-media/'

    return url.protocol === 'https:'
      && url.username === ''
      && url.password === ''
      && url.port === ''
      && hostname === expectedHostname
      && hostname !== 'localhost'
      && isIP(hostname.replace(/^\[|\]$/g, '')) === 0
      && url.pathname.startsWith(publicBlogMediaPrefix)
      && url.pathname.length > publicBlogMediaPrefix.length
  } catch {
    return false
  }
}

export function blogPrivateMediaHeaders(contentType: string): HeadersInit {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': 'inline',
    'Content-Type': contentType,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  }
}
