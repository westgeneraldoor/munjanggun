'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FilePenLine, Search, ShieldAlert } from 'lucide-react'
import type { BlogContentCategory, BlogMediaUsageStatus, BlogPostStatus } from '@/types/database'
import { createBlogAiDraft, type BlogAiDraftConfigView, type CreateBlogAiDraftPayload } from './actions'
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

type StatusFilter = 'all' | BlogPostStatus
type CategoryFilter = 'all' | BlogContentCategory

const STATUS_TABS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'ai_draft', label: 'AI 초안' },
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

const CATEGORY_OPTIONS: Array<{ value: BlogContentCategory; label: string }> = CATEGORY_TABS
  .filter((tab): tab is { key: BlogContentCategory; label: string } => tab.key !== 'all')
  .map(tab => ({ value: tab.key, label: tab.label }))

const DEFAULT_EVIDENCE_JSON = JSON.stringify([
  {
    ref: 'verified-source-id',
    status: 'candidate',
    type: 'field_guidance',
    note: '운영자가 확인한 근거 ID와 상태를 입력하세요. 이 화면이 중앙 문서를 자동 조회하지는 않습니다.',
  },
], null, 2)

const STATUS_LABEL: Record<BlogPostStatus, string> = {
  ai_draft: 'AI 초안',
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
        <span className={`${styles.statusBadge} ${styles[`status_${row.status}`]}`}>
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
  aiDraftConfig,
}: {
  initialRows: BlogDraftQueueRow[]
  loadError: string | null
  aiDraftConfig: BlogAiDraftConfigView
}) {
  const router = useRouter()
  const [isDraftPending, startDraftTransition] = useTransition()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftForm, setDraftForm] = useState<CreateBlogAiDraftPayload>({
    category: 'customer_qa',
    topic: '',
    targetQuestion: '',
    primaryKeyword: '',
    serviceArea: '',
    productType: '',
    writingIntent: '',
    evidenceJson: DEFAULT_EVIDENCE_JSON,
    needsImageSlots: true,
  })
  const [draftMessage, setDraftMessage] = useState<{ ok: boolean; text: string; issues?: string[] } | null>(null)

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return initialRows
      .filter(row => statusFilter === 'all' || row.status === statusFilter)
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

  const updateDraftForm = <Key extends keyof CreateBlogAiDraftPayload>(
    key: Key,
    value: CreateBlogAiDraftPayload[Key],
  ) => {
    setDraftForm(prev => ({ ...prev, [key]: value }))
  }

  const handleCreateAiDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDraftMessage(null)

    startDraftTransition(async () => {
      const result = await createBlogAiDraft(draftForm)
      setDraftMessage({ ok: result.ok, text: result.message, issues: result.issues })
      if (result.ok && result.postId) {
        router.push(`/admin/platform/blog/${result.postId}`)
      }
    })
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>블로그 초안 큐</h1>
          <p className={styles.pageDesc}>
            검수 대상 {needsReviewCount}건과 위험 신호 {riskCount}개를 확인합니다.
          </p>
        </div>
      </header>

      <section className={styles.aiDraftPanel} aria-label="AI 초안 생성">
        <div className={styles.aiDraftHeader}>
          <div>
            <h2>AI 초안 생성</h2>
            <p>운영자가 직접 확인한 근거/출처 ID로 검수용 초안을 만듭니다. 생성 결과는 항상 AI 초안 상태로 저장되며, 발행 전 사람 검수가 필요합니다.</p>
          </div>
          <span className={aiDraftConfig.enabled ? styles.aiReadyBadge : styles.aiDisabledBadge}>
            {aiDraftConfig.enabled ? '사용 가능' : '비활성'}
          </span>
        </div>
        {!aiDraftConfig.enabled && (
          <div className={styles.aiDraftNotice} role="status">
            {aiDraftConfig.reason ?? 'AI 초안 생성 설정이 필요합니다.'}
          </div>
        )}
        <form className={styles.aiDraftForm} onSubmit={handleCreateAiDraft}>
          <label>
            <span>글 유형</span>
            <select
              value={draftForm.category}
              onChange={event => updateDraftForm('category', event.target.value as BlogContentCategory)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
            >
              {CATEGORY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>주제</span>
            <input
              value={draftForm.topic}
              onChange={event => updateDraftForm('topic', event.target.value)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
              placeholder="예: 중문 가격이 집마다 다른 이유"
              required
            />
          </label>
          <label>
            <span>대표 질문</span>
            <input
              value={draftForm.targetQuestion}
              onChange={event => updateDraftForm('targetQuestion', event.target.value)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
              placeholder="예: 중문 가격은 왜 현장마다 달라지나요?"
              required
            />
          </label>
          <label>
            <span>키워드</span>
            <input
              value={draftForm.primaryKeyword}
              onChange={event => updateDraftForm('primaryKeyword', event.target.value)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
              placeholder="예: 중문 가격"
            />
          </label>
          <label>
            <span>지역/현장 변수</span>
            <input
              value={draftForm.serviceArea}
              onChange={event => updateDraftForm('serviceArea', event.target.value)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
              placeholder="예: 화성 동탄, 아파트 현관"
            />
          </label>
          <label>
            <span>상품군</span>
            <input
              value={draftForm.productType}
              onChange={event => updateDraftForm('productType', event.target.value)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
              placeholder="예: 3연동 중문"
            />
          </label>
          <label className={styles.aiDraftWide}>
            <span>작성 의도</span>
            <input
              value={draftForm.writingIntent}
              onChange={event => updateDraftForm('writingIntent', event.target.value)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
              placeholder="예: 가격 단정 없이 견적 변동 기준을 설명"
            />
          </label>
          <label className={styles.aiDraftWide}>
            <span>출처 근거 JSON</span>
            <textarea
              value={draftForm.evidenceJson}
              onChange={event => updateDraftForm('evidenceJson', event.target.value)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
              rows={7}
              spellCheck={false}
              required
            />
          </label>
          <label className={styles.aiDraftCheckbox}>
            <input
              type="checkbox"
              checked={draftForm.needsImageSlots}
              onChange={event => updateDraftForm('needsImageSlots', event.target.checked)}
              disabled={!aiDraftConfig.enabled || isDraftPending}
            />
            <span>본문 사진 슬롯이 필요함</span>
          </label>
          <button type="submit" className={styles.aiDraftButton} disabled={!aiDraftConfig.enabled || isDraftPending}>
            {isDraftPending ? '생성 중' : 'AI 초안 만들기'}
          </button>
        </form>
        {draftMessage && (
          <div className={`${styles.aiDraftMessage} ${draftMessage.ok ? styles.aiDraftMessageOk : styles.aiDraftMessageError}`} role="status">
            <p>{draftMessage.text}</p>
            {draftMessage.issues && draftMessage.issues.length > 0 && (
              <ul>
                {draftMessage.issues.map(issue => <li key={issue}>{issue}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className={styles.filterStack} aria-label="블로그 초안 필터">
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
            aria-label="초안 검색"
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
            <span>초안을 클릭하면 바로 에디터로 이동합니다.</span>
          </div>

          {loadError ? (
            <div className={styles.errorState} role="alert">
              <ShieldAlert size={20} aria-hidden="true" />
              <p>{loadError}</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className={styles.empty}>
              <p>조건에 맞는 초안이 없습니다.</p>
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
                          <span className={`${styles.statusBadge} ${styles[`status_${row.status}`]}`}>
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
                        <span className={`${styles.statusBadge} ${styles[`status_${row.status}`]}`}>
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
