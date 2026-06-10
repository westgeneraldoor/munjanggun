'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDownAZ, ArrowLeft, ArrowUpAZ, Settings } from 'lucide-react'
import { CustomerRequestStatus, QueueSourceType, QueueWorkStatus } from '@/types/database'
import UnifiedQueueActions from './UnifiedQueueActions'
import styles from './platform-admin.module.css'

export type QueueRow = {
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

type TypeFilter = 'all' | QueueSourceType | 'payment'
type WorkFilter = 'all' | 'needs' | 'done'
type SortKey = 'receivedAt' | 'customerName' | 'sourceType' | 'queueStatus' | 'customerStatus'
type SortDir = 'asc' | 'desc'

const TYPE_TABS: Array<{ key: TypeFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'measurement', label: '무료실측' },
  { key: 'as', label: 'A/S' },
  { key: 'payment', label: '결제' },
]

const WORK_TABS: Array<{ key: WorkFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'needs', label: '확인필요' },
  { key: 'done', label: '확인완료' },
]

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

const NEEDS_STATUSES = new Set<QueueWorkStatus>(['new_received', 'change_received', 'cancel_received'])

function formatDateTime(value: string) {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour24 = date.getUTCHours()
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const period = hour24 < 12 ? '오전' : '오후'
  const hour12 = hour24 % 12 || 12
  return `${month}. ${day}. ${period} ${String(hour12).padStart(2, '0')}:${minute}`
}

function formatFullDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour24 = date.getUTCHours()
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const period = hour24 < 12 ? '오전' : '오후'
  const hour12 = hour24 % 12 || 12
  return `${year}년 ${month}월 ${day}일 ${period} ${String(hour12).padStart(2, '0')}:${minute}`
}

function truncate(value: string, length = 28) {
  return value.length > length ? `${value.slice(0, length)}...` : value
}

function sortRows(rows: QueueRow[], sort: SortKey, dir: SortDir) {
  const direction = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = a[sort]
    const right = b[sort]
    return String(left).localeCompare(String(right), 'ko-KR') * direction
  })
}

function isWorkMatch(row: QueueRow, filter: WorkFilter) {
  if (filter === 'all') return true
  const needsWork = NEEDS_STATUSES.has(row.queueStatus)
  return filter === 'needs' ? needsWork : !needsWork
}

function DetailPanel({
  row,
  onBack,
  onCompleted,
}: {
  row: QueueRow
  onBack?: () => void
  onCompleted: (key: string, next: { customerStatus: CustomerRequestStatus; queueStatus: QueueWorkStatus }) => void
}) {
  return (
    <aside className={styles.detailPanel}>
      {onBack && (
        <button type="button" className={styles.mobileBackButton} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          목록
        </button>
      )}
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
        <UnifiedQueueActions
          sourceType={row.sourceType}
          requestId={row.id}
          queueStatus={row.queueStatus}
          onCompleted={(next) => onCompleted(row.key, {
            customerStatus: next.customerStatus as CustomerRequestStatus,
            queueStatus: next.queueStatus,
          })}
        />
      </div>
    </aside>
  )
}

