import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { CustomerRequestStatus, QueueSourceType, QueueWorkStatus } from '@/types/database'
import { logError } from '@/lib/logger'

type CustomerAction = 'change' | 'cancel'

interface ActionBody {
  sourceType?: QueueSourceType
  requestId?: string
  action?: CustomerAction
  memo?: string
}

const TABLE_BY_SOURCE = {
  measurement: 'measurement_requests',
  as: 'as_requests',
} as const

const ACTION_STATUS: Record<CustomerAction, {
  customerStatus: CustomerRequestStatus
  queueStatus: QueueWorkStatus
  eventType: string
}> = {
  change: {
    customerStatus: 'change_pending',
    queueStatus: 'change_received',
    eventType: 'customer_change_requested',
  },
  cancel: {
    customerStatus: 'cancel_pending',
    queueStatus: 'cancel_received',
    eventType: 'customer_cancel_requested',
  },
}

export async function POST(request: NextRequest) {
  const supabase = await createPlatformClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
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
  const tableName = TABLE_BY_SOURCE[sourceType]

  const { data: existing, error: fetchError } = await adminClient
    .from(tableName)
    .select('id, customer_id, customer_status, queue_status')
    .eq('id', requestId)
    .maybeSingle()

  const requestRow = existing as {
    id: string
    customer_id: string
    customer_status: CustomerRequestStatus
    queue_status: QueueWorkStatus
  } | null

  if (fetchError) {
    logError('Customer action fetch error', fetchError)
    return NextResponse.json({ error: '접수 건을 확인하지 못했습니다.' }, { status: 500 })
  }

  if (!requestRow || requestRow.customer_id !== user.id) {
    return NextResponse.json({ error: '접수 건을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (requestRow.customer_status === 'cancel_confirmed') {
    return NextResponse.json({ error: '이미 취소 확정된 접수입니다.' }, { status: 409 })
  }

  const next = ACTION_STATUS[action]
  const now = new Date().toISOString()

  const { error: updateError } = await adminClient
    .from(tableName)
    .update({
      customer_status: next.customerStatus,
      queue_status: next.queueStatus,
      customer_action_note: memo,
      customer_action_requested_at: now,
      updated_at: now,
    })
    .eq('id', requestId)

  if (updateError) {
    logError('Customer action update error', updateError)
    return NextResponse.json({ error: '요청을 저장하지 못했습니다.' }, { status: 500 })
  }

  const { error: eventError } = await adminClient.from('request_action_events').insert({
    source_type: sourceType,
    source_id: requestId,
    actor_id: user.id,
    actor_role: 'customer',
    event_type: next.eventType,
    from_customer_status: requestRow.customer_status,
    to_customer_status: next.customerStatus,
    from_queue_status: requestRow.queue_status,
    to_queue_status: next.queueStatus,
    memo,
  })

  if (eventError) {
    logError('Customer action event insert error', eventError)
  }

  return NextResponse.json({
    ok: true,
    customerStatus: next.customerStatus,
    queueStatus: next.queueStatus,
  })
}
