import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowDownAZ, ArrowUpAZ, Settings } from 'lucide-react'
import { createPlatformClient, createPlatformAdminClient } from '@/lib/supabase/platform-server'
import { CustomerRequestStatus, QueueSourceType, QueueWorkStatus, Database } from '@/types/database'
import UnifiedQueueActions from './UnifiedQueueActions'
import styles from './platform-admin.module.css'

export const metadata = {
  title: '접수 큐 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

type SortKey = 'receivedAt' | 'customerName' | 'sourceType' | 'queueStatus' | 'customerStatus'
type SortDir = 'asc' | 'desc'

interface QueueRow {
  key: string
  sourceType: QueueSourceType
  id: string
  customerName: string
  phone: string
  address: string
  summary: string
  message: string
  receivedAt: string
  updatedAt: string
  customerStatus: CustomerRequestStatus
  queueStatus: QueueWorkStatus
  customerActionNote: string | null
  customerActionRequestedAt: string | null
  processedAt: string | null
  hasMedia: boolean
  sourceLabel: string
  contactName: string | null
  contactPhone: string | null
  contactRelationship: string | null
  extraRows: Array<{ label: string; value: string }>
}

const QUEUE_STATUS_LABEL: Record<QueueWorkStatus, string> = {
  new_received: '신규접수',
  new_done: '접수완료',
  change_received: '수정접수',
  change_done: '수정완료',
  cancel_received: '취소접수',
  cancel_done: '취소완료',
}

const CUSTOMER_STATUS_LABEL: Record<CustomerRequestStatus, string> = {
  confirmation_pending: '확정대기',
  confirmed: '접수확정',
  change_pending: '수정대기',
  change_confirmed: '수정확정',
  cancel_pending: '취소대기',
  cancel_confirmed: '취소확정',
}

const FALLBACK_CATEGORY_LABEL: Record<string, string> = {
  middle_door: '중문',
  abs_door: 'ABS 도어',
  front_door: '현관문',
  molding_baseboard: '몰딩/걸레받이',
  other: '기타',
}

const ISSUE_LABEL: Record<string, string> = {
  door_adjustment: '문 여닫힘/수평',
  film_damage: '필름/표면 손상',
  hardware: '손잡이/부속 문제',
  noise: '소음/간섭',
  other: '기타 문의',
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFullDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(value: string, length = 26) {
  return value.length > length ? `${value.slice(0, length)}...` : value
}

function hrefFor(params: Record<string, string | undefined>) {
  const next = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'all') next.set(key, value)
  })
  const query = next.toString()
  return query ? `/admin/platform?${query}` : '/admin/platform'
}

function sortRows(rows: QueueRow[], sort: SortKey, dir: SortDir) {
  const direction = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = a[sort]
    const right = b[sort]
    return String(left).localeCompare(String(right), 'ko-KR') * direction
  })
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

function QueueDetail({ row }: { row: QueueRow | null }) {
  if (!row) {
    return (
      <aside className={styles.detailPanel}>
        <div className={styles.detailEmpty}>선택된 접수 건이 없습니다.</div>
      </aside>
    )
  }

  return (
    <aside className={styles.detailPanel}>
      <div className={styles.detailTop}>
        <div>
          <span className={styles.sourcePill}>{row.sourceLabel}</span>
          <h2>{row.customerName}</h2>
          <p>{row.phone}</p>
        </div>
        <span className={`${styles.queueBadge} ${styles[`q_${row.queueStatus}`]}`}>
          {QUEUE_STATUS_LABEL[row.queueStatus]}
        </span>
      </div>

      <div className={styles.detailStatusRow}>
        <span>{CUSTOMER_STATUS_LABEL[row.customerStatus]}</span>
        <span>접수 {formatDateTime(row.receivedAt)}</span>
      </div>

      <dl className={styles.detailList}>
        <div>
          <dt>주소</dt>
          <dd>{row.address || '-'}</dd>
        </div>
        <div>
          <dt>요약</dt>
          <dd>{row.summary}</dd>
        </div>
        <div>
          <dt>내용</dt>
          <dd>{row.message || '-'}</dd>
        </div>
        <div>
          <dt>연락받을 분</dt>
          <dd>
            {row.contactName ? `${row.contactName} / ${row.contactPhone || '-'} / ${row.contactRelationship || '-'}` : '접수자 본인'}
          </dd>
        </div>
        {row.extraRows.map(item => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value || '-'}</dd>
          </div>
        ))}
        <div>
          <dt>고객 요청 메모</dt>
          <dd>{row.customerActionNote || '-'}</dd>
        </div>
        <div>
          <dt>요청 시각</dt>
          <dd>{formatFullDateTime(row.customerActionRequestedAt)}</dd>
        </div>
        <div>
          <dt>처리 시각</dt>
          <dd>{formatFullDateTime(row.processedAt)}</dd>
        </div>
      </dl>

      <div className={styles.detailFooter}>
        <UnifiedQueueActions sourceType={row.sourceType} requestId={row.id} queueStatus={row.queueStatus} />
      </div>
    </aside>
  )
}

