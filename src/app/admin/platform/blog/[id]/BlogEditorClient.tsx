'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
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
  Plus,
  RotateCcw,
  Rocket,
  Save,
  Search,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import type {
  BlogBlockType,
  BlogContentCategory,
  BlogMediaSourceType,
  BlogMediaUsageStatus,
  BlogPostStatus,
} from '@/types/database'
import {
  attachContentAssetToBlogMedia,
  publishBlogPost,
  saveBlogEditor,
  updateBlogMedia,
  type ContentAssetBlogMedia,
  type SaveBlogEditorPayload,
  type UpdateBlogMediaPayload,
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
  lastFactCheckedAt: string | null
  mediaMissingReason: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  gateSummary: {
    sourceEvidenceCount: number
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

type EditablePost = Omit<BlogEditorPost, 'gateSummary' | 'publishedAt' | 'createdAt' | 'updatedAt'>
type EditableBlock = BlogEditorBlock & { clientId: string }
type AssetPickerTarget = { type: 'new' } | { type: 'replace'; clientId: string }
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
  ai_draft: 'AI 초안',
  reviewing: '검토중',
  needs_media: '사진필요',
  ready: '발행대기',
  published: '발행완료',
  archived: '보관',
}

const BLOCK_LABEL: Record<BlogBlockType, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  image: '이미지',
  qa: 'Q&A',
  cta: 'CTA',
}

