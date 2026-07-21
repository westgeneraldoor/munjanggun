import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import {
  blogPrivateMediaHeaders,
  isAllowedBlogPrivateMediaUrl,
  normalizeBlogImageContentType,
} from '@/lib/content-os/blog-private-media'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PRIVATE_MEDIA_FETCH_TIMEOUT_MS = 10_000
const ALLOWED_PRIVATE_BUCKETS = new Set([
  'blog-media-private',
  'content-assets-private',
])

type BlogPrivateMediaRow = Pick<
  Database['showroom']['Tables']['blog_media']['Row'],
  'private_bucket' | 'private_object_path' | 'public_url'
>

function rejectedResponse() {
  return new Response(null, {
    status: 404,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function configuredSupabaseHostname() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) return null

  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function isAllowedPrivateObjectPath(value: string) {
  if (!value || value.trim() === '' || value.startsWith('/') || value.startsWith('\\')) return false
  if (value.includes('\\') || value.includes('?') || value.includes('#')) return false
  if (/\p{Cc}/u.test(value)) return false

  const segments = value.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') return false

    try {
      const decoded = decodeURIComponent(segment)
      if (
        decoded === '.'
        || decoded === '..'
        || decoded.includes('/')
        || decoded.includes('\\')
        || decoded.includes('?')
        || decoded.includes('#')
        || /\p{Cc}/u.test(decoded)
      ) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

function isAllowedPrivateStorageSource(bucket: string, objectPath: string) {
  return ALLOWED_PRIVATE_BUCKETS.has(bucket) && isAllowedPrivateObjectPath(objectPath)
}

export async function GET(
  _request: Request,
  context: RouteContext<'/admin/platform/blog/media/[mediaId]'>,
) {
  try {
    const { mediaId } = await context.params
    if (!UUID_PATTERN.test(mediaId)) return rejectedResponse()

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
    const { data: mediaData, error: mediaError } = await showroom
      .from('blog_media')
      .select('private_bucket, private_object_path, public_url')
      .eq('id', mediaId)
      .maybeSingle()
    const media = mediaData as BlogPrivateMediaRow | null
    if (mediaError || !media) return rejectedResponse()

    if (media.private_bucket !== null || media.private_object_path !== null) {
      if (
        !media.private_bucket
        || !media.private_object_path
        || !isAllowedPrivateStorageSource(media.private_bucket, media.private_object_path)
      ) {
        return rejectedResponse()
      }

      const { data: file, error } = await showroom.storage
        .from(media.private_bucket)
        .download(
          media.private_object_path,
          {},
          { signal: AbortSignal.timeout(PRIVATE_MEDIA_FETCH_TIMEOUT_MS) },
        )
      const contentType = normalizeBlogImageContentType(file?.type ?? null)
      if (error || !file || !contentType) return rejectedResponse()

      return new Response(file.stream(), {
        headers: blogPrivateMediaHeaders(contentType),
      })
    }

    const allowedHostname = configuredSupabaseHostname()
    if (!media.public_url || !allowedHostname || !isAllowedBlogPrivateMediaUrl(media.public_url, allowedHostname)) {
      return rejectedResponse()
    }

    const upstream = await fetch(media.public_url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(PRIVATE_MEDIA_FETCH_TIMEOUT_MS),
    })
    const contentType = normalizeBlogImageContentType(upstream.headers.get('content-type'))
    if (!upstream.ok || !upstream.body || !contentType) return rejectedResponse()

    return new Response(upstream.body, {
      headers: blogPrivateMediaHeaders(contentType),
    })
  } catch {
    return rejectedResponse()
  }
}