export default function AdminQueueClient({ initialRows }: { initialRows: QueueRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [workFilter, setWorkFilter] = useState<WorkFilter>('needs')
  const [sort, setSort] = useState<SortKey>('receivedAt')
  const [dir, setDir] = useState<SortDir>('desc')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const filteredRows = useMemo(() => {
    const filtered = rows
      .filter(row => typeFilter === 'all' || row.sourceType === typeFilter)
      .filter(row => isWorkMatch(row, workFilter))
    return sortRows(filtered, sort, dir)
  }, [dir, rows, sort, typeFilter, workFilter])

  const selectedRow = selectedKey ? filteredRows.find(row => row.key === selectedKey) ?? null : null
  const needsCount = rows.filter(row => isWorkMatch(row, 'needs')).length

  const updateSort = (nextSort: SortKey) => {
    if (sort === nextSort) {
      setDir(prev => (prev === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSort(nextSort)
    setDir('desc')
  }

  const selectRow = (key: string) => {
    setSelectedKey(prev => (prev === key ? null : key))
  }

  const updateTypeFilter = (next: TypeFilter) => {
    setTypeFilter(next)
    setSelectedKey(null)
  }

  const updateWorkFilter = (next: WorkFilter) => {
    setWorkFilter(next)
    setSelectedKey(null)
  }

  const handleCompleted = (key: string, next: { customerStatus: CustomerRequestStatus; queueStatus: QueueWorkStatus }) => {
    setRows(prev => prev.map(row => row.key === key
      ? {
        ...row,
        customerStatus: next.customerStatus,
        queueStatus: next.queueStatus,
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      : row
    ))
  }

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
            <p className={styles.pageDesc}>확인필요 {needsCount}건을 빠르게 확인하고 처리합니다.</p>
          </div>
          <Link href="/admin/platform/settings" className={styles.settingsBtn}>
            <Settings size={15} strokeWidth={1.8} />
            견적 설정
          </Link>
        </div>
      </div>

      <div className={styles.filterStack}>
        <nav className={styles.tabs} aria-label="접수 종류">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateTypeFilter(tab.key)}
              className={`${styles.tab} ${typeFilter === tab.key ? styles.tabActive : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <nav className={styles.tabs} aria-label="확인 상태">
          {WORK_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateWorkFilter(tab.key)}
              className={`${styles.tab} ${workFilter === tab.key ? styles.tabActive : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {selectedRow && (
        <div className={styles.mobileDetailScreen}>
          <DetailPanel row={selectedRow} onBack={() => setSelectedKey(null)} onCompleted={handleCompleted} />
        </div>
      )}

      <div className={`${styles.queueLayout} ${selectedRow ? styles.queueLayoutSelected : ''}`}>
        <section className={styles.queueListPanel}>
          <div className={styles.queueSummary}>
            <strong>{filteredRows.length}건</strong>
            <span>{workFilter === 'needs' ? '확인이 필요한 접수만 보고 있습니다.' : '목록 행을 누르면 상세가 열립니다.'}</span>
          </div>

          {filteredRows.length === 0 ? (
            <div className={styles.empty}>
              <p>해당 조건의 접수 건이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th><button type="button" onClick={() => updateSort('receivedAt')}>접수일시 {sortIcon('receivedAt')}</button></th>
                      <th><button type="button" onClick={() => updateSort('sourceType')}>종류 {sortIcon('sourceType')}</button></th>
                      <th><button type="button" onClick={() => updateSort('customerName')}>고객/연락처 {sortIcon('customerName')}</button></th>
                      <th>주소/요약</th>
                      <th><button type="button" onClick={() => updateSort('queueStatus')}>상태 {sortIcon('queueStatus')}</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => (
                      <tr
                        key={row.key}
                        className={`${styles.row} ${row.key === selectedKey ? styles.rowSelected : ''}`}
                        onClick={() => selectRow(row.key)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            selectRow(row.key)
                          }
                        }}
                        tabIndex={0}
                      >
                        <td className={styles.cellDate}>{formatDateTime(row.receivedAt)}</td>
                        <td><span className={styles.sourcePill}>{row.sourceLabel}</span></td>
                        <td className={styles.cellName}>
                          <span className={styles.stackCell}>
                            <strong>{row.customerName}</strong>
                            <small>{row.phone}</small>
                          </span>
                        </td>
                        <td className={styles.cellAddress} title={`${row.address} / ${row.summary}`}>
                          <span className={styles.stackCell}>
                            <span>{truncate(row.address, 34)}</span>
                            <small>
                              {truncate(row.summary, 24)}
                              {row.hasMedia ? ' · 첨부 있음' : ''}
                            </small>
                          </span>
                        </td>
                        <td>
                          <span className={styles.stackCell}>
                            <span className={`${styles.queueBadge} ${styles[`q_${row.queueStatus}`]}`}>
                              {QUEUE_STATUS_LABEL[row.queueStatus]}
                            </span>
                            <small>{CUSTOMER_STATUS_LABEL[row.customerStatus]}</small>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.mobileList}>
                {filteredRows.map(row => (
                  <li key={row.key} className={styles.mobileCard}>
                    <button type="button" onClick={() => selectRow(row.key)} className={styles.mobileCardLink}>
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
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {selectedRow && (
          <div className={styles.desktopDetail}>
            <DetailPanel row={selectedRow} onCompleted={handleCompleted} />
          </div>
        )}
      </div>
    </div>
  )
}
