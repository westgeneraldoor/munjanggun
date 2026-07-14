'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FilePenLine, Search, ShieldAlert } from 'lucide-react'
import type { BlogContentCategory, BlogMediaUsageStatus, BlogPostStatus } from '@/types/database'
import styles from './blog-draft-queue.module.css'

export type BlogDraftQueueRow = {
  id: string
  title: string
  slug: string
  status: BlogPostStatus
  category: BlogContentCategory
  targetQuestion: string | null
  primaryKeyword: string | null
  serviceArea: string | null
  productType: string | null
  summaryAnswer: string | null
  seoTitle: string | null
  metaDescription: string | null
  mediaMissingReason: string | null
  mediaSummary: {
    total: number
    byStatus: Record<BlogMediaUsageStatus, number>
    altMissing: boolean
    coverReady: boolean
    approvalGateIncomplete: boolean
    hasCandidate: boolean
    hasApprovedOrPublished: boolean
  }
  updatedAt: string
  createdAt: string
  latestEvent: {
    type: string
    memo: string | null
    createdAt: string
  } | null
  risks: {
    forbiddenExpression: boolean
    evidenceNeeded: boolean
    mediaApprovalNeeded: boolean
    altMissing: boolean
    ctaMissing: boolean
  }
}

type StatusFilter = 'all' | 'needs_review' | Exclude<BlogPostStatus, 'ai_draft'>
type CategoryFilter = 'all' | BlogContentCategory

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'needs_review', label: '검토 필요' },
  { key: 'reviewing', label: '검토중' },
  { key: 'needs_media', label: '사진필요' },
  { key: 'ready', label: '발행대기' },
  { key: 'published', label: '발행완료' },
  { key: 'archived', label: '보관' },
]

const CATEGORY_TABS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'case_study', label: '시공사례' },
  { key: 'product_guide', label: '제품가이드' },
  { key: 'customer_qa', label: '고객 Q&A' },
  { key: 'field_knowhow', label: '현장 노하우' },
  { key: 'price_guide', label: '가격/견적' },
  { key: 'area_guide', label: '지역안내' },
]

const STATUS_LABEL: Record<BlogPostStatus, string> = {
  ai_draft: '검토 필요',
  reviewing: '검토중',
  needs_media: '사진필요',
  ready: '발행대기',
  published: '발행완료',
  archived: '보관',
}

const CATEGORY_LABEL: Record<BlogContentCategory, string> = {
  case_study: '시공사례',
  product_guide: '제품가이드',
  customer_qa: '고객 Q&A',
  field_knowhow: '현장 노하우',
  price_guide: '가격/견적',
  area_guide: '지역안내',
}

const RISK_LABELS: Array<{
  key: keyof BlogDraftQueueRow['risks']
  label: string
  tone: 'danger' | 'warning' | 'info'
}> = [
  { key: 'forbiddenExpression', label: '금지표현', tone: 'danger' },
  { key: 'evidenceNeeded', label: '근거확인', tone: 'warning' },
  { key: 'mediaApprovalNeeded', label: '사진승인필요', tone: 'warning' },
  { key: 'altMissing', label: 'alt누락', tone: 'info' },
  { key: 'ctaMissing', label: 'CTA없음', tone: 'info' },
]

function formatDateTime(value: string) {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  })
  return formatter.format(new Date(value))
}

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase()
}

function getSearchHaystack(row: BlogDraftQueueRow) {
  return [
    row.title,
    row.slug,
    row.targetQuestion,
    row.primaryKeyword,
    row.serviceArea,
    row.productType,
  ].map(normalize).join(' ')
}

function getRiskCount(row: BlogDraftQueueRow) {
  return RISK_LABELS.filter(risk => row.risks[risk.key]).length
}

function matchesStatusFilter(row: BlogDraftQueueRow, filter: StatusFilter) {
  if (filter === 'all') return true
  if (filter === 'needs_review') return row.status === 'ai_draft' || row.status === 'reviewing'
  return row.status === filter
}

function getStatusBadgeClass(status: BlogPostStatus) {
  return status === 'ai_draft' ? styles.status_reviewing : styles[`status_${status}`]
}

