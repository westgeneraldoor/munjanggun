'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ComponentProps,
  type FormEvent,
  type RefObject,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Eye,
  FileText,
  Image as ImageIcon,
  Images,
  Info,
  Link2,
  Plus,
  Rocket,
  Save,
  Search,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import BlogPostRenderer from '@/components/blog/BlogPostRenderer'
import { PlatformCheckbox } from '@/components/platform/ui/PlatformCheckbox'
import { PlatformChip } from '@/components/platform/ui/PlatformChip'
import { PlatformModal } from '@/components/platform/ui/PlatformModal'
import { PlatformPreviewFrame } from '@/components/platform/ui/PlatformPreviewFrame'
import { PlatformStatePanel } from '@/components/platform/ui/PlatformStatePanel'
import { PlatformStatusBadge, type PlatformStatusBadgeTone } from '@/components/platform/ui/PlatformStatusBadge'
import { PlatformTabPanel } from '@/components/platform/ui/PlatformTabPanel'
import { PlatformTabs } from '@/components/platform/ui/PlatformTabs'
import type {
  BlogBlockType,
  BlogContentCategory,
  BlogMediaSourceType,
  BlogMediaUsageStatus,
  BlogPostStatus,
  BlogQuestionStatus,
} from '@/types/database'
import { buildBlogEditorPreviewData, createStableEditorSignature } from '@/lib/content-os/blog-editor-preview'
import {
  attachContentAssetToBlogMedia,
  publishBlogEditor,
  saveBlogEditor,
  updateBlogPostStatus,
  updateBlogMedia,
  type ContentAssetBlogMedia,
  type SaveBlogEditorPayload,
} from './actions'
import { uploadContentAssets, type UploadContentAssetsResult } from '../../assets/actions'
import styles from './blog-editor.module.css'

export type BlogEditorPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  status: BlogPostStatus
  category: BlogContentCategory
  seoTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  primaryKeyword: string | null
  targetQuestion: string | null
  summaryAnswer: string | null
  relatedQuestions: string[]
  serviceArea: string | null
  productType: string | null
  aiCitationReady: boolean
  mediaMissingReason: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  gateSummary: {
    brandCheck: {
      hasResult: boolean
      forbiddenExpression: boolean
      warningCount: number
    }
    blockCount: number
    ctaCount: number
    imageSlotCount: number
    mediaTotal: number
    mediaStatusCount: Record<BlogMediaUsageStatus, number>
    coverReady: boolean
    publicAltMissing: boolean
    mediaConsentMissing: boolean
  }
}

export type BlogEditorBlock = {
  id: string
  type: BlogBlockType
  headingLevel: number | null
  text: string | null
  mediaId: string | null
  metadata: Record<string, string>
  displayOrder: number
}

export type BlogEditorMedia = {
  id: string
  sourceType: BlogMediaSourceType
  sourceLabel: string | null
  usageStatus: BlogMediaUsageStatus
  altText: string | null
  caption: string | null
  privacyChecked: boolean
  promotionConsentChecked: boolean
  usedAsCover: boolean
  publicUrl: string | null
  signedPreviewUrl: string | null
  hasPrivateObject: boolean
  hasPublicObject: boolean
  approvedAt: string | null
  publishedAt: string | null
  rejectionReason: string | null
  createdAt: string
}

type ContentAssetFileSummary = {
  url: string | null
  width: number | null
  height: number | null
  ready: boolean
} | null

export type ContentAssetPickerItem = {
  id: string
  title: string | null
  description: string | null
  category: string | null
  tags: string[]
  productType: string | null
  spaceType: string | null
  region: string | null
  usagePurpose: string | null
  privacyChecked: boolean
  promotionConsentChecked: boolean
  createdAt: string
  updatedAt: string
  thumbnail: ContentAssetFileSummary
  web: ContentAssetFileSummary
}

export type BlogEditorEvent = {
  id: string
  type: string
  fromStatus: BlogPostStatus | null
  toStatus: BlogPostStatus | null
  memo: string | null
  createdAt: string
}

