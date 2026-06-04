import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import AdminQueueActions from './AdminQueueActions'
import styles from './platform-admin.module.css'

export const metadata = {
  title: '접수 큐 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  submitted: '신규',
  appsheet_pending: '신규',
  appsheet_registered: '접수완료',
  contacted: '접수완료',
  assigned: '접수완료',
  scheduled: '접수완료',
  measured: '접수완료',
  cancelled: '취소',
}

const FALLBACK_CATEGORY_LABEL: Record<string, string> = {
  middle_door: '중문',
  abs_door: 'ABS 도어',
  front_door: '현관문',
  molding_baseboard: '몰딩/걸레받이',
  other: '기타',
}

type MeasurementRow = {
  id: string
  customer_name: string
  phone: string
  address: string
  status: string
  appsheet_status: string
  interest_category: string
  interest_categories: string[] | null
  preferred_visit_date: string | null
  preferred_schedule: string | null
  is_manual_address: boolean
  created_at: string
  _has_media: boolean
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminPlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
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

  const params = await searchParams
  const filterStatus = params.status ?? 'all'

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'platform' } }
  )

  const { data: categoriesData } = await adminClient
    .from('measurement_product_categories')
    .select('key, label')

  const categoryMap = (categoriesData ?? []).reduce<Record<string, string>>((acc, category) => {
    acc[category.key] = category.label
    return acc
  }, {})

  let query = adminClient
    .from('measurement_requests')
    .select('id, customer_name, phone, address, status, appsheet_status, interest_category, interest_categories, preferred_visit_date, preferred_schedule, is_manual_address, created_at')
    .order('created_at', { ascending: false })

  if (filterStatus === 'submitted') {
    query = query.in('status', ['submitted', 'appsheet_pending'])
  } else if (filterStatus === 'appsheet_registered') {
    query = query.in('status', ['appsheet_registered', 'contacted', 'assigned', 'scheduled', 'measured'])
  } else if (filterStatus === 'cancelled') {
    query = query.eq('status', 'cancelled')
  }

  type RequestRow = Database['platform']['Tables']['measurement_requests']['Row']
  type MediaRow = Database['platform']['Tables']['measurement_media']['Row']

  const { data: requests } = await query
  const requestsData = (requests ?? []) as RequestRow[]
  const requestIds = requestsData.map(row => row.id)
  let mediaMap: Record<string, boolean> = {}

  if (requestIds.length > 0) {
    const { data: mediaItems } = await adminClient
      .from('measurement_media')
      .select('request_id')
      .in('request_id', requestIds)
    const typedMedia = (mediaItems ?? []) as Pick<MediaRow, 'request_id'>[]
    mediaMap = typedMedia.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.request_id] = true
      return acc
    }, {})
  }

  const rows: MeasurementRow[] = requestsData.map(row => ({
    ...row,
    _has_media: mediaMap[row.id] ?? false,
  }))

  const tabs = [
    { key: 'all', label: '전체', href: '/admin/platform' },
    { key: 'submitted', label: '신규', href: '/admin/platform?status=submitted' },
    { key: 'appsheet_registered', label: '접수완료', href: '/admin/platform?status=appsheet_registered' },
    { key: 'cancelled', label: '취소', href: '/admin/platform?status=cancelled' },
  ]

  const getCategoryDisplay = (row: MeasurementRow) => {
    if (row.interest_categories && row.interest_categories.length > 0) {
      return row.interest_categories.map(key => categoryMap[key] || FALLBACK_CATEGORY_LABEL[key] || key).join(', ')
    }
    return FALLBACK_CATEGORY_LABEL[row.interest_category] || row.interest_category
  }

  const getScheduleDisplay = (row: MeasurementRow) => row.preferred_visit_date || row.preferred_schedule || '-'

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleRow}>
          <div>
            <h1 className={styles.pageTitle}>접수 큐</h1>
            <p className={styles.pageDesc}>무료방문 실측 견적상담 신청 목록</p>
          </div>
          <Link href="/admin/platform/settings" className={styles.settingsBtn}>
            <Settings size={15} strokeWidth={1.8} />
            운영 설정
          </Link>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(tab => (
          <Link key={tab.key} href={tab.href} className={`${styles.tab} ${filterStatus === tab.key ? styles.tabActive : ''}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p>해당 상태의 접수 건이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>접수일시</th>
                  <th>고객명</th>
                  <th>연락처</th>
                  <th>주소</th>
                  <th>관심 품목</th>
                  <th>희망 방문일</th>
                  <th>상태</th>
                  <th>첨부</th>
                  <th>처리</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className={styles.row}>
                    <td className={styles.cellDate}>{formatDateTime(row.created_at)}</td>
                    <td className={styles.cellName}><strong>{row.customer_name}</strong></td>
                    <td className={styles.cellPhone}>{row.phone}</td>
                    <td className={styles.cellAddress} title={row.address}>
                      <div className={styles.addressCellContent}>
                        <span>{row.address.length > 24 ? `${row.address.slice(0, 24)}...` : row.address}</span>
                        {row.is_manual_address && <span className={styles.manualBadge}>수동 주소 검토 필요</span>}
                      </div>
                    </td>
                    <td className={styles.cellCategory} title={getCategoryDisplay(row)}>{getCategoryDisplay(row)}</td>
                    <td className={styles.cellSchedule}>{getScheduleDisplay(row)}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[`s_${row.status}`]}`}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className={styles.cellMedia}>{row._has_media ? '있음' : '-'}</td>
                    <td><AdminQueueActions requestId={row.id} currentStatus={row.status} /></td>
                    <td>
                      <Link href={`/admin/platform/${row.id}`} className={styles.detailLink} id={`link-detail-${row.id.slice(0, 8)}`}>
                        보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.mobileList}>
            {rows.map(row => (
              <li key={row.id} className={styles.mobileCard}>
                <div className={styles.mobileCardTop}>
                  <span className={`${styles.statusBadge} ${styles[`s_${row.status}`]}`}>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </span>
                  <span className={styles.mobileDate}>{formatDateTime(row.created_at)}</span>
                </div>
                <div className={styles.mobileCardName}>{row.customer_name} / {row.phone}</div>
                <div className={styles.mobileCardAddress}>{row.address}</div>
                {row.is_manual_address && <span className={styles.mobileManualBadge}>수동 주소 검토 필요</span>}
                <div className={styles.mobileCardMeta}>
                  <span>품목: {getCategoryDisplay(row)}</span>
                  <span>희망 방문일: {getScheduleDisplay(row)}</span>
                  <span>첨부: {row._has_media ? '있음' : '없음'}</span>
                </div>
                <div className={styles.mobileActions}>
                  <AdminQueueActions requestId={row.id} currentStatus={row.status} />
                  <Link href={`/admin/platform/${row.id}`} className={styles.mobileDetailLink}>상세 보기</Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