function RiskBadges({ row }: { row: BlogDraftQueueRow }) {
  const activeRisks = RISK_LABELS.filter(risk => row.risks[risk.key])

  if (activeRisks.length === 0) {
    return <span className={styles.safeBadge}>위험 없음</span>
  }

  return (
    <div className={styles.riskBadges} aria-label="위험 배지">
      {activeRisks.map(risk => (
        <span key={risk.key} className={`${styles.riskBadge} ${styles[`risk_${risk.tone}`]}`}>
          {risk.label}
        </span>
      ))}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className={styles.infoRow}>
      <dt>{label}</dt>
      <dd>{value?.trim() || '-'}</dd>
    </div>
  )
}

function SummaryPanel({
  row,
  onBack,
}: {
  row: BlogDraftQueueRow
  onBack?: () => void
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
          <span className={styles.categoryPill}>{CATEGORY_LABEL[row.category]}</span>
          <h2>{row.title}</h2>
          <p>{row.slug}</p>
        </div>
        <span className={`${styles.statusBadge} ${getStatusBadgeClass(row.status)}`}>
          {STATUS_LABEL[row.status]}
        </span>
      </div>

      <RiskBadges row={row} />

      <dl className={styles.detailList}>
        <InfoRow label="타깃 질문" value={row.targetQuestion} />
        <InfoRow label="요약 답변" value={row.summaryAnswer} />
        <InfoRow label="핵심 키워드" value={row.primaryKeyword} />
        <InfoRow label="지역/제품군" value={[row.serviceArea, row.productType].filter(Boolean).join(' / ')} />
        <InfoRow label="SEO title" value={row.seoTitle ? '입력됨' : '미입력'} />
        <InfoRow label="Meta" value={row.metaDescription ? '입력됨' : '미입력'} />
        <InfoRow
          label="사진 상태"
          value={`${row.mediaSummary.total}장 · 후보 ${row.mediaSummary.byStatus.candidate} · 승인 ${row.mediaSummary.byStatus.approved} · 공개 ${row.mediaSummary.byStatus.published}`}
        />
        <InfoRow label="대표 사진" value={row.mediaSummary.coverReady ? '준비됨' : row.mediaMissingReason || '확인 필요'} />
        <InfoRow label="최근 이벤트" value={row.latestEvent ? `${row.latestEvent.type} · ${formatDateTime(row.latestEvent.createdAt)}` : '이벤트 없음'} />
        <InfoRow label="수정일" value={formatDateTime(row.updatedAt)} />
      </dl>

      <div className={styles.detailFooter}>
        <Link href={`/admin/platform/blog/${row.id}`} className={styles.editorButton} prefetch={false}>
          <FilePenLine size={16} aria-hidden="true" />
          에디터 열기
        </Link>
        <p>발행과 상태 변경은 이후 server action 검수 게이트에서 처리합니다.</p>
      </div>
    </aside>
  )
}