const MEDIA_STATUS_LABEL: Record<BlogMediaUsageStatus, string> = {
  candidate: '확인필요',
  approved: '사용가능',
  published: '발행됨',
  rejected: '제외',
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

function toDateTimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  if (!value) return null
  return new Date(value).toISOString()
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

  if (type === 'image') {
    return { ...base, metadata: { photo_slot_label: options.photoSlotLabel ?? '', required_media: '' } }
  }

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

function GateItem({
  ok,
  label,
  detail,
}: {
  ok: boolean
  label: string
  detail?: string
}) {
  return (
    <li className={`${styles.gateItem} ${ok ? styles.gateOk : styles.gateWarn}`}>
      {ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertTriangle size={15} aria-hidden="true" />}
      <span>{label}</span>
      {detail && <small>{detail}</small>}
    </li>
  )
}

function MediaStatus({ media }: { media: BlogEditorMedia }) {
  return (
    <div className={styles.mediaStatus}>
      <span className={`${styles.mediaBadge} ${styles[`media_${media.usageStatus}`]}`}>
        {MEDIA_STATUS_LABEL[media.usageStatus]}
      </span>
      <span>{media.usedAsCover ? '대표사진' : '본문사진'}</span>
      <span>{media.altText ? '대체 설명 있음' : '대체 설명 필요'}</span>
    </div>
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
        form.reset()
        onUploaded()
        setUploadOpen(false)
      }
    })
  }

  if (!open) return null

  return (
    <div className={styles.assetPickerOverlay} role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
      <div className={styles.assetPicker}>
        <div className={styles.assetPickerHeader}>
          <div>
            <span>사진보관함</span>
            <h2 id="asset-picker-title">본문에 넣을 사진 선택</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="사진보관함 닫기" className={styles.iconOnlyButton}>
            <XCircle size={18} aria-hidden="true" />
          </button>
        </div>

        <button type="button" className={styles.assetPickerUploadToggle} onClick={() => setUploadOpen(current => !current)}>
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
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
              <div className={`${styles.saveMessage} ${uploadResult.ok ? styles.saveOk : styles.saveError}`} role="status">
                {uploadResult.message}
              </div>
            ) : null}
            <button type="submit" className={styles.primaryButton} disabled={isUploadPending || uploadItems.length === 0 || isUploadOverLimit}>
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
                    {selected ? <span className={styles.assetPickerCheck}>선택</span> : null}
                  </div>
                  <div className={styles.assetPickerCardBody}>
                    <strong>{displayAssetTitle(item, index)}</strong>
                    <span>{item.description || '설명을 추가해 주세요.'}</span>
                    <time dateTime={item.createdAt}>{formatAssetDateTime(item.createdAt)}</time>
                    <div className={styles.assetPickerBadges}>
                      {item.category ? <small>{item.category}</small> : null}
                      {ready ? <small>사용 가능</small> : <small>정보 필요</small>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {message ? (
          <div className={`${styles.saveMessage} ${message.ok ? styles.saveOk : styles.saveError}`} role="status">
            {message.text}
          </div>
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
    </div>
  )
}

function MediaEditorCard({
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
  const [altText, setAltText] = useState(media.altText ?? '')
  const [caption, setCaption] = useState(media.caption ?? '')
  const [sourceLabel, setSourceLabel] = useState(media.sourceLabel ?? '')
  const [privacyChecked] = useState(media.privacyChecked)
  const [promotionConsentChecked] = useState(media.promotionConsentChecked)
  const [usedAsCover, setUsedAsCover] = useState(media.usedAsCover)
  const [rejectionReason, setRejectionReason] = useState(media.rejectionReason ?? '')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const isPublishedMedia = media.usageStatus === 'published'
  const isDisabled = disabled || isPublishedMedia || isPending
  const canApprove = Boolean(altText.trim()) && privacyChecked && promotionConsentChecked && !isDisabled

  const saveMedia = (usageStatus: UpdateBlogMediaPayload['usageStatus']) => {
    setMessage(null)
    startTransition(async () => {
      const result = await updateBlogMedia({
        postId,
        mediaId: media.id,
        altText,
        caption,
        sourceLabel,
        privacyChecked,
        promotionConsentChecked,
        usedAsCover,
        usageStatus,
        rejectionReason,
      })
      setMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        onChanged({
          ...media,
          altText: emptyToNull(altText),
          caption: emptyToNull(caption),
          sourceLabel: emptyToNull(sourceLabel),
          privacyChecked,
          promotionConsentChecked,
          usedAsCover: usageStatus === 'rejected' ? false : usedAsCover,
          usageStatus,
          rejectionReason: usageStatus === 'rejected' ? emptyToNull(rejectionReason) : null,
        })
      }
    })
  }

  return (
    <li className={styles.mediaEditorCard}>
      <div className={styles.mediaFrame}>
        {media.signedPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.signedPreviewUrl} alt={media.altText || media.sourceLabel || '사진 미리보기'} />
        ) : (
          <div className={styles.mediaNoPreview}>
            <ImageIcon size={24} aria-hidden="true" />
            <span>미리보기 없음</span>
          </div>
        )}
      </div>

      <div className={styles.mediaEditorBody}>
        <div className={styles.mediaEditorTop}>
          <div>
            <strong>{media.sourceLabel || '이름 없는 사진'}</strong>
            <p>{formatDateTime(media.createdAt)}</p>
          </div>
          <MediaStatus media={{ ...media, altText, caption, privacyChecked, promotionConsentChecked, usedAsCover }} />
        </div>

        <div className={styles.formStack}>
          <Field label="대체 설명">
            <input value={altText} onChange={event => setAltText(event.target.value)} disabled={isDisabled} />
          </Field>
          <Field label="사진 설명">
            <textarea value={caption} onChange={event => setCaption(event.target.value)} disabled={isDisabled} rows={2} />
          </Field>
          <Field label="사진 이름">
            <input value={sourceLabel} onChange={event => setSourceLabel(event.target.value)} disabled={isDisabled} />
          </Field>
          <div className={styles.mediaChecks}>
            <label className={styles.checkField}>
              <input type="checkbox" checked={usedAsCover} onChange={event => setUsedAsCover(event.target.checked)} disabled={isDisabled || media.usageStatus === 'rejected'} />
              <span>대표 이미지</span>
            </label>
          </div>
          <Field label="제외 사유">
            <textarea value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} disabled={isDisabled} rows={2} />
          </Field>
        </div>

        <div className={styles.mediaActions}>
          <button
            type="button"
            onClick={() => saveMedia(media.usageStatus === 'approved' ? 'approved' : media.usageStatus === 'rejected' ? 'rejected' : 'candidate')}
            disabled={isDisabled}
          >
            <Save size={15} aria-hidden="true" />
            저장
          </button>
          <button type="button" onClick={() => saveMedia('approved')} disabled={!canApprove}>
            <CheckCircle2 size={15} aria-hidden="true" />
            사용 가능
          </button>
          <button type="button" onClick={() => saveMedia('candidate')} disabled={isDisabled}>
            <RotateCcw size={15} aria-hidden="true" />
            확인 필요
          </button>
          <button type="button" onClick={() => saveMedia('rejected')} disabled={isDisabled || !rejectionReason.trim()} className={styles.mediaRejectButton}>
            <XCircle size={15} aria-hidden="true" />
            제외
          </button>
        </div>

        {!canApprove && !isDisabled && (
          <div className={styles.slotNotice}>사용 가능으로 표시하려면 대체 설명, 개인정보 확인, 블로그/홍보 사용 가능 확인이 필요합니다.</div>
        )}
        {message && (
          <div className={`${styles.saveMessage} ${message.ok ? styles.saveOk : styles.saveError}`} role="status">
            {message.text}
          </div>
        )}
      </div>
    </li>
  )
}

