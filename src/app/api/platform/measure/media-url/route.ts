import { NextResponse } from 'next/server'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { logError } from '@/lib/logger'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mediaId = searchParams.get('media_id')

  if (!mediaId || !UUID_PATTERN.test(mediaId)) {
    return NextResponse.json({ error: 'valid media_id required' }, { status: 400 })
  }

  // 관리자 인증 확인
  const supabase = await createPlatformClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'customer' | 'sales_manager' | 'administrator' } | null

  if (!profile || (profile.role !== 'administrator' && profile.role !== 'sales_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: mediaRow, error: mediaError } = await supabase
    .from('measurement_media')
    .select('id')
    .eq('id', mediaId)
    .maybeSingle()

  if (mediaError) {
    logError('Signed URL media lookup error', mediaError)
    return NextResponse.json({ error: 'Media lookup failed' }, { status: 500 })
  }

  if (!mediaRow) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  const url = `/api/platform/measure/media-file?media_id=${encodeURIComponent(mediaId)}`
  return NextResponse.json({ url }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}