export type BlogEditorQuestion = {
  id: string
  postId: string | null
  postSlug: string
  postTitleSnapshot: string
  questionBody: string
  status: BlogQuestionStatus
  adminNote: string | null
  approvedQuestion: string | null
  approvedAnswer: string | null
  publishedBlockId: string | null
  publishedAt: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

type EditablePost = Omit<BlogEditorPost, 'gateSummary' | 'publishedAt' | 'createdAt' | 'updatedAt'>
type EditableBlock = BlogEditorBlock & { clientId: string }
type AssetPickerTarget =
  | { type: 'new' }
  | { type: 'cover' }
  | { type: 'replace'; clientId: string }
  | { type: 'insertBefore'; clientId: string }
type EditorMode = 'write' | 'seo'

export type PublishedRelatedPostOption = {
  id: string
  title: string
  slug: string
}

const EDITOR_MODE_TABS: ReadonlyArray<{ value: EditorMode; label: string }> = [
  { value: 'write', label: '작성란' },
  { value: 'seo', label: 'SEO/AEO' },
]
type PickerUploadItem = {
  id: string
  file: File
  previewUrl: string
  title: string
  description: string
}

const MAX_UPLOAD_TOTAL_BYTES = 120 * 1024 * 1024
const CATEGORY_OPTIONS: Array<{ value: BlogContentCategory; label: string }> = [
  { value: 'case_study', label: '시공사례' },
  { value: 'product_guide', label: '제품가이드' },
  { value: 'customer_qa', label: '고객 Q&A' },
  { value: 'field_knowhow', label: '현장 노하우' },
  { value: 'price_guide', label: '가격/견적' },
  { value: 'area_guide', label: '지역안내' },
]

const STATUS_LABEL: Record<BlogPostStatus, string> = {
  ai_draft: '초안',
  reviewing: '초안',
  needs_media: '초안',
  ready: '초안',
  published: '발행',
  archived: '휴지통',
}

function getPostStatusTone(status: BlogPostStatus): PlatformStatusBadgeTone {
  if (status === 'published') return 'info'
  if (status === 'archived') return 'neutral'
  return 'review'
}

const QUESTION_STATUS_LABEL: Record<BlogQuestionStatus, string> = {
  private: '비공개',
  pending_review: '검토중',
  approved: '승인됨',
  rejected: '반려',
  archived: '보관',
}

function getQuestionStatusTone(status: BlogQuestionStatus): PlatformStatusBadgeTone {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  if (status === 'archived') return 'neutral'
  return 'review'
}

const BLOCK_LABEL: Partial<Record<BlogBlockType, string>> = {
  heading: '제목',
  paragraph: '문단',
  image: '사진',
  link_button: '링크 버튼',
  guide_box: '안내 박스',
  qa: 'Q&A',
  cta: '상담 CTA',
}

const NEW_BLOCK_LABEL: Record<Extract<BlogBlockType, 'quote' | 'video' | 'related_post' | 'place' | 'quiz' | 'checklist'>, string> = {
  quote: '인용구',
  video: '영상',
  related_post: '관련 글',
  place: '장소/지도',
  quiz: '퀴즈',
  checklist: '체크리스트',
}

function emptyToNull(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function fallbackPhotoName(index: number) {
  return `사진 ${index + 1}`
}

function fileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || fileName
}

function displayAssetTitle(item: Pick<ContentAssetPickerItem, 'title' | 'description'>, index = 0) {
  const title = item.title?.trim() ?? ''
  if (title) return title
  return item.description?.trim() || fallbackPhotoName(index)
}

function uploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`
  return `${(value / (1024 * 1024)).toFixed(1)}MB`
}

function formatAssetDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

function EditorStateMessage({
  ok,
  text,
  issues,
}: {
  ok: boolean
  text: string
  issues?: string[]
}) {
  return (
    <PlatformStatePanel
      className={styles.editorStateMessage}
      tone={ok ? 'success' : 'error'}
      title={text}
      details={issues && issues.length > 0 ? (
        <ul className={styles.publishIssues}>
          {issues.map(issue => <li key={issue}>{issue}</li>)}
        </ul>
      ) : undefined}
    />
  )
}

function createBlock(type: BlogBlockType, options: { mediaId?: string | null; photoSlotLabel?: string } = {}): EditableBlock {
  const clientId = `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const base = {
    id: '',
    clientId,
    type,
    headingLevel: type === 'heading' ? 2 : null,
    text: '',
    mediaId: options.mediaId ?? null,
    metadata: {},
    displayOrder: 0,
  }

  if (type === 'qa') {
    return { ...base, metadata: { answer: '' } }
  }

  if (type === 'cta') {
    return { ...base, text: '무료방문 실측견적 상담', metadata: { cta_kind: 'measurement_consult' } }
  }

  if (type === 'link_button') {
    return { ...base, text: '관련 글 보기', metadata: { href: '/blog', description: '함께 보면 좋은 글로 이어집니다.' } }
  }

  if (type === 'guide_box') {
    return {
      ...base,
      text: '현장 구조에 따라 달라질 수 있어 실측 때 함께 확인합니다.',
      metadata: { title: '확인해보세요', tone: 'guide' },
    }
  }

  if (type === 'image') {
    return { ...base, metadata: { photo_slot_label: options.photoSlotLabel ?? '', required_media: '' } }
  }

  if (type === 'quote') return { ...base, text: '', metadata: { attribution: '', source_url: '' } }
  if (type === 'video') return { ...base, metadata: { youtube_url: '', title: '' } }
  if (type === 'related_post') return { ...base, metadata: { related_post_id: '' } }
  if (type === 'place') return { ...base, text: '', metadata: { place_url: '' } }
  if (type === 'quiz') return { ...base, text: '', metadata: { answer: '', explanation: '' } }
  if (type === 'checklist') return { ...base, metadata: { title: '', items: '' } }

  return base
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function ReaderQuestionPanel({
  questions,
  queuedQuestionIds,
  onChange,
  onUseAsQa,
}: {
  questions: BlogEditorQuestion[]
  queuedQuestionIds: Set<string>
  onChange: (id: string, patch: Partial<Pick<BlogEditorQuestion, 'approvedQuestion' | 'approvedAnswer' | 'adminNote'>>) => void
  onUseAsQa: (question: BlogEditorQuestion) => void
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>
        <Info size={17} aria-hidden="true" />
        <h2>독자 질문</h2>
      </div>
      <p className={styles.panelHelp}>고객이 남긴 비공개 질문입니다. 공개할 때는 공개용 질문과 답변을 새로 정리해서 Q&A 블록으로 넣어주세요.</p>
      {questions.length === 0 ? (
        <div className={styles.emptyBlocks}>아직 이 글에 연결된 독자 질문이 없습니다.</div>
      ) : (
        <div className={styles.readerQuestionList}>
          {questions.map(question => {
            const approvedQuestion = question.approvedQuestion ?? ''
            const approvedAnswer = question.approvedAnswer ?? ''
            const canUse = approvedQuestion.trim().length >= 2 && approvedAnswer.trim().length >= 2
            const alreadyPublished = Boolean(question.publishedBlockId)
            const alreadyQueued = queuedQuestionIds.has(question.id)

            return (
              <article key={question.id} className={styles.readerQuestionCard}>
                <div className={styles.readerQuestionHeader}>
                  <PlatformStatusBadge tone={getQuestionStatusTone(question.status)}>
                    {QUESTION_STATUS_LABEL[question.status]}
                  </PlatformStatusBadge>
                  <time dateTime={question.createdAt}>{formatDateTime(question.createdAt)}</time>
                </div>
                <details className={styles.readerQuestionOriginal}>
                  <summary>비공개 원문 보기</summary>
                  <p>{question.questionBody}</p>
                </details>
                <div className={styles.readerQuestionFields}>
                  <Field label="공개용 질문">
                    <input
                      value={approvedQuestion}
                      onChange={event => onChange(question.id, { approvedQuestion: event.target.value })}
                      disabled={alreadyPublished}
                      maxLength={240}
                    />
                  </Field>
                  <Field label="공개용 답변">
                    <textarea
                      value={approvedAnswer}
                      onChange={event => onChange(question.id, { approvedAnswer: event.target.value })}
                      disabled={alreadyPublished}
                      maxLength={2000}
                      rows={4}
                    />
                  </Field>
                </div>
                <div className={styles.readerQuestionActions}>
                  <button type="button" onClick={() => onUseAsQa(question)} disabled={!canUse || alreadyPublished || alreadyQueued}>
                    <Plus size={15} aria-hidden="true" />
                    {alreadyPublished ? '이미 반영됨' : alreadyQueued ? '추가됨' : 'Q&A 블록으로 넣기'}
                  </button>
                  {question.reviewedAt && <span>검토 {formatDateTime(question.reviewedAt)}</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function GateItem({
  ok,
  label,
  detail,
  onJump,
}: {
  ok: boolean
  label: string
  detail?: string
  onJump: () => void
}) {
  const statusLabel = ok ? 'OK' : 'NG'
  const help = detail ? `${label}: ${detail}` : `${label}: ${statusLabel}`

  return (
    <li className={`${styles.gateItem} ${ok ? styles.gateOk : styles.gateWarn}`}>
      <button type="button" onClick={onJump} title={help} aria-label={`${label} ${statusLabel}. ${detail ?? '누르면 해당 위치로 이동합니다.'}`}>
        {ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
        <span>{label}</span>
      </button>
    </li>
  )
}

function assetImageUrl(item: ContentAssetPickerItem) {
  return item.thumbnail?.url ?? item.web?.url ?? null
}

function searchableAssetText(item: ContentAssetPickerItem) {
  return [
    item.title,
    item.description,
    item.category,
    item.productType,
    item.spaceType,
    item.region,
    item.usagePurpose,
    ...item.tags,
  ].filter(Boolean).join(' ').toLowerCase()
}

function isAssetUsable(item: ContentAssetPickerItem) {
  return Boolean(assetImageUrl(item))
}

function toEditorMediaFromAttached(media: ContentAssetBlogMedia): BlogEditorMedia {
  return {
    id: media.id,
    sourceType: 'showroom_asset',
    sourceLabel: media.sourceLabel,
    usageStatus: media.usageStatus,
    altText: media.altText,
    caption: media.caption,
    privacyChecked: media.privacyChecked,
    promotionConsentChecked: media.promotionConsentChecked,
    usedAsCover: media.usedAsCover,
    publicUrl: null,
    signedPreviewUrl: media.previewUrl,
    hasPrivateObject: true,
    hasPublicObject: false,
    approvedAt: media.approvedAt,
    publishedAt: null,
    rejectionReason: null,
    createdAt: media.createdAt,
  }
}

function ContentAssetPicker({
  open,
  items,
  pending,
  message,
  multiple,
  onClose,
  onSelect,
  onUploaded,
}: {
  open: boolean
  items: ContentAssetPickerItem[]
  pending: boolean
  message: { ok: boolean; text: string } | null
  multiple: boolean
  onClose: () => void
  onSelect: (assets: ContentAssetPickerItem[]) => void
  onUploaded: () => void
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [uploadOpen, setUploadOpen] = useState(items.length === 0)
  const [uploadItems, setUploadItems] = useState<PickerUploadItem[]>([])
  const uploadItemsRef = useRef<PickerUploadItem[]>([])
  const [uploadResult, setUploadResult] = useState<UploadContentAssetsResult | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [promotionConsentChecked, setPromotionConsentChecked] = useState(false)
  const [isUploadPending, startUploadTransition] = useTransition()
  const totalUploadBytes = uploadItems.reduce((sum, item) => sum + item.file.size, 0)
  const isUploadOverLimit = totalUploadBytes > MAX_UPLOAD_TOTAL_BYTES

  const categories = useMemo(() => {
    return [...new Set(items.map(item => item.category).filter((value): value is string => Boolean(value)))]
      .sort((a, b) => a.localeCompare(b, 'ko-KR'))
  }, [items])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter(item => {
      if (category && item.category !== category) return false
      if (query && !searchableAssetText(item).includes(query)) return false
      return true
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [category, items, search])

  const selectedItems = selectedIds
    .map(id => items.find(item => item.id === id))
    .filter((item): item is ContentAssetPickerItem => Boolean(item))
  const selectedReady = selectedItems.length > 0 && selectedItems.every(isAssetUsable)

  useEffect(() => {
    uploadItemsRef.current = uploadItems
  }, [uploadItems])

  useEffect(() => {
    return () => {
      uploadItemsRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  useEffect(() => {
    if (!isUploadPending) return

    const timer = window.setInterval(() => {
      setUploadProgress(current => Math.min(92, current + Math.max(2, Math.round((92 - current) / 7))))
    }, 450)

    return () => window.clearInterval(timer)
  }, [isUploadPending])

  function toggleAsset(item: ContentAssetPickerItem) {
    setSelectedIds(current => {
      if (!multiple) return [item.id]
      if (current.includes(item.id)) return current.filter(id => id !== item.id)
      return [...current, item.id]
    })
  }

  function handleUploadFiles(event: ChangeEvent<HTMLInputElement>) {
    setUploadItems(current => {
      current.forEach(item => URL.revokeObjectURL(item.previewUrl))
      return Array.from(event.target.files ?? []).map(file => ({
        id: uploadId(file),
        file,
        previewUrl: URL.createObjectURL(file),
        title: fileTitle(file.name),
        description: '',
      }))
    })
    setUploadResult(null)
    setUploadProgress(0)
  }

  function updateUploadItem(id: string, patch: Partial<Pick<PickerUploadItem, 'title' | 'description'>>) {
    setUploadItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function handlePickerUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('fileMeta', JSON.stringify(uploadItems.map(item => ({
      name: item.file.name,
      size: item.file.size,
      lastModified: item.file.lastModified,
      title: item.title,
      description: item.description,
    }))))
    setUploadProgress(8)

    startUploadTransition(async () => {
      const result = await uploadContentAssets(formData)
      setUploadProgress(100)
      setUploadResult(result)
      if (result.ok) {
        uploadItems.forEach(item => URL.revokeObjectURL(item.previewUrl))
        setUploadItems([])
        setPrivacyChecked(false)
        setPromotionConsentChecked(false)
        form.reset()
        onUploaded()
        setUploadOpen(false)
      }
    })
  }

  if (!open) return null

  return (
    <PlatformModal
      isOpen={open}
      title="본문에 넣을 사진 선택"
      onClose={onClose}
      size="wide"
      showCloseButton
      closeLabel="사진보관함 닫기"
      closeDisabled={pending || isUploadPending}
      className={styles.assetPickerModal}
    >
      <div className={styles.assetPickerContent}>
        <button
          type="button"
          className={styles.assetPickerUploadToggle}
          onClick={() => setUploadOpen(current => !current)}
          data-modal-initial-focus
        >
          <Plus size={15} aria-hidden="true" />
          {uploadOpen ? '사진 추가 닫기' : '이 글에서 바로 사진 추가'}
        </button>

        {uploadOpen ? (
          <form className={styles.assetPickerUpload} onSubmit={handlePickerUpload}>
            <label className={styles.assetPickerDrop}>
              <UploadCloud size={20} aria-hidden="true" />
              <span>여러 장 선택</span>
              <small>사진을 고르면 바로 미리보기가 보입니다.</small>
              <input
                type="file"
                name="files"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                multiple
                onChange={handleUploadFiles}
                disabled={isUploadPending}
              />
            </label>
            {uploadItems.length > 0 ? (
              <>
                <div className={isUploadOverLimit ? styles.assetUploadLimitWarn : styles.assetUploadLimit}>
                  선택한 사진 {uploadItems.length}장, 합계 {formatBytes(totalUploadBytes)}
                </div>
                <ul className={styles.assetUploadPreviewGrid}>
                  {uploadItems.map(item => (
                    <li key={item.id}>
                      <div className={styles.assetUploadPreviewThumb}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.previewUrl} alt={item.title} />
                      </div>
                      <label>
                        사진 이름
                        <input value={item.title} onChange={event => updateUploadItem(item.id, { title: event.target.value })} />
                      </label>
                      <label>
                        짧은 설명
                        <textarea value={item.description} onChange={event => updateUploadItem(item.id, { description: event.target.value })} rows={2} />
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <fieldset className={styles.assetUploadReview}>
              <legend>사진 사용 전 확인</legend>
              <PlatformCheckbox
                name="privacyChecked"
                checked={privacyChecked}
                onChange={event => setPrivacyChecked(event.target.checked)}
                disabled={isUploadPending}
              >
                고객 정보·주소·연락처 등 민감정보가 보이지 않는지 확인했습니다.
              </PlatformCheckbox>
              <PlatformCheckbox
                name="promotionConsentChecked"
                checked={promotionConsentChecked}
                onChange={event => setPromotionConsentChecked(event.target.checked)}
                disabled={isUploadPending}
              >
                블로그·홍보용으로 사용할 수 있는 사진인지 확인했습니다.
              </PlatformCheckbox>
            </fieldset>
            {isUploadPending || uploadProgress > 0 ? (
              <div className={styles.assetUploadProgress} role="status" aria-live="polite">
                <div>
                  <strong>{isUploadPending ? '사진을 정리하고 있습니다' : '사진 정리 완료'}</strong>
                  <span>{uploadProgress}%</span>
                </div>
                <span className={styles.progressTrack}><span className={styles.progressFill} style={{ width: `${uploadProgress}%` }} /></span>
              </div>
            ) : null}
            {uploadResult ? (
              <EditorStateMessage ok={uploadResult.ok} text={uploadResult.message} />
            ) : null}
            <button type="submit" className={styles.primaryButton} disabled={isUploadPending || uploadItems.length === 0 || isUploadOverLimit || !privacyChecked || !promotionConsentChecked}>
              {isUploadPending ? '사진 보관 중' : '사진 보관'}
            </button>
          </form>
        ) : null}

        <div className={styles.assetPickerTools}>
          <label className={styles.assetSearch}>
            <Search size={16} aria-hidden="true" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="사진명, 설명, 태그 검색"
            />
          </label>
          <label className={styles.assetFilter}>
            <span>분류</span>
            <select value={category} onChange={event => setCategory(event.target.value)}>
              <option value="">전체</option>
              {categories.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        {items.length === 0 ? (
          <div className={styles.assetPickerEmpty}>
            <Images size={24} aria-hidden="true" />
            <strong>아직 고를 사진이 없습니다.</strong>
            <span>위의 “이 글에서 바로 사진 추가”를 눌러 이 화면에서 사진을 올려주세요.</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className={styles.assetPickerEmpty}>
            <Search size={24} aria-hidden="true" />
            <strong>조건에 맞는 사진이 없습니다.</strong>
            <span>검색어를 줄이거나 분류를 바꿔보세요.</span>
          </div>
        ) : (
          <div className={styles.assetPickerGrid}>
            {filteredItems.map((item, index) => {
              const imageUrl = assetImageUrl(item)
              const selected = selectedIds.includes(item.id)
              const ready = isAssetUsable(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.assetPickerCard} ${selected ? styles.assetPickerCardSelected : ''}`}
                  onClick={() => toggleAsset(item)}
                  aria-pressed={selected}
                >
                  <div className={styles.assetPickerThumb}>
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={displayAssetTitle(item, index)} />
                    ) : (
                      <ImageIcon size={24} aria-hidden="true" />
                    )}
                    {selected ? (
                      <PlatformChip tone="selected" className={styles.assetPickerSelectionChip} aria-hidden="true">
                        선택
                      </PlatformChip>
                    ) : null}
                  </div>
                  <div className={styles.assetPickerCardBody}>
                    <strong>{displayAssetTitle(item, index)}</strong>
                    <span className={styles.assetPickerDescription}>{item.description || '설명을 추가해 주세요.'}</span>
                    <time dateTime={item.createdAt}>{formatAssetDateTime(item.createdAt)}</time>
                    <div className={styles.assetPickerBadges}>
                      {item.category ? <PlatformChip>{item.category}</PlatformChip> : null}
                      <PlatformStatusBadge tone={ready ? 'success' : 'warning'}>
                        {ready ? '사용 가능' : '정보 필요'}
                      </PlatformStatusBadge>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {message ? (
          <EditorStateMessage ok={message.ok} text={message.text} />
        ) : null}

        <div className={styles.assetPickerFooter}>
          <div>
            {selectedItems.length > 0 ? (
              <>
                <strong>선택한 사진 {selectedItems.length}장</strong>
                <span>{selectedReady ? '본문에 이미지 카드로 넣습니다.' : '선택한 사진 중 바로 사용할 수 없는 사진이 있습니다.'}</span>
              </>
            ) : (
              <span>{multiple ? '본문에 넣을 사진을 여러 장 선택하세요.' : '교체할 사진 1장을 선택하세요.'}</span>
            )}
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={selectedItems.length === 0 || !selectedReady || pending}
            onClick={() => onSelect(selectedItems)}
          >
            {pending ? '사진을 넣고 있습니다' : multiple ? `${selectedItems.length}장 본문에 넣기` : '본문에 넣기'}
          </button>
        </div>
      </div>
    </PlatformModal>
  )
}

function ImageBlockDetails({
  postId,
  media,
  disabled,
  onChanged,
}: {
  postId: string
  media: BlogEditorMedia
  disabled: boolean
  onChanged: (next: BlogEditorMedia) => void
}) {
  const [isPending, startTransition] = useTransition()
  const savedCaption = media.caption?.trim() ?? ''
  const [captionMode, setCaptionMode] = useState<'saved' | 'custom' | 'none'>(savedCaption ? 'saved' : 'none')
  const [customCaption, setCustomCaption] = useState(savedCaption)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const isDisabled = disabled || isPending

  const saveMedia = () => {
    setMessage(null)
    startTransition(async () => {
      const nextCaption = captionMode === 'saved' ? savedCaption : captionMode === 'custom' ? customCaption : ''
      const nextAltText = nextCaption.trim() || media.altText?.trim() || media.sourceLabel?.trim() || '문장군 현장 사진'
      const result = await updateBlogMedia({
        postId,
        mediaId: media.id,
        altText: nextAltText,
        caption: nextCaption,
        sourceLabel: media.sourceLabel ?? '',
        privacyChecked: media.privacyChecked,
        promotionConsentChecked: media.promotionConsentChecked,
        usedAsCover: media.usedAsCover,
        usageStatus: media.usageStatus,
        rejectionReason: media.rejectionReason,
      })
      setMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        onChanged({
          ...media,
          altText: emptyToNull(nextAltText),
          caption: emptyToNull(nextCaption),
        })
      }
    })
  }

  return (
    <div className={styles.imageCaptionControl}>
      <span className={styles.captionControlTitle}>사진 설명</span>
      <div className={styles.captionChoiceGroup}>
        <label className={styles.captionChoice}>
          <input
            type="radio"
            name={`caption-${media.id}`}
            checked={captionMode === 'saved'}
            onChange={() => setCaptionMode('saved')}
            disabled={isDisabled || !savedCaption}
          />
          <span>
            <strong>기존 설명 사용</strong>
            <small>{savedCaption || '등록된 설명이 없습니다.'}</small>
          </span>
        </label>
        <label className={styles.captionChoice}>
          <input
            type="radio"
            name={`caption-${media.id}`}
            checked={captionMode === 'custom'}
            onChange={() => setCaptionMode('custom')}
            disabled={isDisabled}
          />
          <span>
            <strong>이 글에서만 새 설명 쓰기</strong>
            <small>사진 아래에 노출할 문장을 직접 씁니다.</small>
          </span>
        </label>
        {captionMode === 'custom' && (
          <textarea
            className={styles.captionTextarea}
            value={customCaption}
            onChange={event => setCustomCaption(event.target.value)}
            disabled={isDisabled}
            rows={3}
            placeholder="예: 현관 폭과 신발장 간섭을 함께 확인한 사진"
          />
        )}
        <label className={styles.captionChoice}>
          <input
            type="radio"
            name={`caption-${media.id}`}
            checked={captionMode === 'none'}
            onChange={() => setCaptionMode('none')}
            disabled={isDisabled}
          />
          <span>
            <strong>설명 없이 사진만</strong>
            <small>본문에는 사진만 표시합니다.</small>
          </span>
        </label>
      </div>
      <button type="button" className={styles.secondaryButton} onClick={saveMedia} disabled={isDisabled}>
        <Save size={15} aria-hidden="true" />
        설명 적용
      </button>
      {message && (
        <EditorStateMessage ok={message.ok} text={message.text} />
      )}
    </div>
  )
}

function BlockEditor({
  block,
  postId,
  media,
  index,
  total,
  disabled,
  onChange,
  onInsertImageBefore,
  onPickImage,
  onMediaChanged,
  onMove,
  onRemove,
  publishedRelatedPosts,
}: {
  block: EditableBlock
  postId: string
  media: BlogEditorMedia[]
  index: number
  total: number
  disabled: boolean
  onChange: (next: EditableBlock) => void
  onInsertImageBefore: () => void
  onPickImage: () => void
  onMediaChanged: (next: BlogEditorMedia) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  publishedRelatedPosts: PublishedRelatedPostOption[]
}) {
  const selectedMedia = block.mediaId ? media.find(item => item.id === block.mediaId) ?? null : null
  const selectedImageUrl = selectedMedia?.signedPreviewUrl ?? selectedMedia?.publicUrl ?? null

  const updateMetadata = (key: string, value: string) => {
    onChange({
      ...block,
      metadata: {
        ...block.metadata,
        [key]: value,
      },
    })
  }

  return (
    <article className={`${styles.blockCard} ${styles[`blockCard_${block.type}`]}`} data-block-type={block.type} data-block-client-id={block.clientId}>
      <div className={styles.blockTop}>
        <div className={styles.blockIdentity}>
          <PlatformChip tone="accent">{BLOCK_LABEL[block.type] ?? NEW_BLOCK_LABEL[block.type as keyof typeof NEW_BLOCK_LABEL] ?? block.type}</PlatformChip>
          <strong>본문 #{index + 1}</strong>
        </div>
        <div className={styles.iconActions} aria-label="블록 위치 및 삭제">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="위로 이동" title="위로 이동">
            <ArrowUp size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="아래로 이동" title="아래로 이동">
            <ArrowDown size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={onRemove} aria-label="블록 삭제" title="블록 삭제" className={styles.dangerIconButton}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {block.type === 'heading' && (
        <div className={styles.headingComposer}>
          <Field label="레벨">
            <select
              value={block.headingLevel ?? 2}
              onChange={event => onChange({ ...block, headingLevel: Number(event.target.value) })}
            >
              <option value={2}>H2</option>
              <option value={3}>H3</option>
              <option value={4}>H4</option>
            </select>
          </Field>
          <Field label="제목">
            <input className={styles.headingInput} value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} />
          </Field>
        </div>
      )}

      {block.type === 'paragraph' && (
        <div className={styles.paragraphComposer}>
          <button type="button" className={styles.paragraphPhotoButton} onClick={onInsertImageBefore}>
            <Images size={15} aria-hidden="true" />
            이 문단 위에 사진
          </button>
          <Field label="문단">
            <textarea className={styles.paragraphTextarea} value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} rows={7} />
          </Field>
        </div>
      )}

      {block.type === 'image' && (
        <div className={styles.blockStack}>
          {selectedMedia ? (
            <div className={styles.imageBlockPreview}>
              <div className={styles.imageBlockFrame}>
                {selectedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedImageUrl} alt={selectedMedia.altText || selectedMedia.sourceLabel || '선택한 사진'} />
                ) : (
                  <ImageIcon size={24} aria-hidden="true" />
                )}
              </div>
              <div className={styles.imageBlockInfo}>
                <strong>{selectedMedia.sourceLabel || '선택한 사진'}</strong>
                <p>{selectedMedia.caption ? selectedMedia.caption : '설명 없이 사진만 표시합니다.'}</p>
                <div className={styles.imageBlockActions}>
                  <button type="button" onClick={onPickImage} disabled={disabled}>
                    <Images size={15} aria-hidden="true" />
                    교체
                  </button>
                  <button type="button" onClick={() => onChange({ ...block, mediaId: null })} disabled={disabled}>
                    <XCircle size={15} aria-hidden="true" />
                    연결 해제
                  </button>
                </div>
                <ImageBlockDetails key={selectedMedia.id} postId={postId} media={selectedMedia} disabled={disabled} onChanged={onMediaChanged} />
              </div>
            </div>
          ) : (
            <div className={styles.imageBlockEmpty}>
              <ImageIcon size={22} aria-hidden="true" />
              <div>
                <strong>아직 사진이 없습니다.</strong>
                <span>사진보관함에서 본문에 넣을 사진을 선택하세요.</span>
              </div>
              <button type="button" onClick={onPickImage} disabled={disabled}>
                <Images size={15} aria-hidden="true" />
                사진 선택
              </button>
            </div>
          )}
        </div>
      )}

      {block.type === 'link_button' && (
        <div className={styles.linkButtonComposer}>
          <Field label="버튼 문구">
            <input value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} />
          </Field>
          <Field label="연결 경로" hint="공개 블로그나 무료방문 실측견적처럼 / 로 시작하는 내부 경로만 사용합니다.">
            <input value={block.metadata.href ?? ''} onChange={event => updateMetadata('href', event.target.value)} />
          </Field>
          <Field label="보조 설명">
            <textarea value={block.metadata.description ?? ''} onChange={event => updateMetadata('description', event.target.value)} rows={3} />
          </Field>
        </div>
      )}

      {block.type === 'guide_box' && (
        <div className={styles.guideBoxComposer}>
          <Field label="안내 성격">
            <select value={block.metadata.tone ?? 'guide'} onChange={event => updateMetadata('tone', event.target.value)}>
              <option value="guide">안내</option>
              <option value="notice">알아두세요</option>
              <option value="condition">현장 조건</option>
              <option value="caution">주의</option>
            </select>
          </Field>
          <Field label="제목">
            <input value={block.metadata.title ?? ''} onChange={event => updateMetadata('title', event.target.value)} />
          </Field>
          <Field label="안내 문장">
            <textarea value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} rows={5} />
          </Field>
        </div>
      )}

      {block.type === 'quote' && (
        <div className={styles.blockStack}>
          <Field label="인용문"><textarea value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} rows={4} /></Field>
          <Field label="출처명"><input value={block.metadata.attribution ?? ''} onChange={event => updateMetadata('attribution', event.target.value)} /></Field>
          <Field label="출처 URL (선택)"><input type="url" value={block.metadata.source_url ?? ''} onChange={event => updateMetadata('source_url', event.target.value)} /></Field>
        </div>
      )}
      {block.type === 'video' && (
        <div className={styles.blockStack}>
          <Field label="YouTube URL"><input type="url" value={block.metadata.youtube_url ?? ''} onChange={event => updateMetadata('youtube_url', event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></Field>
          <Field label="영상 제목 (선택)"><input value={block.metadata.title ?? ''} onChange={event => updateMetadata('title', event.target.value)} /></Field>
        </div>
      )}
      {block.type === 'related_post' && (
        <Field label="발행된 관련 글">
          <select value={block.metadata.related_post_id ?? ''} onChange={event => updateMetadata('related_post_id', event.target.value)}>
            <option value="">글을 선택하세요</option>
            {publishedRelatedPosts.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </Field>
      )}
      {block.type === 'place' && (
        <div className={styles.blockStack}>
          <Field label="장소명"><input value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} /></Field>
          <Field label="지도 링크"><input type="url" value={block.metadata.place_url ?? ''} onChange={event => updateMetadata('place_url', event.target.value)} placeholder="Kakao, Naver 또는 Google Maps 링크" /></Field>
        </div>
      )}
      {block.type === 'quiz' && (
        <div className={styles.blockStack}>
          <Field label="질문"><textarea value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} rows={3} /></Field>
          <Field label="정답"><textarea value={block.metadata.answer ?? ''} onChange={event => updateMetadata('answer', event.target.value)} rows={3} /></Field>
          <Field label="풀이 (선택)"><textarea value={block.metadata.explanation ?? ''} onChange={event => updateMetadata('explanation', event.target.value)} rows={3} /></Field>
        </div>
      )}
      {block.type === 'checklist' && (
        <div className={styles.blockStack}>
          <Field label="제목 (선택)"><input value={block.metadata.title ?? ''} onChange={event => updateMetadata('title', event.target.value)} /></Field>
          <Field label="항목"><textarea value={block.metadata.items ?? ''} onChange={event => updateMetadata('items', event.target.value)} rows={6} placeholder="한 줄에 한 항목씩 입력하세요" /></Field>
        </div>
      )}
      {block.type === 'qa' && (
        <div className={styles.qaComposer}>
          <Field label="질문">
            <input className={styles.qaQuestionInput} value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} />
          </Field>
          <Field label="답변">
            <textarea value={block.metadata.answer ?? ''} onChange={event => updateMetadata('answer', event.target.value)} rows={5} />
          </Field>
        </div>
      )}

      {block.type === 'cta' && (
        <div className={styles.ctaComposer}>
          <Field label="CTA 문구">
            <input value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} />
          </Field>
          <Field label="CTA 종류">
            <input value={block.metadata.cta_kind ?? ''} onChange={event => updateMetadata('cta_kind', event.target.value)} />
          </Field>
        </div>
      )}
    </article>
  )
}

export default function BlogEditorClient({
  initialPost,
  initialBlocks,
  media,
  contentAssets,
  events,
  initialQuestions,
  publishedRelatedPosts,
}: {
  initialPost: BlogEditorPost
  initialBlocks: BlogEditorBlock[]
  media: BlogEditorMedia[]
  contentAssets: ContentAssetPickerItem[]
  events: BlogEditorEvent[]
  initialQuestions: BlogEditorQuestion[]
  publishedRelatedPosts: PublishedRelatedPostOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isAssetPending, startAssetTransition] = useTransition()
  const [isPublishing, setIsPublishing] = useState(false)
  const [post, setPost] = useState<EditablePost>({
    id: initialPost.id,
    title: initialPost.title,
    slug: initialPost.slug,
    excerpt: initialPost.excerpt,
    status: initialPost.status,
    category: initialPost.category,
    seoTitle: initialPost.seoTitle,
    metaDescription: initialPost.metaDescription,
    canonicalUrl: initialPost.canonicalUrl,
    primaryKeyword: initialPost.primaryKeyword,
    targetQuestion: initialPost.targetQuestion,
    summaryAnswer: initialPost.summaryAnswer,
    relatedQuestions: initialPost.relatedQuestions,
    serviceArea: initialPost.serviceArea,
    productType: initialPost.productType,
    aiCitationReady: initialPost.aiCitationReady,
    mediaMissingReason: initialPost.mediaMissingReason,
  })
  const [relatedText, setRelatedText] = useState(initialPost.relatedQuestions.join('\n'))
  const [blocks, setBlocks] = useState<EditableBlock[]>(initialBlocks.map(block => ({
    ...block,
    clientId: block.id,
  })))
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [publishMessage, setPublishMessage] = useState<{ ok: boolean; text: string; issues?: string[] } | null>(null)
  const [editorMedia, setEditorMedia] = useState<BlogEditorMedia[]>(media)
  const [readerQuestions, setReaderQuestions] = useState<BlogEditorQuestion[]>(initialQuestions)
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget | null>(null)
  const [assetPickerMessage, setAssetPickerMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('write')
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const slugRef = useRef<HTMLInputElement>(null)
  const summaryAnswerRef = useRef<HTMLTextAreaElement>(null)
  const metaDescriptionRef = useRef<HTMLTextAreaElement>(null)
  const targetQuestionRef = useRef<HTMLTextAreaElement>(null)
  const coverPickerRef = useRef<HTMLDivElement>(null)
  const blockToolbarRef = useRef<HTMLDivElement>(null)
  const blockListRef = useRef<HTMLDivElement>(null)
  const previewLinkRef = useRef<HTMLAnchorElement>(null)

  const isPublished = post.status === 'published'
  const isArchived = post.status === 'archived'
  const selectableMedia = useMemo(() => editorMedia.filter(item => item.usageStatus !== 'rejected'), [editorMedia])
  const relatedQuestionsForPreview = useMemo(
    () => relatedText.split('\n').map(item => item.trim()).filter(Boolean),
    [relatedText],
  )
  const previewBlocks = useMemo(() => blocks.map(block => {
    if (block.type !== 'related_post') return block
    const relatedPost = publishedRelatedPosts.find(item => item.id === block.metadata.related_post_id)
    if (!relatedPost) return block
    return {
      ...block,
      metadata: {
        ...block.metadata,
        related_post_title: relatedPost.title,
        related_post_slug: relatedPost.slug,
      },
    }
  }), [blocks, publishedRelatedPosts])
  const previewData = useMemo(() => buildBlogEditorPreviewData({
    post: {
      ...post,
      relatedQuestions: relatedQuestionsForPreview,
      publishedAt: initialPost.publishedAt,
      updatedAt: initialPost.updatedAt,
    },
    blocks: previewBlocks,
    media: selectableMedia,
  }), [initialPost.publishedAt, initialPost.updatedAt, post, previewBlocks, relatedQuestionsForPreview, selectableMedia])
  const coverMedia = selectableMedia.find(item => item.usedAsCover) ?? null
  const coverMediaUrl = coverMedia?.signedPreviewUrl ?? coverMedia?.publicUrl ?? null

  const blockStats = useMemo(() => ({
    blockCount: blocks.length,
    ctaCount: blocks.filter(block => block.type === 'cta').length,
    imageCount: blocks.filter(block => block.type === 'image').length,
    unlinkedImages: blocks.filter(block => block.type === 'image' && !block.mediaId).length,
  }), [blocks])
  const queuedQuestionIds = useMemo(() => new Set(blocks
    .filter(block => block.type === 'qa')
    .map(block => block.metadata.source_blog_question_id)
    .filter((questionId): questionId is string => Boolean(questionId))),
  [blocks])
  const firstCtaBlock = blocks.find(block => block.type === 'cta') ?? null
  const firstUnlinkedImageBlock = blocks.find(block => block.type === 'image' && !block.mediaId) ?? null
  const firstAltMissingImageBlock = blocks.find(block => {
    if (block.type !== 'image' || !block.mediaId) return false
    const item = editorMedia.find(mediaItem => mediaItem.id === block.mediaId)
    return Boolean(item && !item.altText?.trim())
  }) ?? null
  const altMissingCount = blocks.filter(block => {
    if (block.type !== 'image' || !block.mediaId) return false
    const item = editorMedia.find(mediaItem => mediaItem.id === block.mediaId)
    return Boolean(item && !item.altText?.trim())
  }).length

  const scrollAndFocus = (element: HTMLElement | null) => {
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLButtonElement) {
        element.focus({ preventScroll: true })
      } else {
        const focusable = element.querySelector<HTMLElement>('input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])')
        focusable?.focus({ preventScroll: true })
      }
    }, 180)
  }

  const afterNextPaint = (callback: () => void) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback)
    })
  }

  const jumpToBlock = (clientId: string | null | undefined) => {
    if (!clientId) {
      scrollAndFocus(blockToolbarRef.current)
      return
    }
    const target = document.querySelector<HTMLElement>(`[data-block-client-id="${clientId}"]`)
    scrollAndFocus(target)
  }

  const jumpToSeoField = (ref: RefObject<HTMLElement | null>) => {
    setEditorMode('seo')
    afterNextPaint(() => scrollAndFocus(ref.current))
  }

  const jumpToWriteTarget = (target: () => HTMLElement | null) => {
    setEditorMode('write')
    afterNextPaint(() => scrollAndFocus(target()))
  }

  const gateItems = [
    {
      key: 'title',
      ok: Boolean(post.title.trim() && post.slug.trim()),
      label: '제목',
      detail: post.title.trim() && post.slug.trim() ? undefined : '제목/주소',
    },
    {
      key: 'body',
      ok: Boolean(post.summaryAnswer?.trim()),
      label: '요약',
      detail: post.summaryAnswer?.trim() ? undefined : '요약 답변',
    },
    {
      key: 'body-blocks',
      ok: blockStats.blockCount > 0,
      label: '본문',
      detail: `${blockStats.blockCount}개`,
    },
    {
      key: 'image',
      ok: blockStats.unlinkedImages === 0 && altMissingCount === 0,
      label: '사진',
      detail: blockStats.unlinkedImages > 0 ? `${blockStats.unlinkedImages}개 미연결` : altMissingCount > 0 ? `${altMissingCount}개 설명 필요` : undefined,
    },
    {
      key: 'cover',
      ok: Boolean(coverMedia || post.mediaMissingReason?.trim()),
      label: '대표사진/사유',
      detail: coverMedia || post.mediaMissingReason?.trim() ? undefined : '대표사진 또는 사유 필요',
    },
    {
      key: 'cta',
      ok: blockStats.ctaCount > 0,
      label: 'CTA',
      detail: `${blockStats.ctaCount}개`,
    },
    {
      key: 'seo',
      ok: Boolean(post.metaDescription?.trim() && post.targetQuestion?.trim()),
      label: 'SEO',
      detail: !post.metaDescription?.trim() ? '메타 설명' : !post.targetQuestion?.trim() ? '타깃 질문' : undefined,
    },
  ]

  const jumpGateItem = (key: string) => {
    if (key === 'title') {
      jumpToWriteTarget(() => post.title.trim() ? slugRef.current : titleRef.current)
      return
    }
    if (key === 'body') {
      jumpToWriteTarget(() => summaryAnswerRef.current)
      return
    }
    if (key === 'body-blocks') {
      jumpToWriteTarget(() => blockStats.blockCount > 0 ? blockListRef.current : blockToolbarRef.current)
      return
    }
    if (key === 'image') {
      setEditorMode('write')
      afterNextPaint(() => jumpToBlock(firstUnlinkedImageBlock?.clientId ?? firstAltMissingImageBlock?.clientId))
      return
    }
    if (key === 'cover') {
      jumpToWriteTarget(() => coverPickerRef.current)
      return
    }
    if (key === 'cta') {
      setEditorMode('write')
      afterNextPaint(() => jumpToBlock(firstCtaBlock?.clientId))
      return
    }
    if (key === 'seo') {
      jumpToSeoField(post.metaDescription?.trim() ? targetQuestionRef : metaDescriptionRef)
      return
    }
  }

  const updatePost = <K extends keyof EditablePost>(key: K, value: EditablePost[K]) => {
    setPost(prev => ({ ...prev, [key]: value }))
  }

  const addBlock = (type: Exclude<BlogBlockType, 'image'>) => {
    setBlocks(prev => [...prev, createBlock(type)])
  }

  const updateReaderQuestion = (
    id: string,
    patch: Partial<Pick<BlogEditorQuestion, 'approvedQuestion' | 'approvedAnswer' | 'adminNote'>>,
  ) => {
    setReaderQuestions(prev => prev.map(question => question.id === id ? { ...question, ...patch } : question))
  }

  const addReaderQuestionAsQa = (question: BlogEditorQuestion) => {
    const approvedQuestion = question.approvedQuestion?.trim() ?? ''
    const approvedAnswer = question.approvedAnswer?.trim() ?? ''
    const alreadyQueued = blocks.some(block => block.type === 'qa' && block.metadata.source_blog_question_id === question.id)

    if (approvedQuestion.length < 2 || approvedAnswer.length < 2) {
      setSaveMessage({ ok: false, text: '공개용 질문과 답변을 먼저 작성해주세요.' })
      return
    }

    if (alreadyQueued) {
      setSaveMessage({ ok: false, text: '이미 이 질문으로 만든 Q&A 블록이 있습니다.' })
      return
    }

    const nextBlock = {
      ...createBlock('qa'),
      text: approvedQuestion,
      metadata: {
        answer: approvedAnswer,
        source_blog_question_id: question.id,
      },
    }

    setBlocks(prev => [...prev, nextBlock])
    setEditorMode('write')
    setSaveMessage({ ok: true, text: 'Q&A 블록을 추가했습니다. 저장하면 독자 질문이 승인 상태로 연결됩니다.' })
    afterNextPaint(() => jumpToBlock(nextBlock.clientId))
  }

  const openAssetPicker = (target: AssetPickerTarget) => {
    if (isPublished) {
      setAssetPickerMessage({ ok: false, text: '발행된 글의 사진은 재검수 상태에서만 변경할 수 있습니다.' })
      return
    }
    setAssetPickerTarget(target)
    setAssetPickerMessage(null)
  }

  const updateBlock = (clientId: string, next: EditableBlock) => {
    setBlocks(prev => prev.map(block => block.clientId === clientId ? next : block))
  }

  const removeBlock = (clientId: string) => {
    setBlocks(prev => prev.filter(block => block.clientId !== clientId))
  }

  const moveBlock = (clientId: string, direction: -1 | 1) => {
    setBlocks(prev => {
      const index = prev.findIndex(block => block.clientId === clientId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const buildPayload = (): SaveBlogEditorPayload => ({
    postId: post.id,
    expectedUpdatedAt: initialPost.updatedAt,
    post: {
      title: post.title,
      slug: post.slug,
      excerpt: emptyToNull(post.excerpt ?? ''),
      category: post.category,
      seoTitle: emptyToNull(post.seoTitle ?? ''),
      metaDescription: emptyToNull(post.metaDescription ?? ''),
      canonicalUrl: emptyToNull(post.canonicalUrl ?? ''),
      primaryKeyword: emptyToNull(post.primaryKeyword ?? ''),
      targetQuestion: emptyToNull(post.targetQuestion ?? ''),
      summaryAnswer: emptyToNull(post.summaryAnswer ?? ''),
      relatedQuestions: relatedText.split('\n').map(item => item.trim()).filter(Boolean),
      serviceArea: emptyToNull(post.serviceArea ?? ''),
      productType: emptyToNull(post.productType ?? ''),
      aiCitationReady: post.aiCitationReady,
      mediaMissingReason: emptyToNull(post.mediaMissingReason ?? ''),
    },
    blocks: blocks.map(block => ({
      id: block.id || null,
      type: block.type,
      headingLevel: block.type === 'heading' ? block.headingLevel : null,
      text: emptyToNull(block.text ?? ''),
      mediaId: block.type === 'image' ? block.mediaId : null,
      metadata: block.metadata,
    })),
  })

  const initialEditorSignature = createStableEditorSignature({
    postId: initialPost.id,
    post: {
      title: initialPost.title,
      slug: initialPost.slug,
      excerpt: emptyToNull(initialPost.excerpt ?? ''),
      category: initialPost.category,
      seoTitle: emptyToNull(initialPost.seoTitle ?? ''),
      metaDescription: emptyToNull(initialPost.metaDescription ?? ''),
      canonicalUrl: emptyToNull(initialPost.canonicalUrl ?? ''),
      primaryKeyword: emptyToNull(initialPost.primaryKeyword ?? ''),
      targetQuestion: emptyToNull(initialPost.targetQuestion ?? ''),
      summaryAnswer: emptyToNull(initialPost.summaryAnswer ?? ''),
      relatedQuestions: initialPost.relatedQuestions,
      serviceArea: emptyToNull(initialPost.serviceArea ?? ''),
      productType: emptyToNull(initialPost.productType ?? ''),
      aiCitationReady: initialPost.aiCitationReady,
      mediaMissingReason: emptyToNull(initialPost.mediaMissingReason ?? ''),
    },
    blocks: initialBlocks.map(block => ({
      id: block.id || null,
      type: block.type,
      headingLevel: block.type === 'heading' ? block.headingLevel : null,
      text: emptyToNull(block.text ?? ''),
      mediaId: block.type === 'image' ? block.mediaId : null,
      metadata: block.metadata,
    })),
  })
  const [savedEditorSignature, setSavedEditorSignature] = useState(initialEditorSignature)
  const currentEditorSignature = createStableEditorSignature(buildPayload())
  const hasUnsavedEditorChanges = currentEditorSignature !== savedEditorSignature

  useEffect(() => {
    if (!hasUnsavedEditorChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedEditorChanges])

  const closeDiscardDialog = () => {
    setDiscardDialogOpen(false)
  }

  const handlePreviewNavigate: NonNullable<ComponentProps<typeof Link>['onNavigate']> = (event) => {
    if (!hasUnsavedEditorChanges) return
    event.preventDefault()
    setDiscardDialogOpen(true)
  }

  const confirmDiscardAndPreview = () => {
    setSavedEditorSignature(currentEditorSignature)
    setDiscardDialogOpen(false)
    router.push(`/admin/platform/blog/${post.id}/preview`)
  }

  const handleSave = () => {
    setSaveMessage(null)
    startTransition(async () => {
      const result = await saveBlogEditor(buildPayload())
      setSaveMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        setSavedEditorSignature(currentEditorSignature)
        router.refresh()
      }
    })
  }

  const handlePublish = () => {
    setPublishMessage(null)
    setIsPublishing(true)
    startTransition(async () => {
      try {
        const result = await publishBlogEditor(buildPayload())
        setPublishMessage({ ok: result.ok, text: result.message, issues: result.issues })
        if (result.ok) {
          setSavedEditorSignature(currentEditorSignature)
          setPost(current => ({ ...current, status: 'published' }))
          router.refresh()
        }
      } finally {
        setIsPublishing(false)
      }
    })
  }

  const handleArchive = () => {
    setPublishMessage(null)
    startTransition(async () => {
      const result = await updateBlogPostStatus(post.id, 'archived')
      setPublishMessage({ ok: result.ok, text: result.message, issues: result.issues })
      if (result.ok) {
        setPost(current => ({ ...current, status: 'archived' }))
        setArchiveDialogOpen(false)
        router.refresh()
      }
    })
  }

  const handleRestore = () => {
    setPublishMessage(null)
    startTransition(async () => {
      const result = await updateBlogPostStatus(post.id, 'reviewing')
      setPublishMessage({ ok: result.ok, text: result.message, issues: result.issues })
      if (result.ok) {
        setPost(current => ({ ...current, status: 'reviewing' }))
        router.refresh()
      }
    })
  }

  const handleSelectContentAsset = (assets: ContentAssetPickerItem[]) => {
    if (!assetPickerTarget) return
    const selectedAssets = assetPickerTarget.type === 'replace' || assetPickerTarget.type === 'cover' ? assets.slice(0, 1) : assets
    if (selectedAssets.length === 0) return
    setAssetPickerMessage(null)

    startAssetTransition(async () => {
      const attached: Array<{ asset: ContentAssetPickerItem; media: BlogEditorMedia }> = []
      const existingBlockMediaIds = new Set(blocks.map(block => block.mediaId).filter(Boolean))
      let skipped = 0

      for (const asset of selectedAssets) {
        const result = await attachContentAssetToBlogMedia({
          postId: post.id,
          assetId: asset.id,
        })

        if (!result.ok || !result.media) {
          setAssetPickerMessage({ ok: false, text: result.message })
          return
        }

        const nextMedia = toEditorMediaFromAttached(result.media)
        if (assetPickerTarget.type === 'cover') {
          const coverResult = await updateBlogMedia({
            postId: post.id,
            mediaId: nextMedia.id,
            altText: nextMedia.altText ?? nextMedia.sourceLabel ?? '',
            caption: nextMedia.caption ?? '',
            sourceLabel: nextMedia.sourceLabel ?? '',
            privacyChecked: nextMedia.privacyChecked,
            promotionConsentChecked: nextMedia.promotionConsentChecked,
            usedAsCover: true,
            usageStatus: nextMedia.usageStatus,
            rejectionReason: nextMedia.rejectionReason,
          })

          if (!coverResult.ok) {
            setAssetPickerMessage({ ok: false, text: coverResult.message })
            return
          }

          setEditorMedia(prev => {
            const withoutCover = prev.map(mediaItem => ({ ...mediaItem, usedAsCover: false }))
            const index = withoutCover.findIndex(mediaItem => mediaItem.id === nextMedia.id)
            const coverMedia = { ...nextMedia, usedAsCover: true, altText: nextMedia.altText ?? nextMedia.sourceLabel }
            if (index >= 0) {
              withoutCover[index] = { ...withoutCover[index], ...coverMedia }
              return withoutCover
            }
            return [coverMedia, ...withoutCover]
          })
          setAssetPickerMessage({ ok: true, text: '대표사진을 설정했습니다.' })
          setAssetPickerTarget(null)
          router.refresh()
          return
        }

        if (assetPickerTarget.type !== 'replace' && existingBlockMediaIds.has(nextMedia.id)) {
          skipped += 1
          continue
        }

        existingBlockMediaIds.add(nextMedia.id)
        attached.push({ asset, media: nextMedia })
      }

      if (attached.length === 0) {
        setAssetPickerMessage({ ok: false, text: skipped > 0 ? '선택한 사진은 이미 본문에 들어가 있습니다.' : '본문에 넣을 사진을 찾지 못했습니다.' })
        return
      }

      setEditorMedia(prev => {
        const next = [...prev]
        for (const item of attached) {
          const index = next.findIndex(mediaItem => mediaItem.id === item.media.id)
          if (index >= 0) {
            next[index] = { ...next[index], ...item.media }
          } else {
            next.unshift(item.media)
          }
        }
        return next
      })

      if (assetPickerTarget.type === 'replace') {
        const first = attached[0]
        setBlocks(prev => prev.map(block => block.clientId === assetPickerTarget.clientId
          ? {
              ...block,
              mediaId: first.media.id,
              metadata: {
                ...block.metadata,
                photo_slot_label: block.metadata.photo_slot_label || displayAssetTitle(first.asset) || first.asset.category || '',
              },
            }
          : block
        ))
      } else {
        const imageBlocks = attached.map(item => createBlock('image', {
            mediaId: item.media.id,
            photoSlotLabel: displayAssetTitle(item.asset) || item.asset.category || '',
        }))

        setBlocks(prev => {
          if (assetPickerTarget.type !== 'insertBefore') {
            return [...prev, ...imageBlocks]
          }

          const targetIndex = prev.findIndex(block => block.clientId === assetPickerTarget.clientId)
          if (targetIndex < 0) return [...prev, ...imageBlocks]

          return [
            ...prev.slice(0, targetIndex),
            ...imageBlocks,
            ...prev.slice(targetIndex),
          ]
        })
      }

      setAssetPickerMessage({
        ok: true,
        text: skipped > 0
          ? `${attached.length}장을 본문에 넣었습니다. 이미 들어간 ${skipped}장은 건너뛰었습니다.`
          : `${attached.length}장을 본문에 넣었습니다.`,
      })
      setAssetPickerTarget(null)
    })
  }

  const handleRemoveCover = () => {
    if (!coverMedia) return
    setAssetPickerMessage(null)
    startAssetTransition(async () => {
      const result = await updateBlogMedia({
        postId: post.id,
        mediaId: coverMedia.id,
        altText: coverMedia.altText ?? '',
        caption: coverMedia.caption ?? '',
        sourceLabel: coverMedia.sourceLabel ?? '',
        privacyChecked: coverMedia.privacyChecked,
        promotionConsentChecked: coverMedia.promotionConsentChecked,
        usedAsCover: false,
        usageStatus: coverMedia.usageStatus,
        rejectionReason: coverMedia.rejectionReason,
      })

      if (result.ok) {
        setEditorMedia(prev => prev.map(item => item.id === coverMedia.id ? { ...item, usedAsCover: false } : item))
        router.refresh()
      }
    })
  }

  const handleMediaChanged = (nextMedia: BlogEditorMedia) => {
    setEditorMedia(prev => prev.map(item => {
      if (item.id === nextMedia.id) return nextMedia
      if (nextMedia.usedAsCover) return { ...item, usedAsCover: false }
      return item
    }))
    router.refresh()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin/platform/blog" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          콘텐츠 큐
        </Link>
        <div className={styles.titleRow}>
          <div>
            <PlatformStatusBadge tone={getPostStatusTone(post.status)}>{STATUS_LABEL[post.status]}</PlatformStatusBadge>
            <h1 data-testid="blog-editor-title">{post.title || '제목 없는 원고'}</h1>
            <p>{post.slug}</p>
          </div>
          <div className={styles.headerActions}>
            <Link
              ref={previewLinkRef}
              href={`/admin/platform/blog/${post.id}/preview`}
              className={styles.previewButton}
              onNavigate={handlePreviewNavigate}
            >
              <Eye size={16} aria-hidden="true" />
              미리보기
            </Link>
            <button type="button" onClick={handleSave} disabled={isPending || isPublished} className={styles.primaryButton}>
              <Save size={16} aria-hidden="true" />
              임시저장
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPending || isPublished || isArchived}
              className={styles.publishButton}
              data-testid="publish-blog-post"
            >
              <Rocket size={16} aria-hidden="true" />
              {isPublishing ? '발행 중' : '발행'}
            </button>
            <button type="button" onClick={() => setArchiveDialogOpen(true)} disabled={isPending || isArchived} className={styles.secondaryButton}>휴지통으로 이동</button>
            {isArchived && <button type="button" onClick={handleRestore} disabled={isPending} className={styles.primaryButton}>초안으로 복원</button>}
          </div>
        </div>
        <div className={styles.editorWorkbenchBar}>
          <PlatformTabs
            id="blog-editor-mode"
            label="편집 모드"
            items={EDITOR_MODE_TABS}
            value={editorMode}
            onChange={setEditorMode}
            className={styles.editorModeTabs}
          />
          <section className={styles.gateBarPanel} aria-label="발행 전 검수">
            <span className={styles.gateBarLabel}>검수</span>
            <ul className={styles.gateList}>
              {gateItems.map(item => (
                <GateItem key={item.key} ok={item.ok} label={item.label} detail={item.detail} onJump={() => jumpGateItem(item.key)} />
              ))}
            </ul>
          </section>
        </div>
        {saveMessage && (
          <EditorStateMessage ok={saveMessage.ok} text={saveMessage.text} />
        )}
        {publishMessage && (
          <EditorStateMessage ok={publishMessage.ok} text={publishMessage.text} issues={publishMessage.issues} />
        )}
        {hasUnsavedEditorChanges && !isPublished && !isArchived && (
          <p className={styles.unsavedHint} role="status">변경 내용은 발행할 때 함께 저장됩니다.</p>
        )}
        {isPublished && (
          <div className={styles.lockNotice} role="status">
            발행된 글은 바로 저장할 수 없습니다. 수정 정책을 설계한 뒤 재검수 상태에서 편집해야 합니다.
          </div>
        )}
      </header>

      <ContentAssetPicker
        open={Boolean(assetPickerTarget)}
        items={contentAssets}
        pending={isAssetPending}
        message={assetPickerMessage}
        multiple={assetPickerTarget?.type !== 'replace' && assetPickerTarget?.type !== 'cover'}
        onClose={() => {
          if (!isAssetPending) setAssetPickerTarget(null)
        }}
        onSelect={handleSelectContentAsset}
        onUploaded={() => router.refresh()}
      />
      <PlatformModal
        isOpen={archiveDialogOpen}
        title="글을 휴지통으로 이동할까요?"
        onClose={() => setArchiveDialogOpen(false)}
        footer={<><button type="button" className={styles.secondaryButton} onClick={() => setArchiveDialogOpen(false)}>취소</button><button type="button" className={styles.dangerButton} onClick={handleArchive} disabled={isPending}>휴지통으로 이동</button></>}
      >
        <p>{isPublished ? '발행 글을 휴지통으로 이동하면 현재 공개 URL과 검색 노출이 사라집니다. 글과 자산은 영구삭제되지 않으며, 나중에 초안으로 복원할 수 있습니다.' : '글과 자산은 영구삭제되지 않으며, 나중에 초안으로 복원할 수 있습니다.'}</p>
      </PlatformModal>

      <div className={styles.editorLayout}>
        <main className={styles.mainEditor}>
          <PlatformTabPanel
            tabsId="blog-editor-mode"
            value="write"
            active={editorMode === 'write'}
            className={styles.editorModePanel}
          >
          <section className={styles.panel} data-testid="blog-basic-information">
            <div className={styles.panelTitle}>
              <FileText size={17} aria-hidden="true" />
              <h2>기본 정보</h2>
            </div>
            <div className={styles.formGrid}>
              <Field label="제목">
                <input ref={titleRef} value={post.title} onChange={event => updatePost('title', event.target.value)} />
              </Field>
              <Field label="주소" hint="영문 소문자, 숫자, 하이픈만 사용">
                <input ref={slugRef} value={post.slug} onChange={event => updatePost('slug', event.target.value)} />
              </Field>
              <Field label="카테고리">
                <select value={post.category} onChange={event => updatePost('category', event.target.value as BlogContentCategory)}>
                  {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="도입 요약">
                <textarea value={post.excerpt ?? ''} onChange={event => updatePost('excerpt', event.target.value)} rows={3} />
              </Field>
              <Field label="요약 답변">
                <textarea ref={summaryAnswerRef} value={post.summaryAnswer ?? ''} onChange={event => updatePost('summaryAnswer', event.target.value)} rows={3} />
              </Field>
            </div>
            <div className={styles.coverPicker} ref={coverPickerRef} tabIndex={-1}>
              <div className={styles.coverPickerText}>
                <strong>대표사진</strong>
                <span>블로그 목록 썸네일과 포스팅 상단에 표시할 사진입니다.</span>
              </div>
              {coverMedia ? (
                <div className={styles.coverPickerCard}>
                  <div className={styles.coverPickerThumb}>
                    {coverMediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coverMediaUrl} alt={coverMedia.altText || coverMedia.sourceLabel || '대표사진'} />
                    ) : (
                      <ImageIcon size={22} aria-hidden="true" />
                    )}
                  </div>
                  <div className={styles.coverPickerMeta}>
                    <strong>{coverMedia.sourceLabel || '선택한 사진'}</strong>
                    <span>{coverMedia.caption || coverMedia.altText || '대표사진으로 사용 중'}</span>
                  </div>
                  <div className={styles.coverPickerActions}>
                    <button type="button" onClick={() => openAssetPicker({ type: 'cover' })} disabled={isAssetPending || isPublished}>
                      <Images size={15} aria-hidden="true" />
                      교체
                    </button>
                    <button type="button" onClick={handleRemoveCover} disabled={isAssetPending || isPublished}>
                      <XCircle size={15} aria-hidden="true" />
                      제거
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.coverEmptyButton} onClick={() => openAssetPicker({ type: 'cover' })} disabled={isAssetPending || isPublished}>
                  <ImageIcon size={18} aria-hidden="true" />
                  대표사진 선택
                </button>
              )}
              <Field
                label="대표사진이 없을 때 사유"
                hint="대표사진을 준비할 수 없는 정당한 예외가 있을 때만 구체적으로 기록해 주세요."
              >
                <textarea
                  value={post.mediaMissingReason ?? ''}
                  onChange={event => updatePost('mediaMissingReason', event.target.value)}
                  rows={3}
                  maxLength={500}
                  disabled={isPublished}
                />
              </Field>
            </div>
          </section>

          <ReaderQuestionPanel
            questions={readerQuestions}
            queuedQuestionIds={queuedQuestionIds}
            onChange={updateReaderQuestion}
            onUseAsQa={addReaderQuestionAsQa}
          />

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <FileText size={17} aria-hidden="true" />
              <h2>블록 본문</h2>
            </div>
            <p className={styles.panelHelp}>본문을 구성해보세요. 문단을 추가하거나 사진을 넣어 글 흐름을 만들 수 있습니다.</p>
            <div className={styles.blockToolbar} aria-label="블록 추가" ref={blockToolbarRef}>
              <button type="button" onClick={() => addBlock('heading')}><Plus size={15} aria-hidden="true" /> 제목</button>
              <button type="button" onClick={() => addBlock('paragraph')}><Plus size={15} aria-hidden="true" /> 문단</button>
              <button type="button" onClick={() => openAssetPicker({ type: 'new' })}><Plus size={15} aria-hidden="true" /> 사진</button>
              <button type="button" onClick={() => addBlock('quote')}>인용구</button>
              <button type="button" onClick={() => addBlock('video')}>YouTube 영상</button>
              <button type="button" onClick={() => addBlock('related_post')}>관련 글</button>
              <button type="button" onClick={() => addBlock('place')}>장소/지도</button>
              <button type="button" onClick={() => addBlock('quiz')}>퀴즈</button>
              <button type="button" onClick={() => addBlock('checklist')}>체크리스트</button>
              <button type="button" onClick={() => addBlock('link_button')}><Link2 size={15} aria-hidden="true" /> 링크 버튼</button>
              <button type="button" onClick={() => addBlock('guide_box')}><Info size={15} aria-hidden="true" /> 안내 박스</button>
              <button type="button" onClick={() => addBlock('qa')}><Plus size={15} aria-hidden="true" /> Q&A</button>
              <button type="button" onClick={() => addBlock('cta')}><Plus size={15} aria-hidden="true" /> 상담 CTA</button>
            </div>
            <div className={styles.blockList} data-testid="blog-writing-canvas" ref={blockListRef}>
              {blocks.length === 0 ? (
                <div className={styles.emptyBlocks}>본문을 구성해보세요. 문단을 추가하거나 사진을 넣을 수 있습니다.</div>
              ) : (
                blocks.map((block, index) => (
                  <BlockEditor
                    key={block.clientId}
                    block={block}
                    postId={post.id}
                    media={selectableMedia}
                    index={index}
                    total={blocks.length}
                    disabled={isPublished}
                    onChange={(next) => updateBlock(block.clientId, next)}
                    onInsertImageBefore={() => openAssetPicker({ type: 'insertBefore', clientId: block.clientId })}
                    onPickImage={() => openAssetPicker({ type: 'replace', clientId: block.clientId })}
                    onMediaChanged={handleMediaChanged}
                    onMove={(direction) => moveBlock(block.clientId, direction)}
                    onRemove={() => removeBlock(block.clientId)}
                    publishedRelatedPosts={publishedRelatedPosts}
                  />
                ))
              )}
            </div>
          </section>
          </PlatformTabPanel>

          <PlatformTabPanel
            tabsId="blog-editor-mode"
            value="seo"
            active={editorMode === 'seo'}
            className={styles.editorModePanel}
          >
          <section className={`${styles.panel} ${styles.seoPanel}`}>
            <h2>SEO/AEO</h2>
            <div className={styles.formStack}>
              <Field label="검색 제목">
                <input value={post.seoTitle ?? ''} onChange={event => updatePost('seoTitle', event.target.value)} />
              </Field>
              <Field label="검색 설명">
                <textarea ref={metaDescriptionRef} value={post.metaDescription ?? ''} onChange={event => updatePost('metaDescription', event.target.value)} rows={3} />
              </Field>
              <Field label="대표 URL">
                <input value={post.canonicalUrl ?? ''} onChange={event => updatePost('canonicalUrl', event.target.value)} />
              </Field>
              <Field label="핵심 키워드">
                <input value={post.primaryKeyword ?? ''} onChange={event => updatePost('primaryKeyword', event.target.value)} />
              </Field>
              <Field label="대표 질문">
                <textarea ref={targetQuestionRef} value={post.targetQuestion ?? ''} onChange={event => updatePost('targetQuestion', event.target.value)} rows={2} />
              </Field>
              <Field label="요약 답변">
                <textarea value={post.summaryAnswer ?? ''} onChange={event => updatePost('summaryAnswer', event.target.value)} rows={4} />
              </Field>
              <Field label="함께 볼 질문" hint="한 줄에 하나씩 입력">
                <textarea value={relatedText} onChange={event => setRelatedText(event.target.value)} rows={4} />
              </Field>
              <div className={styles.twoFields}>
                <Field label="서비스 지역">
                  <input value={post.serviceArea ?? ''} onChange={event => updatePost('serviceArea', event.target.value)} />
                </Field>
                <Field label="제품군">
                  <input value={post.productType ?? ''} onChange={event => updatePost('productType', event.target.value)} />
                </Field>
              </div>
            </div>

            <details className={styles.activityDetails}>
              <summary>최근 활동</summary>
              {events.length === 0 ? (
                <div className={styles.emptyBlocks}>이벤트가 없습니다.</div>
              ) : (
                <ul className={styles.eventList}>
                  {events.map(event => (
                    <li key={event.id}>
                      <strong>{event.type}</strong>
                      <span>{formatDateTime(event.createdAt)}</span>
                      {event.memo && <p>{event.memo}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </section>
          </PlatformTabPanel>
        </main>

        <aside className={styles.sidePanel} aria-label="모바일 미리보기">
          <div className={styles.mobilePreviewDock}>
            <PlatformPreviewFrame
              label="390px 모바일 미리보기"
              className={styles.mobilePreviewFrame}
              data-testid="blog-editor-preview-frame"
            >
              <BlogPostRenderer data={previewData} surface="embedded-preview" />
            </PlatformPreviewFrame>
          </div>
        </aside>
      </div>
      <PlatformModal
        isOpen={discardDialogOpen}
        title="저장하지 않은 변경 사항"
        description="미리보기는 마지막으로 저장된 내용을 엽니다. 현재 변경 사항을 버리고 계속할까요?"
        onClose={closeDiscardDialog}
        closeOnBackdrop={false}
        footer={(
          <div className={styles.discardDialogActions}>
            <button data-modal-initial-focus type="button" onClick={closeDiscardDialog}>계속 편집</button>
            <button type="button" className={styles.discardConfirmButton} onClick={confirmDiscardAndPreview}>
              변경 사항 버리고 미리보기
            </button>
          </div>
        )}
      />
    </div>
  )
}
