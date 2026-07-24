interface Env {
  APP_ORIGIN: string
  PUBLIC_ORIGIN: string
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

const FRESH_TTL_SECONDS = 60
const STALE_TTL_SECONDS = 300
const CACHE_TTL_SECONDS = FRESH_TTL_SECONDS + STALE_TTL_SECONDS
const CACHE_NAME = 'munjanggun-showroom-html'

function isAnonymousDocumentRequest(request: Request) {
  const url = new URL(request.url)
  const accept = request.headers.get('accept') ?? ''

  return request.method === 'GET'
    && url.search === ''
    && !request.headers.has('authorization')
    && !request.headers.has('cookie')
    && accept.includes('text/html')
    && !request.headers.has('rsc')
    && !request.headers.has('next-action')
    && !request.headers.has('next-router-state-tree')
    && !request.headers.has('next-router-prefetch')
    && request.headers.get('purpose') !== 'prefetch'
}

function cacheKeyFor(request: Request) {
  const url = new URL(request.url)
  url.search = ''
  return new Request(url.toString(), { method: 'GET' })
}

function isCacheableDocument(response: Response) {
  const cacheControl = response.headers.get('cache-control') ?? ''
  const contentType = response.headers.get('content-type') ?? ''

  return response.status === 200
    && contentType.includes('text/html')
    && !response.headers.has('set-cookie')
    && !cacheControl.includes('private')
    && !cacheControl.includes('no-store')
}

function rewriteLocation(headers: Headers, appOrigin: string, publicOrigin: string) {
  const location = headers.get('location')
  if (!location) return

  try {
    const target = new URL(location, appOrigin)
    if (target.origin !== new URL(appOrigin).origin) return

    const publicUrl = new URL(publicOrigin)
    target.protocol = publicUrl.protocol
    target.host = publicUrl.host
    headers.set('location', target.toString())
  } catch {
    // Preserve malformed locations rather than inventing a destination.
  }
}

function withPublicHeaders(
  response: Response,
  cacheStatus: 'BYPASS' | 'HIT' | 'MISS' | 'STALE',
  appOrigin: string,
  publicOrigin: string,
  createdAt?: number,
) {
  const headers = new Headers(response.headers)
  rewriteLocation(headers, appOrigin, publicOrigin)
  headers.set('x-showroom-proxy', 'cloudflare')
  headers.set('x-showroom-cache', cacheStatus)

  if (cacheStatus !== 'BYPASS') {
    headers.set(
      'cache-control',
      `public, max-age=0, s-maxage=${FRESH_TTL_SECONDS}, stale-while-revalidate=${STALE_TTL_SECONDS}`,
    )
  }

  if (createdAt) {
    headers.set('age', String(Math.max(0, Math.floor((Date.now() - createdAt) / 1000))))
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function prepareCacheEntry(response: Response, createdAt: number) {
  const headers = new Headers(response.headers)
  headers.set('cache-control', `public, s-maxage=${CACHE_TTL_SECONDS}`)
  headers.set('x-showroom-cache-created-at', String(createdAt))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function upstreamRequest(request: Request, appOrigin: string, publicOrigin: string) {
  const incomingUrl = new URL(request.url)
  // Next canonicalizes showroom documents without a trailing slash. Fetch the
  // canonical origin path directly so the public `/middle-door/` route remains
  // a 200 response on the apex host instead of exposing the origin redirect.
  const originPath = incomingUrl.pathname.length > 1 && incomingUrl.pathname.endsWith('/')
    ? incomingUrl.pathname.slice(0, -1)
    : incomingUrl.pathname
  const target = new URL(`${originPath}${incomingUrl.search}`, appOrigin)
  const proxied = new Request(target, request)
  const publicUrl = new URL(publicOrigin)

  proxied.headers.set('x-forwarded-host', publicUrl.host)
  proxied.headers.set('x-forwarded-proto', publicUrl.protocol.slice(0, -1))
  proxied.headers.set('forwarded', `host=${publicUrl.host};proto=${publicUrl.protocol.slice(0, -1)}`)
  proxied.headers.set('x-showroom-proxy', '1')

  return proxied
}

async function fetchAndPrepare(request: Request, env: Env) {
  const upstream = await fetch(upstreamRequest(request, env.APP_ORIGIN, env.PUBLIC_ORIGIN), {
    redirect: 'manual',
    cache: 'no-store',
  })
  return upstream
}

async function refreshDocument(request: Request, cacheKey: Request, env: Env) {
  const upstream = await fetchAndPrepare(request, env)
  if (!isCacheableDocument(upstream)) return

  const cache = await caches.open(CACHE_NAME)
  await cache.put(cacheKey, prepareCacheEntry(upstream, Date.now()))
}

const worker = {
  async fetch(request: Request, env: Env, ctx: WorkerExecutionContext): Promise<Response> {
    if (!isAnonymousDocumentRequest(request)) {
      const upstream = await fetchAndPrepare(request, env)
      return withPublicHeaders(upstream, 'BYPASS', env.APP_ORIGIN, env.PUBLIC_ORIGIN)
    }

    const cacheKey = cacheKeyFor(request)
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(cacheKey)

    if (cached) {
      const createdAt = Number(cached.headers.get('x-showroom-cache-created-at'))
      const ageSeconds = Number.isFinite(createdAt)
        ? Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
        : CACHE_TTL_SECONDS

      if (ageSeconds <= FRESH_TTL_SECONDS) {
        return withPublicHeaders(cached, 'HIT', env.APP_ORIGIN, env.PUBLIC_ORIGIN, createdAt)
      }

      if (ageSeconds <= CACHE_TTL_SECONDS) {
        ctx.waitUntil(refreshDocument(request, cacheKey, env))
        return withPublicHeaders(cached, 'STALE', env.APP_ORIGIN, env.PUBLIC_ORIGIN, createdAt)
      }
    }

    const upstream = await fetchAndPrepare(request, env)
    if (!isCacheableDocument(upstream)) {
      return withPublicHeaders(upstream, 'BYPASS', env.APP_ORIGIN, env.PUBLIC_ORIGIN)
    }

    const createdAt = Date.now()
    const cacheEntry = prepareCacheEntry(upstream.clone(), createdAt)
    ctx.waitUntil(cache.put(cacheKey, cacheEntry))
    const response = withPublicHeaders(upstream, 'MISS', env.APP_ORIGIN, env.PUBLIC_ORIGIN, createdAt)
    return response
  },
}

export default worker
