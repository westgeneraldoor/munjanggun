'use client'

import { useMemo, useState, useTransition } from 'react'
import { Eye, FilePlus2, Search, ShieldAlert } from 'lucide-react'
import { IntentPrefetchLink } from '@/components/admin/IntentPrefetchLink'
import {
  PlatformLinkButton,
  PlatformList,
  PlatformModal,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSegmentedControl,
  PlatformStatePanel,
  PlatformStatusBadge,
  PlatformTable,
  type PlatformStatusBadgeTone,
} from '@/components/platform/ui'
import type { BlogContentCategory, BlogPostStatus } from '@/types/database'
import styles from './blog-draft-queue.module.css'
import { permanentlyDeleteBlogPost, updateBlogPostStatus } from './[id]/actions'

export type BlogDraftQueueRow = {
  id: string
  title: string
  status: BlogPostStatus
  category: BlogContentCategory
  updatedAt: string
}

type StatusFilter = 'all' | 'draft' | 'published' | 'archived'
type QueueAction =
  | { kind: 'trash'; row: BlogDraftQueueRow }
  | { kind: 'permanent-delete'; row: BlogDraftQueueRow }

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'draft', label: '초안' },
  { key: 'published', label: '발행' },
  { key: 'archived', label: '휴지통' },
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
  const [rows, setRows] = useState(initialRows)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [queueAction, setQueueAction] = useState<QueueAction | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return rows
      .filter(row => matchesStatusFilter(row, statusFilter))
      .filter(row => !keyword || getSearchHaystack(row).includes(keyword))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  }, [rows, search, statusFilter])

  const updateStatus = (next: StatusFilter) => {
    setStatusFilter(next)
  }

  const openQueueAction = (action: QueueAction) => {
    setActionMessage(null)
    setDeleteConfirmation('')
    setQueueAction(action)
  }

  const closeQueueAction = () => {
    if (isPending) return
    setQueueAction(null)
    setDeleteConfirmation('')
  }

  const changeStatus = (row: BlogDraftQueueRow, status: 'archived' | 'reviewing') => {
    setActionMessage(null)
    startTransition(async () => {
      const result = await updateBlogPostStatus(row.id, status)
      setActionMessage({ ok: result.ok, text: result.message })
      if (!result.ok) return

      setRows(current => current.map(item => item.id === row.id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item))
      setQueueAction(null)
      setDeleteConfirmation('')
    })
  }

  const permanentlyDelete = () => {
    if (!queueAction || queueAction.kind !== 'permanent-delete') return
    const { row } = queueAction
    setActionMessage(null)
    startTransition(async () => {
      const result = await permanentlyDeleteBlogPost(row.id, deleteConfirmation)
      setActionMessage({ ok: result.ok, text: result.message })
      if (!result.ok) return

      setRows(current => current.filter(item => item.id !== row.id))
      setQueueAction(null)
      setDeleteConfirmation('')
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

      {actionMessage ? (
        <div
          className={styles.actionMessage}
          data-tone={actionMessage.ok ? 'success' : 'error'}
          role={actionMessage.ok ? 'status' : 'alert'}
        >
          {actionMessage.text}
        </div>
      ) : null}

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
                          <IntentPrefetchLink
                            href={`/admin/platform/blog/${row.id}`}
                            className={styles.titleLink}
                            aria-label={`${row.title} 에디터 열기`}
                          >
                            <strong>{row.title}</strong>
                          </IntentPrefetchLink>
                          <div className={styles.rowActions} aria-label={`${row.title} 작업`}>
                            <IntentPrefetchLink href={`/admin/platform/blog/${row.id}`} aria-label={`${row.title} 편집`}>편집</IntentPrefetchLink>
                            <IntentPrefetchLink href={`/admin/platform/blog/${row.id}/preview`} aria-label={`${row.title} 미리보기`}><Eye size={15} aria-hidden="true" />미리보기</IntentPrefetchLink>
                            {row.status === 'archived'
                              ? <>
                                  <button type="button" onClick={() => changeStatus(row, 'reviewing')} disabled={isPending}>복원</button>
                                  <button type="button" className={styles.dangerAction} onClick={() => openQueueAction({ kind: 'permanent-delete', row })} disabled={isPending}>영구삭제</button>
                                </>
                              : <button type="button" onClick={() => openQueueAction({ kind: 'trash', row })} disabled={isPending}>삭제</button>}
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
                    <IntentPrefetchLink
                      href={`/admin/platform/blog/${row.id}`}
                      className={styles.mobileCardButton}
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
                    </IntentPrefetchLink>
                    <div className={styles.mobileRowActions} aria-label={`${row.title} 작업`}>
                      <IntentPrefetchLink href={`/admin/platform/blog/${row.id}`} aria-label={`${row.title} 편집`}>편집</IntentPrefetchLink>
                      <IntentPrefetchLink href={`/admin/platform/blog/${row.id}/preview`} aria-label={`${row.title} 미리보기`}><Eye size={15} aria-hidden="true" />미리보기</IntentPrefetchLink>
                      {row.status === 'archived'
                        ? <>
                            <button type="button" onClick={() => changeStatus(row, 'reviewing')} disabled={isPending}>복원</button>
                            <button type="button" className={styles.dangerAction} onClick={() => openQueueAction({ kind: 'permanent-delete', row })} disabled={isPending}>영구삭제</button>
                          </>
                        : <button type="button" onClick={() => openQueueAction({ kind: 'trash', row })} disabled={isPending}>삭제</button>}
                    </div>
                  </li>
                ))}
              </PlatformList>
            </>
          )}
        </section>

      </div>

      <PlatformModal
        isOpen={Boolean(queueAction)}
        title={queueAction?.kind === 'permanent-delete' ? '글을 영구삭제할까요?' : '글을 휴지통으로 이동할까요?'}
        description={queueAction?.kind === 'permanent-delete'
          ? '영구삭제한 글은 복원할 수 없습니다.'
          : queueAction?.row.status === 'published'
            ? '발행 글을 삭제하면 현재 공개 URL과 검색 노출이 사라집니다.'
            : '휴지통으로 이동한 글은 나중에 복원할 수 있습니다.'}
        onClose={closeQueueAction}
        closeDisabled={isPending}
        closeOnBackdrop
        showCloseButton
        footer={queueAction?.kind === 'permanent-delete' ? (
          <>
            <button type="button" className={styles.modalButton} onClick={closeQueueAction} disabled={isPending}>취소</button>
            <button
              type="button"
              className={`${styles.modalButton} ${styles.dangerButton}`}
              onClick={permanentlyDelete}
              disabled={isPending || deleteConfirmation.trim() !== queueAction.row.title.trim()}
            >
              {isPending ? '삭제 중' : '영구삭제'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className={styles.modalButton} onClick={closeQueueAction} disabled={isPending}>취소</button>
            <button
              type="button"
              className={`${styles.modalButton} ${styles.dangerButton}`}
              onClick={() => queueAction && changeStatus(queueAction.row, 'archived')}
              disabled={isPending}
            >
              {isPending ? '이동 중' : '휴지통으로 이동'}
            </button>
          </>
        )}
      >
        {queueAction?.kind === 'permanent-delete' ? (
          <label className={styles.confirmationField}>
            <span>확인하려면 글 제목을 그대로 입력하세요.</span>
            <strong>{queueAction.row.title}</strong>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={event => setDeleteConfirmation(event.target.value)}
              disabled={isPending}
              autoComplete="off"
              data-modal-initial-focus
            />
          </label>
        ) : null}
        {actionMessage && !actionMessage.ok ? (
          <p className={styles.modalError} role="alert">{actionMessage.text}</p>
        ) : null}
      </PlatformModal>
    </div>
  )
}
