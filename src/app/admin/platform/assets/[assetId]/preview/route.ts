import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import {
  blogPrivateMediaHeaders,
  normalizeBlogImageContentType,
} from '@/lib/content-os/blog-private-media'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRIVATE_MEDIA_FETCH_TIMEOUT_MS = 10_000
const ALLOWED_ASSET_BUCKETS = new Set(['content-assets-private', 'content-assets-public'])

type AssetFileRow = Pick<
  Database['showroom']['Tables']['content_asset_files']['Row'],
  'bucket' | 'object_path' | 'mime_type'
>

function rejectedResponse() {
  return new Response(null, {
    status: 404,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function isAllowedPrivateObjectPath(value: string) {
  if (!value || value.trim() === '' || value.startsWith('/') || value.startsWith('\\')) return false
  if (value.includes('\\') || value.includes('?') || value.includes('#') || /\p{Cc}/u.test(value)) return false

  return value.split('/').every(segment => {
    if (segment === '' || segment === '.' || segment === '..') return false
    try {
      const decoded = decodeURIComponent(segment)
      return decoded !== '.'
        && decoded !== '..'
        && !decoded.includes('/')
        && !decoded.includes('\\')
        && !decoded.includes('?')
        && !decoded.includes('#')
        && !/\p{Cc}/u.test(decoded)
    } catch {
      return false
    }
  })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    const { assetId } = await context.params
    const variant = new URL(request.url).searchParams.get('variant')
    if (!UUID_PATTERN.test(assetId) || (variant !== 'thumbnail' && variant !== 'web')) return rejectedResponse()

    const platform = await createPlatformClient()
    const { data: { user }, error: authError } = await platform.auth.getUser()
    if (authError || !user) return rejectedResponse()

    const { data: profileData, error: profileError } = await platform
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const profile = profileData as { role: 'administrator' | 'customer' | 'sales_manager' } | null
    if (profileError || profile?.role !== 'administrator') return rejectedResponse()

    const showroom = createShowroomAdminClient()
    const { data, error } = await showroom
      .from('content_asset_files')
      .select('bucket, object_path, mime_type')
      .eq('asset_id', assetId)
      .eq('file_role', variant)
      .eq('transform_status', 'ready')
      .maybeSingle()
    const file = data as AssetFileRow | null
    if (error || !file || !ALLOWED_ASSET_BUCKETS.has(file.bucket) || !isAllowedPrivateObjectPath(file.object_path)) {
      return rejectedResponse()
    }

    const { data: binary, error: downloadError } = await showroom.storage
      .from(file.bucket)
      .download(file.object_path, {}, { signal: AbortSignal.timeout(PRIVATE_MEDIA_FETCH_TIMEOUT_MS) })
    const contentType = normalizeBlogImageContentType(binary?.type ?? file.mime_type)
    if (downloadError || !binary || !contentType) return rejectedResponse()

    return new Response(binary.stream(), { headers: blogPrivateMediaHeaders(contentType) })
  } catch {
    return rejectedResponse()
  }
}

// The client asks this only after an <img> error. Reuse the exact same admin
// authorization and opaque lookup, while returning headers/status without a
// response body so it can give a meaningful, non-sensitive recovery hint.
export async function HEAD(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const response = await GET(request, context)
  return new Response(null, { status: response.status, headers: response.headers })
}
