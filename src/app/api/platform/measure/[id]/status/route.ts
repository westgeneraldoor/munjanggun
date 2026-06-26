import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { logError } from '@/lib/logger'

interface StatusPayload {
  status: string
  appsheet_status: string
  memo?: string
}

const VALID_STATUSES = ['submitted', 'appsheet_pending', 'appsheet_registered', 'contacted', 'assigned', 'scheduled', 'measured', 'cancelled']
const VALID_APPSHEET = ['pending', 'registered', 'skipped']

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  let body: StatusPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { status, appsheet_status, memo } = body

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  if (!VALID_APPSHEET.includes(appsheet_status)) {
    return NextResponse.json({ error: 'Invalid appsheet_status value' }, { status: 400 })
  }

  try {
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: 'platform' } }
    )

    // 상태 업데이트
    const { error: updateError } = await adminClient
      .from('measurement_requests')
      .update({ status, appsheet_status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single()

    if (updateError) {
      logError('Update measurement status error', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    // 이벤트 기록
    const eventType = `status_changed:${status}:appsheet_${appsheet_status}`
    const { error: eventError } = await adminClient.from('measurement_request_events').insert({
      request_id: id,
      actor_id: user.id,
      event_type: eventType,
      memo: memo?.trim() || null,
    })

    if (eventError) {
      logError('Insert measurement event error', eventError)
      return NextResponse.json({ error: 'Event log failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logError('Status update unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
