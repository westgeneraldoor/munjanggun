export const PRIVATE_MEDIA_BUCKET = 'measurement-media'

/**
 * @param {string | null} upstreamValue
 * @param {'image' | 'video'} mediaType
 */
export function privateMediaContentType(upstreamValue, mediaType) {
  const value = upstreamValue?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
  const expectedPrefix = mediaType === 'image' ? 'image/' : 'video/'
  return value.startsWith(expectedPrefix) ? value : 'application/octet-stream'
}

/** @param {string} value */
function encodeRfc5987Value(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ))
}

/**
 * @param {Response} upstream
 * @param {{ fileName: string, mediaType: 'image' | 'video' }} media
 * @returns {Response | null}
 */
export function buildPrivateMediaProxyResponse(upstream, media) {
  if (![200, 206, 416].includes(upstream.status)) return null
  if (upstream.status !== 416 && !upstream.body) return null

  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeRfc5987Value(media.fileName)}`,
    'Content-Type': privateMediaContentType(upstream.headers.get('content-type'), media.mediaType),
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  })
  for (const name of ['accept-ranges', 'content-length', 'content-range']) {
    if (upstream.status === 416 && name === 'content-length') continue
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new Response(upstream.status === 416 ? null : upstream.body, {
    status: upstream.status,
    headers,
  })
}