export default function BlogDraftQueueClient({
  initialRows,
  loadError,
}: {
  initialRows: BlogDraftQueueRow[]
  loadError: string | null
}) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return initialRows
      .filter(row => matchesStatusFilter(row, statusFilter))
      .filter(row => categoryFilter === 'all' || row.category === categoryFilter)
      .filter(row => !keyword || getSearchHaystack(row).includes(keyword))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }, [categoryFilter, initialRows, search, statusFilter])

  const selectedRow = selectedId ? filteredRows.find(row => row.id === selectedId) ?? null : null
  const needsReviewCount = initialRows.filter(row => row.status !== 'published' && row.status !== 'archived').length
  const riskCount = initialRows.reduce((sum, row) => sum + getRiskCount(row), 0)

  const resetSelection = () => setSelectedId(null)

  const openEditor = (row: BlogDraftQueueRow) => {
    router.push(`/admin/platform/blog/${row.id}`)
  }

  const updateStatus = (next: StatusFilter) => {
    setStatusFilter(next)
    resetSelection()
  }

  const updateCategory = (next: CategoryFilter) => {
    setCategoryFilter(next)
    resetSelection()
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>블로그 콘텐츠 큐</h1>
          <p className={styles.pageDesc}>
            승인된 원고의 검수, 사진 연결, 미리보기, 발행 상태를 관리합니다. 검수 대상 {needsReviewCount}건과 위험 신호 {riskCount}개를 확인합니다.
          </p>
        </div>
      </header>
      <section className={styles.filterStack} aria-label="블로그 콘텐츠 필터">
        <div className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              resetSelection()
            }}
            placeholder="제목, slug, 질문, 키워드, 지역, 제품군 검색"
            aria-label="콘텐츠 검색"
          />
        </div>

        <nav className={styles.tabs} aria-label="상태 필터">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateStatus(tab.key)}
              className={`${styles.tab} ${statusFilter === tab.key ? styles.tabActive : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <nav className={styles.tabs} aria-label="카테고리 필터">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => updateCategory(tab.key)}
              className={`${styles.tab} ${categoryFilter === tab.key ? styles.tabActive : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>

      {selectedRow && (
        <div className={styles.mobileDetailScreen}>
          <SummaryPanel row={selectedRow} onBack={() => setSelectedId(null)} />
        </div>
      )}

      <div className={`${styles.queueLayout} ${selectedRow ? styles.queueLayoutSelected : ''}`}>
        <section className={styles.queueListPanel}>
          <div className={styles.queueSummary}>
            <strong>{filteredRows.length}건</strong>
            <span>원고를 클릭하면 바로 에디터로 이동합니다.</span>
          </div>

          {loadError ? (
            <div className={styles.errorState} role="alert">
              <ShieldAlert size={20} aria-hidden="true" />
              <p>{loadError}</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className={styles.empty}>
              <p>조건에 맞는 원고가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>제목</th>
                      <th>상태</th>
                      <th>카테고리</th>
                      <th>질문/키워드</th>
                      <th>지역/제품군</th>
                      <th>위험</th>
                      <th>수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => (
                      <tr
                        key={row.id}
                        className={`${styles.row} ${row.id === selectedId ? styles.rowSelected : ''}`}
                        onClick={() => openEditor(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openEditor(row)
                          }
                        }}
                        aria-label={`${row.title} 에디터 열기`}
                        role="link"
                        tabIndex={0}
                      >
                        <td className={styles.titleCell}>
                          <span className={styles.stackCell}>
                            <strong>{row.title}</strong>
                            <small>{row.slug}</small>
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${getStatusBadgeClass(row.status)}`}>
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                        <td>
                          <span className={styles.categoryPill}>{CATEGORY_LABEL[row.category]}</span>
                        </td>
                        <td className={styles.metaCell}>
                          <span className={styles.stackCell}>
                            <span>{row.targetQuestion || '-'}</span>
                            <small>{row.primaryKeyword || '-'}</small>
                          </span>
                        </td>
                        <td className={styles.metaCell}>
                          <span className={styles.stackCell}>
                            <span>{row.serviceArea || '-'}</span>
                            <small>{row.productType || '-'}</small>
                          </span>
                        </td>
                        <td className={styles.riskCell}>
                          <RiskBadges row={row} />
                        </td>
                        <td className={styles.dateCell}>{formatDateTime(row.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={styles.mobileList}>
                {filteredRows.map(row => (
                  <li key={row.id} className={styles.mobileCard}>
                    <Link
                      href={`/admin/platform/blog/${row.id}`}
                      className={styles.mobileCardButton}
                      prefetch={false}
                      aria-label={`${row.title} 에디터 열기`}
                    >
                      <div className={styles.mobileCardTop}>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(row.status)}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                        <span className={styles.mobileDate}>{formatDateTime(row.updatedAt)}</span>
                      </div>
                      <strong>{row.title}</strong>
                      <span className={styles.mobileSlug}>{row.slug}</span>
                      <span className={styles.mobileQuestion}>{row.targetQuestion || '타깃 질문 없음'}</span>
                      <div className={styles.mobileMeta}>
                        <span>{CATEGORY_LABEL[row.category]}</span>
                        <span>{row.primaryKeyword || '키워드 없음'}</span>
                        <span>{row.serviceArea || '지역 없음'}</span>
                        <span>{row.productType || '제품군 없음'}</span>
                      </div>
                      <RiskBadges row={row} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {selectedRow && (
          <div className={styles.desktopDetail}>
            <SummaryPanel row={selectedRow} />
          </div>
        )}
      </div>
    </div>
  )
}
