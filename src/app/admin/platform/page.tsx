import { redirect } from 'next/navigation'
import { createPlatformClient, createPlatformAdminClient } from '@/lib/supabase/platform-server'
import { Database } from '@/types/database'
import AdminQueueClient, { type QueueRow } from './AdminQueueClient'

export const metadata = {
  title: '접수 큐 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

const FALLBACK_CATEGORY_LABEL: Record<string, string> = {
  middle_door: '중문',
  abs_door: 'ABS 도어',
  front_door: '현관문',
  molding_baseboard: '몰딩/걸레받이',
  other: '기타',
}

const ISSUE_LABEL: Record<string, string> = {
  customer_description: 'A/S 내용',
  door_adjustment: '문 여닫힘/수평',
  film_damage: '필름/표면 손상',
  hardware: '손잡이/부속 문제',
  noise: '소음/간섭',
  other: '기타 문의',
}

function getCategoryDisplay(
  row: Database['platform']['Tables']['measurement_requests']['Row'],
  categoryMap: Record<string, string>,
) {
  if (row.interest_categories && row.interest_categories.length > 0) {
    return row.interest_categories.map(key => categoryMap[key] || FALLBACK_CATEGORY_LABEL[key] || key).join(', ')
  }
  return FALLBACK_CATEGORY_LABEL[row.interest_category] || row.interest_category
}

export default async function AdminPlatformPage() {
  const supabase = await createPlatformClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'customer' | 'sales_manager' | 'administrator' } | null

  if (!profile || (profile.role !== 'administrator' && profile.role !== 'sales_manager')) {
    redirect('/portal')
  }

  const adminClient = createPlatformAdminClient()

  const [
    categoriesResult,
    measurementResult,
    asResult,
  ] = await Promise.all([
    adminClient.from('measurement_product_categories').select('key, label'),
    adminClient
      .from('measurement_requests')
      .select('id, customer_name, phone, contact_name, contact_phone, contact_relationship, address, address_detail, message, interest_category, interest_categories, preferred_visit_date, preferred_visit_time_slot, preferred_schedule, service_region, service_region_status, is_manual_address, customer_status, queue_status, customer_action_note, customer_action_requested_at, processed_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(150),
    adminClient
      .from('as_requests')
      .select('id, customer_name, phone, contact_name, contact_phone, contact_relationship, address, address_detail, issue_type, message, customer_status, queue_status, customer_action_note, customer_action_requested_at, processed_at, created_at, updated_at, is_manual_address')
      .order('created_at', { ascending: false })
      .limit(150),
  ])

  const categoryRows = (categoriesResult.data ?? []) as Array<{ key: string; label: string }>
  const categoryMap = categoryRows.reduce<Record<string, string>>((acc, category) => {
    acc[category.key] = category.label
    return acc
  }, {})

  const measurementRows = (measurementResult.data ?? []) as Database['platform']['Tables']['measurement_requests']['Row'][]
  const asRows = (asResult.data ?? []) as Database['platform']['Tables']['as_requests']['Row'][]

  const measurementIds = measurementRows.map(row => row.id)
  const asIds = asRows.map(row => row.id)

  const [measurementMediaResult, asMediaResult] = await Promise.all([
    measurementIds.length > 0
      ? adminClient.from('measurement_media').select('request_id').in('request_id', measurementIds)
      : Promise.resolve({ data: [] }),
    asIds.length > 0
      ? adminClient.from('as_media').select('request_id').in('request_id', asIds)
      : Promise.resolve({ data: [] }),
  ])

  const measurementMedia = ((measurementMediaResult.data ?? []) as Array<{ request_id: string }>).reduce<Record<string, boolean>>((acc, item) => {
    acc[item.request_id] = true
    return acc
  }, {})

  const asMedia = ((asMediaResult.data ?? []) as Array<{ request_id: string }>).reduce<Record<string, boolean>>((acc, item) => {
    acc[item.request_id] = true
    return acc
  }, {})

  const measurementQueueRows: QueueRow[] = measurementRows.map(row => {
    const category = getCategoryDisplay(row, categoryMap)
    return {
      key: `measurement:${row.id}`,
      sourceType: 'measurement',
      id: row.id,
      customerName: row.customer_name,
      phone: row.phone,
      address: row.address,
      summary: category,
      message: row.message,
      receivedAt: row.created_at,
      updatedAt: row.updated_at,
      customerStatus: row.customer_status,
      queueStatus: row.queue_status,
      customerActionNote: row.customer_action_note,
      customerActionRequestedAt: row.customer_action_requested_at,
      processedAt: row.processed_at,
      hasMedia: measurementMedia[row.id] ?? false,
      sourceLabel: '무료실측',
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      contactRelationship: row.contact_relationship,
      extraRows: [
        { label: '희망일', value: row.preferred_visit_date || row.preferred_schedule || '-' },
        { label: '희망 시간대', value: row.preferred_visit_time_slot || '-' },
        { label: '서비스 지역', value: row.service_region || row.service_region_status || '-' },
        { label: '주소 입력', value: row.is_manual_address ? '수동 주소' : '주소 검색' },
      ],
    }
  })

  const asQueueRows: QueueRow[] = asRows.map(row => ({
    key: `as:${row.id}`,
    sourceType: 'as',
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address || '-',
    summary: ISSUE_LABEL[row.issue_type] || 'A/S 내용',
    message: row.message,
    receivedAt: row.created_at,
    updatedAt: row.updated_at,
    customerStatus: row.customer_status,
    queueStatus: row.queue_status,
    customerActionNote: row.customer_action_note,
    customerActionRequestedAt: row.customer_action_requested_at,
    processedAt: row.processed_at,
    hasMedia: asMedia[row.id] ?? false,
    sourceLabel: 'A/S',
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactRelationship: row.contact_relationship,
    extraRows: [
      { label: '상세 주소', value: row.address_detail || '-' },
      { label: '주소 입력', value: row.is_manual_address ? '수동 주소' : '주소 검색' },
    ],
  }))

  return <AdminQueueClient initialRows={[...measurementQueueRows, ...asQueueRows]} />
}
