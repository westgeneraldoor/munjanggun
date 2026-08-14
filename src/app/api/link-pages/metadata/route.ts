import { fetchUrlMetadata } from '@/lib/link-pages/url-metadata'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 4 * 1024
const MAX_URL_LENGTH = 2_048
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

class RequestBodyError extends Error {
  constructor(readonly status: number) {
    super()
  }
}

async function readBoundedBody(request: Request) {
  const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '', 10)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new RequestBodyError(413)
  if (!request.body) throw new RequestBodyError(400)

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new RequestBodyError(413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

function errorResponse(status: number) {
  return Response.json({ status: 'blocked' }, { status, headers: RESPONSE_HEADERS })
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') return errorResponse(415)

  try {
    const raw = await readBoundedBody(request)
    const body: unknown = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse(400)

    const values = body as Record<string, unknown>
    if (Object.keys(values).some((key) => key !== 'url')
      || typeof values.url !== 'string'
      || values.url.length === 0
      || values.url.length > MAX_URL_LENGTH) {
      return errorResponse(400)
    }

    const result = await fetchUrlMetadata(values.url)
    return Response.json(result, { headers: RESPONSE_HEADERS })
  } catch (error) {
    if (error instanceof RequestBodyError) return errorResponse(error.status)
    return errorResponse(400)
  }
}
