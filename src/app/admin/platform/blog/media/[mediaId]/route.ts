import { createPlatformAdminClient, createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params
  const platform = await createPlatformClient()
  const { data: { user } } = await platform.auth.getUser()
  if (!user) return new Response(null, { status: 404 })

  const platformAdmin = createPlatformAdminClient()
  const { data: profileData } = await platformAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const profile = profileData as { role: 'administrator' | 'customer' | 'sales_manager' } | null
  if (profile?.role !== 'administrator') return new Response(null, { status: 404 })

  const showroom = createShowroomAdminClient()
  const { data: mediaData } = await showroom
    .from('blog_media')
    .select('private_bucket, private_object_path, public_url')
    .eq('id', mediaId)
    .maybeSingle()
  const media = mediaData as Pick<Database['showroom']['Tables']['blog_media']['Row'], 'private_bucket' | 'private_object_path' | 'public_url'> | null
  if (!media) return new Response(null, { status: 404 })

  if (media.private_bucket && media.private_object_path) {
    const { data: file, error } = await showroom.storage.from(media.private_bucket).download(media.private_object_path)
    if (error || !file) return new Response(null, { status: 404 })
    return new Response(file.stream(), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': file.type || 'application/octet-stream',
      },
    })
  }

  if (!media.public_url) return new Response(null, { status: 404 })
  const upstream = await fetch(media.public_url, { cache: 'no-store' })
  if (!upstream.ok || !upstream.body) return new Response(null, { status: 404 })
  return new Response(upstream.body, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    },
  })
}
