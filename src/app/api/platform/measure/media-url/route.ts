import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { logError } from '@/lib/logger'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const objectPath = searchParams.get('object_path')

  if (!objectPath) {
    return NextResponse.json({ error: 'object_path required' }, { status: 400 })
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
    .eq('object_path', objectPath)
    .maybeSingle()

  if (mediaError) {
    logError('Signed URL media lookup error', mediaError)
    return NextResponse.json({ error: 'Media lookup failed' }, { status: 500 })
  }

  if (!mediaRow) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  // service role로 signed URL 생성
  try {
    const adminStorage = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await adminStorage.storage
      .from('measurement-media')
      .createSignedUrl(objectPath, 60) // 60초 만료

    if (error || !data?.signedUrl) {
      logError('Create signed URL error', error)
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err) {
    logError('Signed URL unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
