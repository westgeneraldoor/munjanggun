import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { CustomerRequestStatus, QueueSourceType, QueueWorkStatus } from '@/types/database'
import { logError } from '@/lib/logger'

type AdminAction = 'complete_new' | 'complete_change' | 'complete_cancel'
type AdminRole = 'sales_manager' | 'administrator'

interface ActionBody {
  sourceType?: QueueSourceType
  requestId?: string
  action?: AdminAction
  memo?: string
}

const TABLE_BY_SOURCE = {
  measurement: 'measurement_requests',
  as: 'as_requests',
} as const

const ACTION_STATUS: Record<AdminAction, {
  customerStatus: CustomerRequestStatus
  queueStatus: QueueWorkStatus
  eventType: string
}> = {
  complete_new: {
    customerStatus: 'confirmed',
    queueStatus: 'new_done',
    eventType: 'admin_new_completed',
  },
  complete_change: {
    customerStatus: 'change_confirmed',
    queueStatus: 'change_done',
    eventType: 'admin_change_completed',
  },
  complete_cancel: {
    customerStatus: 'cancel_confirmed',
    queueStatus: 'cancel_done',
    eventType: 'admin_cancel_completed',
  },
}

function legacyUpdateFor(sourceType: QueueSourceType, action: AdminAction) {
  if (sourceType === 'measurement') {
    if (action === 'complete_cancel') {
      return { status: 'cancelled', appsheet_status: 'skipped' }
    }
    if (action === 'complete_new') {
      return { status: 'appsheet_registered', appsheet_status: 'registered' }
    }
    return { appsheet_status: 'registered' }
  }

  if (action === 'complete_cancel') {
    return { status: 'cancelled' }
  }
  if (action === 'complete_new') {
    return { status: 'reviewing' }
  }
  return {}
}

export async function PATCH(request: NextRequest) {
  const supabase = await createPlatformClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as { role: 'customer' | AdminRole } | null

  if (profileError || !profile || (profile.role !== 'administrator' && profile.role !== 'sales_manager')) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as ActionBody | null
  const sourceType = body?.sourceType
  const requestId = body?.requestId
  const action = body?.action
  const memo = body?.memo?.trim() || null

  if (!sourceType || !requestId || !action || !(sourceType in TABLE_BY_SOURCE) || !(action in ACTION_STATUS)) {
    return NextResponse.json({ error: '요청 정보가 올바르지 않습니다.' }, { status: 400 })
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'platform' } }
  )

  const fetchQuery = sourceType === 'measurement'
    ? adminClient.from('measurement_requests').select('id, customer_status, queue_status').eq('id', requestId).maybeSingle()
    : adminClient.from('as_requests').select('id, customer_status, queue_status').eq('id', requestId).maybeSingle()

  const { data: existing, error: fetchError } = await fetchQuery

  const requestRow = existing as {
    id: string
    customer_status: CustomerRequestStatus
    queue_status: QueueWorkStatus
  } | null

  if (fetchError) {
    logError('Admin queue action fetch error', fetchError)
    return NextResponse.json({ error: '접수 건을 확인하지 못했습니다.' }, { status: 500 })
  }

  if (!requestRow) {
    return NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 })
  }

  const next = ACTION_STATUS[action]
  const now = new Date().toISOString()

  const updatePayload = {
      ...legacyUpdateFor(sourceType, action),
      customer_status: next.customerStatus,
      queue_status: next.queueStatus,
      processed_by: user.id,
      processed_at: now,
      updated_at: now,
    }

  const { error: updateError } = sourceType === 'measurement'
    ? await adminClient
      .from('measurement_requests')
      .update(updatePayload)
      .eq('id', requestId)
    : await adminClient
      .from('as_requests')
      .update(updatePayload)
      .eq('id', requestId)

  if (updateError) {
    logError('Admin queue action update error', updateError)
    return NextResponse.json({ error: '처리 상태를 저장하지 못했습니다.' }, { status: 500 })
  }

  const { error: eventError } = await adminClient.from('request_action_events').insert({
    source_type: sourceType,
    source_id: requestId,
    actor_id: user.id,
    actor_role: profile.role,
    event_type: next.eventType,
    from_customer_status: requestRow.customer_status,
    to_customer_status: next.customerStatus,
    from_queue_status: requestRow.queue_status,
    to_queue_status: next.queueStatus,
    memo,
  })

  if (eventError) {
    logError('Admin queue action event insert error', eventError)
  }

  return NextResponse.json({
    ok: true,
    customerStatus: next.customerStatus,
    queueStatus: next.queueStatus,
  })
}
