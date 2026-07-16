import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/logger'
import {
  buildPrivateMediaProxyResponse,
  PRIVATE_MEDIA_BUCKET,
} from '@/lib/platform-private-media-proxy.mjs'
import { createPlatformClient } from '@/lib/supabase/platform-server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface MeasurementMediaRow {
  object_path: string
  file_name: string
  media_type: 'image' | 'video'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mediaId = searchParams.get('media_id')

  if (!mediaId || !UUID_PATTERN.test(mediaId)) {
    return NextResponse.json({ error: 'valid media_id required' }, { status: 400 })
  }

  const supabase = await createPlatformClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = profileData as { role: 'customer' | 'sales_manager' | 'administrator' } | null

  if (!profile || (profile.role !== 'administrator' && profile.role !== 'sales_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: mediaData, error: mediaError } = await supabase
    .from('measurement_media')
    .select('object_path, file_name, media_type')
    .eq('id', mediaId)
    .eq('bucket', PRIVATE_MEDIA_BUCKET)
    .maybeSingle()
  const media = mediaData as MeasurementMediaRow | null

  if (mediaError) {
    logError('Private media lookup error', mediaError)
    return NextResponse.json({ error: 'Media lookup failed' }, { status: 500 })
  }
  if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

  try {
    const adminStorage = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: signedData, error: signedError } = await adminStorage.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .createSignedUrl(media.object_path, 60)

    if (signedError || !signedData?.signedUrl) {
      logError('Private media signing error', signedError)
      return NextResponse.json({ error: 'Media access failed' }, { status: 500 })
    }

    const range = request.headers.get('range')
    const upstream = await fetch(signedData.signedUrl, {
      cache: 'no-store',
      headers: range ? { Range: range } : undefined,
      redirect: 'error',
    })
    const proxiedResponse = buildPrivateMediaProxyResponse(upstream, {
      fileName: media.file_name,
      mediaType: media.media_type,
    })
    if (!proxiedResponse) {
      logError('Private media upstream error', { status: upstream.status })
      return NextResponse.json({ error: 'Media access failed' }, { status: 502 })
    }
    return proxiedResponse
  } catch (err) {
    logError('Private media proxy error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
