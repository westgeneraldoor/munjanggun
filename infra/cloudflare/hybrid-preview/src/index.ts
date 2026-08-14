interface Env {
  APP_ORIGIN: string
  HOME_ORIGIN: string
  PUBLIC_ORIGIN: string
}

const APP_PATH_PREFIXES = [
  '/_next/',
  '/api',
  '/admin',
  '/assets/blog-home/',
  '/assets/fonts/',
  '/auth/callback',
  '/blog',
  '/images/blog-launch/',
  '/images/measure/',
  '/icon.png',
  '/l',
  '/login',
  '/link-pages',
  '/measure',
  '/portal',
  '/preview',
  '/preview/',
] as const

const PRIVATE_PATH_PREFIXES = [
  '/admin',
  '/auth/',
  '/api',
  '/login',
  '/measure',
  '/portal',
  '/preview',
] as const

function matchesPath(pathname: string, prefix: string) {
  if (pathname === prefix) return true
  return prefix.endsWith('/')
    ? pathname.startsWith(prefix)
    : pathname.startsWith(`${prefix}/`)
}

function isAppPath(pathname: string) {
  return APP_PATH_PREFIXES.some(prefix => matchesPath(pathname, prefix))
}

function isPrivatePath(pathname: string) {
  return PRIVATE_PATH_PREFIXES.some(prefix => matchesPath(pathname, prefix))
}

function buildOriginFetch(request: Request, origin: string, publicOrigin: string, noStore: boolean) {
  const incomingUrl = new URL(request.url)
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, origin)
  const upstreamRequest = new Request(targetUrl, request)
  const publicUrl = new URL(publicOrigin)

  // Changing the URL before constructing this Request makes fetch use the
  // preview deployment as the origin and Host. The forwarding headers retain
  // the browser-facing preview hostname for redirect-aware application code.
  upstreamRequest.headers.set('x-forwarded-host', publicUrl.host)
  upstreamRequest.headers.set('x-forwarded-proto', publicUrl.protocol.slice(0, -1))
  upstreamRequest.headers.set('forwarded', `host=${publicUrl.host};proto=${publicUrl.protocol.slice(0, -1)}`)
  upstreamRequest.headers.set('x-hybrid-preview-proxy', '1')
  if (noStore) {
    upstreamRequest.headers.set('cache-control', 'no-cache')
    upstreamRequest.headers.set('pragma', 'no-cache')
  }

  return upstreamRequest
}

function rewritePreviewLocation(headers: Headers, appOrigin: string, publicOrigin: string) {
  const location = headers.get('location')
  if (!location) return

  try {
    const target = new URL(location, appOrigin)
    const preview = new URL(appOrigin)
    if (target.origin === preview.origin) {
      const publicUrl = new URL(publicOrigin)
      target.protocol = publicUrl.protocol
      target.host = publicUrl.host
      headers.set('location', target.toString())
    }
  } catch {
    // Keep malformed upstream locations unchanged; the browser will handle the
    // upstream response without this proxy inventing a destination.
  }
}

function responseWithCachePolicy(response: Response, noStore: boolean, appOrigin: string, publicOrigin: string) {
  const headers = new Headers(response.headers)
  rewritePreviewLocation(headers, appOrigin, publicOrigin)

  if (noStore) {
    headers.set('cache-control', 'private, no-store, max-age=0')
    headers.set('pragma', 'no-cache')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url)
    const shouldCanonicalize =
      incomingUrl.protocol !== 'https:' || incomingUrl.hostname === 'www.munjanggun.com'

    if (shouldCanonicalize) {
      incomingUrl.protocol = 'https:'
      incomingUrl.hostname = 'munjanggun.com'
      return Response.redirect(incomingUrl.toString(), 308)
    }

    const pathname = incomingUrl.pathname
    const appPath = isAppPath(pathname)
    const targetOrigin = appPath ? env.APP_ORIGIN : env.HOME_ORIGIN
    const noStore = appPath && isPrivatePath(pathname)
    const upstreamRequest = buildOriginFetch(request, targetOrigin, env.PUBLIC_ORIGIN, noStore)

    const upstreamResponse = await fetch(upstreamRequest)
    return responseWithCachePolicy(upstreamResponse, noStore, env.APP_ORIGIN, env.PUBLIC_ORIGIN)
  },
}