function BlockEditor({
  block,
  media,
  index,
  total,
  onChange,
  onPickImage,
  onMove,
  onRemove,
}: {
  block: EditableBlock
  media: BlogEditorMedia[]
  index: number
  total: number
  onChange: (next: EditableBlock) => void
  onPickImage: () => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
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
    <article className={styles.blockCard}>
      <div className={styles.blockTop}>
        <div>
          <span className={styles.blockType}>{BLOCK_LABEL[block.type]}</span>
          <strong>#{index + 1}</strong>
        </div>
        <div className={styles.iconActions}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="위로 이동">
            <ArrowUp size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="아래로 이동">
            <ArrowDown size={15} aria-hidden="true" />
          </button>
          <button type="button" onClick={onRemove} aria-label="블록 삭제" className={styles.dangerIconButton}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {block.type === 'heading' && (
        <div className={styles.blockGrid}>
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
            <input value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} />
          </Field>
        </div>
      )}

      {block.type === 'paragraph' && (
        <Field label="문단">
          <textarea value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} rows={5} />
        </Field>
      )}

      {block.type === 'image' && (
        <div className={styles.blockStack}>
          <div className={styles.blockGrid}>
            <Field label="사진 카드명">
              <input value={block.metadata.photo_slot_label ?? ''} onChange={event => updateMetadata('photo_slot_label', event.target.value)} />
            </Field>
            <Field label="필요한 사진 설명">
              <input value={block.metadata.required_media ?? ''} onChange={event => updateMetadata('required_media', event.target.value)} />
            </Field>
          </div>
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
                <p>{selectedMedia.caption || selectedMedia.altText || '사진 설명을 확인해 주세요.'}</p>
                <MediaStatus media={selectedMedia} />
                <div className={styles.imageBlockActions}>
                  <button type="button" onClick={onPickImage}>
                    <Images size={15} aria-hidden="true" />
                    교체
                  </button>
                  <button type="button" onClick={() => onChange({ ...block, mediaId: null })}>
                    <XCircle size={15} aria-hidden="true" />
                    연결 해제
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.imageBlockEmpty}>
              <ImageIcon size={22} aria-hidden="true" />
              <div>
                <strong>아직 사진이 없습니다.</strong>
                <span>사진보관함에서 본문에 넣을 사진을 선택하세요.</span>
              </div>
              <button type="button" onClick={onPickImage}>
                <Images size={15} aria-hidden="true" />
                사진 선택
              </button>
            </div>
          )}
        </div>
      )}

      {block.type === 'qa' && (
        <div className={styles.blockStack}>
          <Field label="질문">
            <input value={block.text ?? ''} onChange={event => onChange({ ...block, text: event.target.value })} />
          </Field>
          <Field label="답변">
            <textarea value={block.metadata.answer ?? ''} onChange={event => updateMetadata('answer', event.target.value)} rows={4} />
          </Field>
        </div>
      )}

      {block.type === 'cta' && (
        <div className={styles.blockGrid}>
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
}: {
  initialPost: BlogEditorPost
  initialBlocks: BlogEditorBlock[]
  media: BlogEditorMedia[]
  contentAssets: ContentAssetPickerItem[]
  events: BlogEditorEvent[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isAssetPending, startAssetTransition] = useTransition()
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
    lastFactCheckedAt: initialPost.lastFactCheckedAt,
    mediaMissingReason: initialPost.mediaMissingReason,
  })
  const [relatedText, setRelatedText] = useState(initialPost.relatedQuestions.join('\n'))
  const [factCheckedLocal, setFactCheckedLocal] = useState(toDateTimeLocal(initialPost.lastFactCheckedAt))
  const [blocks, setBlocks] = useState<EditableBlock[]>(initialBlocks.map(block => ({
    ...block,
    clientId: block.id,
  })))
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [publishMessage, setPublishMessage] = useState<{ ok: boolean; text: string; issues?: string[] } | null>(null)
  const [editorMedia, setEditorMedia] = useState<BlogEditorMedia[]>(media)
  const [assetPickerTarget, setAssetPickerTarget] = useState<AssetPickerTarget | null>(null)
  const [assetPickerMessage, setAssetPickerMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const isPublished = post.status === 'published'
  const selectableMedia = useMemo(() => editorMedia.filter(item => item.usageStatus !== 'rejected'), [editorMedia])
  const blockMediaIds = useMemo(() => new Set(blocks
    .filter(block => block.type === 'image' && block.mediaId)
    .map(block => block.mediaId as string)
  ), [blocks])
  const blockMedia = useMemo(() => editorMedia.filter(item => blockMediaIds.has(item.id)), [blockMediaIds, editorMedia])

  const blockStats = useMemo(() => ({
    blockCount: blocks.length,
    ctaCount: blocks.filter(block => block.type === 'cta').length,
    imageCount: blocks.filter(block => block.type === 'image').length,
    unlinkedImages: blocks.filter(block => block.type === 'image' && !block.mediaId).length,
  }), [blocks])

  const updatePost = <K extends keyof EditablePost>(key: K, value: EditablePost[K]) => {
    setPost(prev => ({ ...prev, [key]: value }))
  }

  const addBlock = (type: Exclude<BlogBlockType, 'image'>) => {
    setBlocks(prev => [...prev, createBlock(type)])
  }

  const openAssetPicker = (target: AssetPickerTarget) => {
    if (isPublished) return
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
      lastFactCheckedAt: fromDateTimeLocal(factCheckedLocal),
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

  const handleSave = () => {
    setSaveMessage(null)
    startTransition(async () => {
      const result = await saveBlogEditor(buildPayload())
      setSaveMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        router.refresh()
      }
    })
  }

  const handlePublish = () => {
    setPublishMessage(null)
    startTransition(async () => {
      const result = await publishBlogPost(post.id)
      setPublishMessage({ ok: result.ok, text: result.message, issues: result.issues })
      if (result.ok) {
        router.refresh()
      }
    })
  }

  const handleSelectContentAsset = (assets: ContentAssetPickerItem[]) => {
    if (!assetPickerTarget) return
    const selectedAssets = assetPickerTarget.type === 'replace' ? assets.slice(0, 1) : assets
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
        if (assetPickerTarget.type === 'new' && existingBlockMediaIds.has(nextMedia.id)) {
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
        setBlocks(prev => [
          ...prev,
          ...attached.map(item => createBlock('image', {
            mediaId: item.media.id,
            photoSlotLabel: displayAssetTitle(item.asset) || item.asset.category || '',
          })),
        ])
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
          초안 큐
        </Link>
        <div className={styles.titleRow}>
          <div>
            <span className={`${styles.statusBadge} ${styles[`status_${post.status}`]}`}>{STATUS_LABEL[post.status]}</span>
            <h1>{post.title || '제목 없는 초안'}</h1>
            <p>{post.slug}</p>
          </div>
          <div className={styles.headerActions}>
            <Link href={`/admin/platform/blog/${post.id}/preview`} className={styles.previewButton}>
              <Eye size={16} aria-hidden="true" />
              미리보기
            </Link>
            <button type="button" onClick={handleSave} disabled={isPending || isPublished} className={styles.primaryButton}>
              <Save size={16} aria-hidden="true" />
              {isPending ? '저장 중' : '저장'}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPending || isPublished}
              className={styles.publishButton}
              data-testid="publish-blog-post"
            >
              <Rocket size={16} aria-hidden="true" />
              {isPending ? '발행 중' : '발행'}
            </button>
          </div>
        </div>
        {saveMessage && (
          <div className={`${styles.saveMessage} ${saveMessage.ok ? styles.saveOk : styles.saveError}`} role="status">
            {saveMessage.text}
          </div>
        )}
        {publishMessage && (
          <div className={`${styles.saveMessage} ${publishMessage.ok ? styles.saveOk : styles.saveError}`} role="status">
            <p>{publishMessage.text}</p>
            {publishMessage.issues && publishMessage.issues.length > 0 && (
              <ul className={styles.publishIssues}>
                {publishMessage.issues.map(issue => <li key={issue}>{issue}</li>)}
              </ul>
            )}
          </div>
        )}
        {isPublished && (
          <div className={styles.lockNotice} role="alert">
            발행 완료 글은 이 화면에서 읽기 전용입니다. 발행 후 수정은 별도 검수 흐름에서 다룹니다.
          </div>
        )}
      </header>

      <ContentAssetPicker
        open={Boolean(assetPickerTarget)}
        items={contentAssets}
        pending={isAssetPending}
        message={assetPickerMessage}
        multiple={assetPickerTarget?.type === 'new'}
        onClose={() => {
          if (!isAssetPending) setAssetPickerTarget(null)
        }}
        onSelect={handleSelectContentAsset}
        onUploaded={() => router.refresh()}
      />

      <div className={styles.editorLayout}>
        <aside className={styles.gatePanel}>
          <section className={styles.panel}>
            <h2>검수 게이트</h2>
            <ul className={styles.gateList}>
              <GateItem ok={Boolean(post.title.trim() && post.slug.trim())} label="제목/slug" />
              <GateItem ok={Boolean(post.metaDescription?.trim())} label="meta description" />
              <GateItem ok={Boolean(post.targetQuestion?.trim())} label="타깃 질문" />
              <GateItem ok={Boolean(post.summaryAnswer?.trim())} label="요약 답변" />
              <GateItem ok={blockStats.blockCount > 0} label="본문 블록" detail={`${blockStats.blockCount}개`} />
              <GateItem ok={blockStats.ctaCount > 0} label="CTA" detail={`${blockStats.ctaCount}개`} />
              <GateItem ok={!initialPost.gateSummary.brandCheck.forbiddenExpression} label="금지표현" detail={`${initialPost.gateSummary.brandCheck.warningCount}개`} />
              <GateItem ok={Boolean(factCheckedLocal)} label="근거 확인" detail={`${initialPost.gateSummary.sourceEvidenceCount}개 근거`} />
              <GateItem ok={blockStats.unlinkedImages === 0} label="이미지 슬롯 연결" detail={`${blockStats.unlinkedImages}개 미연결`} />
              <GateItem ok={!initialPost.gateSummary.publicAltMissing} label="공개 사진 alt" />
            </ul>
          </section>
        </aside>

        <main className={styles.mainEditor}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <FileText size={17} aria-hidden="true" />
              <h2>기본 정보</h2>
            </div>
            <div className={styles.formGrid}>
              <Field label="제목">
                <input value={post.title} onChange={event => updatePost('title', event.target.value)} disabled={isPublished} />
              </Field>
              <Field label="slug" hint="영문 소문자, 숫자, 하이픈만 사용">
                <input value={post.slug} onChange={event => updatePost('slug', event.target.value)} disabled={isPublished} />
              </Field>
              <Field label="카테고리">
                <select value={post.category} onChange={event => updatePost('category', event.target.value as BlogContentCategory)} disabled={isPublished}>
                  {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="excerpt">
                <textarea value={post.excerpt ?? ''} onChange={event => updatePost('excerpt', event.target.value)} disabled={isPublished} rows={3} />
              </Field>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <FileText size={17} aria-hidden="true" />
              <h2>블록 본문</h2>
            </div>
            <div className={styles.blockToolbar} aria-label="블록 추가">
              <button type="button" onClick={() => addBlock('heading')} disabled={isPublished}><Plus size={15} aria-hidden="true" /> Heading</button>
              <button type="button" onClick={() => addBlock('paragraph')} disabled={isPublished}><Plus size={15} aria-hidden="true" /> Paragraph</button>
              <button type="button" onClick={() => openAssetPicker({ type: 'new' })} disabled={isPublished}><Plus size={15} aria-hidden="true" /> 이미지</button>
              <button type="button" onClick={() => addBlock('qa')} disabled={isPublished}><Plus size={15} aria-hidden="true" /> Q&A</button>
              <button type="button" onClick={() => addBlock('cta')} disabled={isPublished}><Plus size={15} aria-hidden="true" /> CTA</button>
            </div>
            <div className={styles.blockList}>
              {blocks.length === 0 ? (
                <div className={styles.emptyBlocks}>본문 블록이 없습니다. Heading 또는 Paragraph부터 추가하세요.</div>
              ) : (
                blocks.map((block, index) => (
                  <BlockEditor
                    key={block.clientId}
                    block={block}
                    media={selectableMedia}
                    index={index}
                    total={blocks.length}
                    onChange={(next) => updateBlock(block.clientId, next)}
                    onPickImage={() => openAssetPicker({ type: 'replace', clientId: block.clientId })}
                    onMove={(direction) => moveBlock(block.clientId, direction)}
                    onRemove={() => removeBlock(block.clientId)}
                  />
                ))
              )}
            </div>
          </section>
        </main>

        <aside className={styles.sidePanel}>
          <section className={styles.panel}>
            <h2>SEO/AEO</h2>
            <div className={styles.formStack}>
              <Field label="SEO title">
                <input value={post.seoTitle ?? ''} onChange={event => updatePost('seoTitle', event.target.value)} disabled={isPublished} />
              </Field>
              <Field label="meta description">
                <textarea value={post.metaDescription ?? ''} onChange={event => updatePost('metaDescription', event.target.value)} disabled={isPublished} rows={3} />
              </Field>
              <Field label="canonical URL">
                <input value={post.canonicalUrl ?? ''} onChange={event => updatePost('canonicalUrl', event.target.value)} disabled={isPublished} />
              </Field>
              <Field label="primary keyword">
                <input value={post.primaryKeyword ?? ''} onChange={event => updatePost('primaryKeyword', event.target.value)} disabled={isPublished} />
              </Field>
              <Field label="target question">
                <textarea value={post.targetQuestion ?? ''} onChange={event => updatePost('targetQuestion', event.target.value)} disabled={isPublished} rows={2} />
              </Field>
              <Field label="summary answer">
                <textarea value={post.summaryAnswer ?? ''} onChange={event => updatePost('summaryAnswer', event.target.value)} disabled={isPublished} rows={4} />
              </Field>
              <Field label="related questions" hint="한 줄에 하나씩 입력">
                <textarea value={relatedText} onChange={event => setRelatedText(event.target.value)} disabled={isPublished} rows={4} />
              </Field>
              <div className={styles.twoFields}>
                <Field label="service area">
                  <input value={post.serviceArea ?? ''} onChange={event => updatePost('serviceArea', event.target.value)} disabled={isPublished} />
                </Field>
                <Field label="product type">
                  <input value={post.productType ?? ''} onChange={event => updatePost('productType', event.target.value)} disabled={isPublished} />
                </Field>
              </div>
              <Field label="last fact checked">
                <input type="datetime-local" value={factCheckedLocal} onChange={event => setFactCheckedLocal(event.target.value)} disabled={isPublished} />
              </Field>
              <label className={styles.checkField}>
                <input type="checkbox" checked={post.aiCitationReady} onChange={event => updatePost('aiCitationReady', event.target.checked)} disabled={isPublished} />
                <span>AI 답변 인용 친화 필드 준비됨</span>
              </label>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <ImageIcon size={17} aria-hidden="true" />
              <h2>본문 사진</h2>
            </div>
            <div className={styles.uploadBox}>
              <p className={styles.panelHelp}>본문 사진은 이 화면에서 바로 추가하거나 사진보관함에서 여러 장 선택할 수 있습니다.</p>
              <div className={styles.mediaActions}>
                <button type="button" onClick={() => openAssetPicker({ type: 'new' })} disabled={isPublished}>
                  <Images size={15} aria-hidden="true" />
                  사진 추가/선택
                </button>
              </div>
            </div>
            {blockMedia.length > 0 && (
              <ul className={styles.mediaEditorList}>
                {blockMedia.map(item => (
                  <MediaEditorCard
                    key={item.id}
                    postId={post.id}
                    media={item}
                    disabled={isPublished}
                    onChanged={handleMediaChanged}
                  />
                ))}
              </ul>
            )}
            {blockMedia.length === 0 && (
              <div className={styles.emptyBlocks}>아직 본문에 들어간 사진이 없습니다. 가운데 본문 영역에서 + 이미지를 눌러 사진보관함에서 선택하세요.</div>
            )}
          </section>

          <section className={styles.panel}>
            <h2>최근 이벤트</h2>
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
          </section>
        </aside>
      </div>
    </div>
  )
}