export default async function AdminPlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; queue?: string; sort?: string; dir?: string; selected?: string }>
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
  const typeFilter = params.type === 'measurement' || params.type === 'as' ? params.type : 'all'
  const queueFilter = params.queue && params.queue in QUEUE_STATUS_LABEL ? params.queue as QueueWorkStatus : 'all'
  const sort = ['receivedAt', 'customerName', 'sourceType', 'queueStatus', 'customerStatus'].includes(params.sort ?? '')
    ? params.sort as SortKey
    : 'receivedAt'
  const dir: SortDir = params.dir === 'asc' ? 'asc' : 'desc'

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
    summary: ISSUE_LABEL[row.issue_type] || row.issue_type,
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

  const filtered = [...measurementQueueRows, ...asQueueRows]
    .filter(row => typeFilter === 'all' || row.sourceType === typeFilter)
    .filter(row => queueFilter === 'all' || row.queueStatus === queueFilter)

  const rows = sortRows(filtered, sort, dir)
  const selectedKey = params.selected && rows.some(row => row.key === params.selected)
    ? params.selected
    : rows[0]?.key
  const selectedRow = rows.find(row => row.key === selectedKey) ?? null

  const sourceTabs = [
    { key: 'all', label: '전체', href: hrefFor({ type: 'all', queue: queueFilter, sort, dir }) },
    { key: 'measurement', label: '무료실측', href: hrefFor({ type: 'measurement', queue: queueFilter, sort, dir }) },
    { key: 'as', label: 'A/S', href: hrefFor({ type: 'as', queue: queueFilter, sort, dir }) },
  ]

  const queueTabs = [
    { key: 'all', label: '전체', href: hrefFor({ type: typeFilter, queue: 'all', sort, dir }) },
    ...Object.entries(QUEUE_STATUS_LABEL).map(([key, label]) => ({
      key,
      label,
      href: hrefFor({ type: typeFilter, queue: key, sort, dir }),
    })),
  ]

  const sortHref = (nextSort: SortKey) => hrefFor({
    type: typeFilter,
    queue: queueFilter,
    sort: nextSort,
    dir: sort === nextSort && dir === 'desc' ? 'asc' : 'desc',
    selected: selectedKey,
  })

  const sortIcon = (key: SortKey) => {
    if (sort !== key) return null
    return dir === 'asc' ? <ArrowUpAZ size={13} aria-hidden="true" /> : <ArrowDownAZ size={13} aria-hidden="true" />
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleRow}>
          <div>
            <h1 className={styles.pageTitle}>통합 접수 큐</h1>
            <p className={styles.pageDesc}>무료방문 실측, A/S, 수정/취소 요청을 한곳에서 처리합니다.</p>
          </div>
          <Link href="/admin/platform/settings" className={styles.settingsBtn}>
            <Settings size={15} strokeWidth={1.8} />
            운영 설정
          </Link>
        </div>
      </div>

      <div className={styles.filterStack}>
        <nav className={styles.tabs} aria-label="접수 종류">
          {sourceTabs.map(tab => (
            <Link key={tab.key} href={tab.href} className={`${styles.tab} ${typeFilter === tab.key ? styles.tabActive : ''}`}>
              {tab.label}
            </Link>
          ))}
        </nav>
        <nav className={styles.tabs} aria-label="처리 상태">
          {queueTabs.map(tab => (
            <Link key={tab.key} href={tab.href} className={`${styles.tab} ${queueFilter === tab.key ? styles.tabActive : ''}`}>
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p>해당 조건의 접수 건이 없습니다.</p>
        </div>
      ) : (
        <div className={styles.queueLayout}>
          <section className={styles.queueListPanel}>
            <div className={styles.queueSummary}>
              <strong>{rows.length}건</strong>
              <span>목록 행을 누르면 상세가 바뀝니다.</span>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th><Link href={sortHref('receivedAt')}>접수일시 {sortIcon('receivedAt')}</Link></th>
                    <th><Link href={sortHref('sourceType')}>종류 {sortIcon('sourceType')}</Link></th>
                    <th><Link href={sortHref('customerName')}>고객/연락처 {sortIcon('customerName')}</Link></th>
                    <th>주소/요약</th>
                    <th><Link href={sortHref('queueStatus')}>상태 {sortIcon('queueStatus')}</Link></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const rowHref = hrefFor({ type: typeFilter, queue: queueFilter, sort, dir, selected: row.key })
                    return (
                    <tr key={row.key} className={`${styles.row} ${row.key === selectedKey ? styles.rowSelected : ''}`}>
                      <td className={styles.cellDate}>
                        <Link href={rowHref} className={styles.cellLink}>
                          {formatDateTime(row.receivedAt)}
                        </Link>
                      </td>
                      <td><Link href={rowHref} className={styles.cellLink}><span className={styles.sourcePill}>{row.sourceLabel}</span></Link></td>
                      <td className={styles.cellName}>
                        <Link href={rowHref} className={styles.cellLink}>
                          <span className={styles.stackCell}>
                            <strong>{row.customerName}</strong>
                            <small>{row.phone}</small>
                          </span>
                        </Link>
                      </td>
                      <td className={styles.cellAddress} title={`${row.address} / ${row.summary}`}>
                        <Link href={rowHref} className={styles.cellLink}>
                          <span className={styles.stackCell}>
                            <span>{truncate(row.address, 34)}</span>
                            <small>
                              {truncate(row.summary, 24)}
                              {row.hasMedia ? ' · 첨부 있음' : ''}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Link href={rowHref} className={styles.cellLink}>
                          <span className={styles.stackCell}>
                            <span className={`${styles.queueBadge} ${styles[`q_${row.queueStatus}`]}`}>
                              {QUEUE_STATUS_LABEL[row.queueStatus]}
                            </span>
                            <small>{CUSTOMER_STATUS_LABEL[row.customerStatus]}</small>
                          </span>
                        </Link>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className={styles.mobileList}>
              {rows.map(row => (
                <li key={row.key} className={`${styles.mobileCard} ${row.key === selectedKey ? styles.mobileCardSelected : ''}`}>
                  <Link href={hrefFor({ type: typeFilter, queue: queueFilter, sort, dir, selected: row.key })} className={styles.mobileCardLink}>
                    <div className={styles.mobileCardTop}>
                      <span className={`${styles.queueBadge} ${styles[`q_${row.queueStatus}`]}`}>
                        {QUEUE_STATUS_LABEL[row.queueStatus]}
                      </span>
                      <span className={styles.mobileDate}>{formatDateTime(row.receivedAt)}</span>
                    </div>
                    <div className={styles.mobileCardName}>{row.sourceLabel} / {row.customerName} / {row.phone}</div>
                    <div className={styles.mobileCardAddress}>{row.address}</div>
                    <div className={styles.mobileCardMeta}>
                      <span>{row.summary}</span>
                      <span>{CUSTOMER_STATUS_LABEL[row.customerStatus]}</span>
                      <span>첨부: {row.hasMedia ? '있음' : '없음'}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <QueueDetail row={selectedRow} />
        </div>
      )}
    </div>
  )
}
