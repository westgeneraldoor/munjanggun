'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, Eye, FilePlus2, Search, ShieldAlert } from 'lucide-react'
import {
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
import { updateBlogPostStatus } from './[id]/actions'

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

type StatusFilter = 'all' | 'draft' | 'published' | 'archived'

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'draft', label: '초안' },
  { key: 'published', label: '발행' },
  { key: 'archived', label: '보관' },
]

const CATEGORY_LABEL: Record<BlogContentCategory, string> = {
  case_study: '시공사례',
  product_guide: '제품가이드',
  customer_qa: '고객 Q&A',
  field_knowhow: '현장 노하우',
  price_guide: '가격/견적',
  area_guide: '지역안내',
}

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
  return normalize(row.title)
}

function getVisibleStatus(status: BlogPostStatus): Exclude<StatusFilter, 'all'> {
  if (status === 'published') return 'published'
  if (status === 'archived') return 'archived'
  return 'draft'
}

function matchesStatusFilter(row: BlogDraftQueueRow, filter: StatusFilter) {
  if (filter === 'all') return true
  return getVisibleStatus(row.status) === filter
}

function getStatusTone(status: BlogPostStatus): PlatformStatusBadgeTone {
  if (getVisibleStatus(status) === 'draft') return 'review'
  if (getVisibleStatus(status) === 'published') return 'info'
  return 'neutral'
}

export default function BlogDraftQueueClient({
  initialRows,
  loadError,
}: {
  initialRows: BlogDraftQueueRow[]
  loadError: string | null
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [, setActionMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return initialRows
      .filter(row => matchesStatusFilter(row, statusFilter))
      .filter(row => !keyword || getSearchHaystack(row).includes(keyword))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }, [initialRows, search, statusFilter])

  const updateStatus = (next: StatusFilter) => {
    setStatusFilter(next)
  }

  const changeStatus = (id: string, status: 'archived' | 'reviewing', currentStatus: BlogPostStatus) => {
    if (status === 'archived' && !window.confirm(currentStatus === 'published'
      ? '발행 글을 보관하면 현재 공개 URL과 검색 노출이 사라집니다. 글과 자산은 삭제되지 않습니다. 보관할까요?'
      : '글은 삭제되지 않으며 나중에 초안으로 복원할 수 있습니다. 보관할까요?')) return
    startTransition(async () => {
      const result = await updateBlogPostStatus(id, status)
      setActionMessage(result.message)
      if (result.ok) window.location.reload()
    })
  }

  return (
    <div className={styles.page}>
      <PlatformPageHeader
        className={styles.pageHeader}
        title="블로그 콘텐츠 큐"
        description="원고를 찾아 열고, 필요한 내용을 편집합니다."
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
            }}
            placeholder="제목 검색"
            aria-label="콘텐츠 검색"
          />
        </div>

        <PlatformSegmentedControl
          label="상태 필터"
          items={STATUS_TABS.map(tab => ({ value: tab.key, label: tab.label }))}
          value={statusFilter}
          onChange={updateStatus}
        />

      </PlatformPanel>

      <div className={styles.queueLayout}>
        <section className={styles.queueListPanel}>
          <div className={styles.queueSummary}>
            <strong>{filteredRows.length}건</strong>
            <span>제목을 선택하면 바로 에디터로 이동합니다.</span>
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
                      <th>수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => (
                      <tr
                        key={row.id}
                        className={styles.row}
                      >
                        <td className={styles.titleCell}>
                          <Link
                            href={`/admin/platform/blog/${row.id}`}
                            className={styles.titleLink}
                            prefetch={false}
                            aria-label={`${row.title} 에디터 열기`}
                          >
                            <strong>{row.title}</strong>
                          </Link>
                          <div className={styles.rowActions} aria-label={`${row.title} 작업`}>
                            <Link href={`/admin/platform/blog/${row.id}`} aria-label={`${row.title} 편집`}>편집</Link>
                            <Link href={`/admin/platform/blog/${row.id}/preview`} aria-label={`${row.title} 미리보기`}><Eye size={15} aria-hidden="true" />미리보기</Link>
                            {row.status === 'archived'
                              ? <button type="button" onClick={() => changeStatus(row.id, 'reviewing', row.status)} disabled={isPending}><ArchiveRestore size={15} aria-hidden="true" />복원</button>
                              : <button type="button" onClick={() => changeStatus(row.id, 'archived', row.status)} disabled={isPending}><Archive size={15} aria-hidden="true" />보관</button>}
                          </div>
                        </td>
                        <td>
                          <PlatformStatusBadge tone={getStatusTone(row.status)}>
                            {STATUS_TABS.find(tab => tab.key === getVisibleStatus(row.status))?.label}
                          </PlatformStatusBadge>
                        </td>
                        <td>
                          <span className={styles.categoryPill}>{CATEGORY_LABEL[row.category]}</span>
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
                          {STATUS_TABS.find(tab => tab.key === getVisibleStatus(row.status))?.label}
                        </PlatformStatusBadge>
                        <span className={styles.mobileDate}>{formatDateTime(row.updatedAt)}</span>
                      </div>
                      <strong>{row.title}</strong>
                      <span className={styles.mobileCategory}>{CATEGORY_LABEL[row.category]}</span>
                    </Link>
                    <div className={styles.mobileRowActions} aria-label={`${row.title} 작업`}>
                      <Link href={`/admin/platform/blog/${row.id}`} aria-label={`${row.title} 편집`}>편집</Link>
                      <Link href={`/admin/platform/blog/${row.id}/preview`} aria-label={`${row.title} 미리보기`}><Eye size={15} aria-hidden="true" />미리보기</Link>
                      {row.status === 'archived'
                        ? <button type="button" onClick={() => changeStatus(row.id, 'reviewing', row.status)} disabled={isPending}><ArchiveRestore size={15} aria-hidden="true" />복원</button>
                        : <button type="button" onClick={() => changeStatus(row.id, 'archived', row.status)} disabled={isPending}><Archive size={15} aria-hidden="true" />보관</button>}
                    </div>
                  </li>
                ))}
              </PlatformList>
            </>
          )}
        </section>

      </div>
    </div>
  )
}
