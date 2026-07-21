'use client'

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FilePenLine, FilePlus2, Search, ShieldAlert } from 'lucide-react'
import {
  PlatformButton,
  PlatformLinkButton,
  PlatformList,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSegmentedControl,
  PlatformStatePanel,
  PlatformStatusBadge,
  PlatformTable,
  type PlatformStatusBadgeTone,
} from '@/components/platform/ui'
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

function getStatusTone(status: BlogPostStatus): PlatformStatusBadgeTone {
  if (status === 'ai_draft' || status === 'reviewing') return 'review'
  if (status === 'needs_media') return 'danger'
  if (status === 'ready') return 'success'
  if (status === 'published') return 'info'
  return 'neutral'
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
    <PlatformPanel as="aside" className={styles.detailPanel}>
      {onBack && (
        <PlatformButton type="button" variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          목록
        </PlatformButton>
      )}

      <div className={styles.detailTop}>
        <div>
          <span className={styles.categoryPill}>{CATEGORY_LABEL[row.category]}</span>
          <h2>{row.title}</h2>
          <p>{row.slug}</p>
        </div>
        <PlatformStatusBadge tone={getStatusTone(row.status)}>
          {STATUS_LABEL[row.status]}
        </PlatformStatusBadge>
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
        <PlatformLinkButton href={`/admin/platform/blog/${row.id}`} fullWidth prefetch={false}>
          <FilePenLine size={16} aria-hidden="true" />
          에디터 열기
        </PlatformLinkButton>
        <p>발행과 상태 변경은 이후 server action 검수 게이트에서 처리합니다.</p>
      </div>
    </PlatformPanel>
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

  const handleRowClick = (event: ReactMouseEvent<HTMLTableRowElement>, row: BlogDraftQueueRow) => {
    if (event.target instanceof Element && event.target.closest('a,button,input,select,textarea')) return
    openEditor(row)
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
      <PlatformPageHeader
        className={styles.pageHeader}
        title="블로그 콘텐츠 큐"
        description={`승인된 원고의 검수, 사진 연결, 미리보기, 발행 상태를 관리합니다. 검수 대상 ${needsReviewCount}건과 위험 신호 ${riskCount}개를 확인합니다.`}
        actions={(
          <PlatformLinkButton href="/admin/platform/blog/new">
            <FilePlus2 size={16} aria-hidden="true" />
            승인 원고 등록
          </PlatformLinkButton>
        )}
      />
      <PlatformPanel as="section" variant="subtle" className={styles.filterStack} aria-label="블로그 콘텐츠 필터">
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

        <PlatformSegmentedControl
          label="상태 필터"
          items={STATUS_TABS.map(tab => ({ value: tab.key, label: tab.label }))}
          value={statusFilter}
          onChange={updateStatus}
        />

        <PlatformSegmentedControl
          label="카테고리 필터"
          items={CATEGORY_TABS.map(tab => ({ value: tab.key, label: tab.label }))}
          value={categoryFilter}
          onChange={updateCategory}
        />
      </PlatformPanel>

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
            <PlatformStatePanel
              tone="error"
              title="콘텐츠 목록을 불러오지 못했습니다."
              description={loadError}
              icon={<ShieldAlert size={20} />}
            />
          ) : filteredRows.length === 0 ? (
            <PlatformStatePanel
              title="조건에 맞는 원고가 없습니다."
              description="검색어 또는 필터를 바꿔 다시 확인해 주세요."
            />
          ) : (
            <>
              <PlatformTable
                containerClassName={styles.desktopTable}
                className={styles.queueTable}
                layout="fixed"
                aria-label="블로그 콘텐츠 목록"
              >
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
                        onClick={(event) => handleRowClick(event, row)}
                      >
                        <td className={styles.titleCell}>
                          <Link
                            href={`/admin/platform/blog/${row.id}`}
                            className={styles.titleLink}
                            prefetch={false}
                            aria-label={`${row.title} 에디터 열기`}
                          >
                            <span className={styles.stackCell}>
                              <strong>{row.title}</strong>
                              <small>{row.slug}</small>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <PlatformStatusBadge tone={getStatusTone(row.status)}>
                            {STATUS_LABEL[row.status]}
                          </PlatformStatusBadge>
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
              </PlatformTable>

              <PlatformList className={styles.mobileList} aria-label="블로그 콘텐츠 모바일 목록">
                {filteredRows.map(row => (
                  <li key={row.id} className={styles.mobileCard}>
                    <Link
                      href={`/admin/platform/blog/${row.id}`}
                      className={styles.mobileCardButton}
                      prefetch={false}
                      aria-label={`${row.title} 에디터 열기`}
                    >
                      <div className={styles.mobileCardTop}>
                        <PlatformStatusBadge tone={getStatusTone(row.status)}>
                          {STATUS_LABEL[row.status]}
                        </PlatformStatusBadge>
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
              </PlatformList>
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
