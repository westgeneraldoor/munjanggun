'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent, type RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
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
import type {
  BlogBlockType,
  BlogContentCategory,
  BlogMediaSourceType,
  BlogMediaUsageStatus,
  BlogPostStatus,
} from '@/types/database'
import { normalizeGuideBoxBlock, normalizeLinkButtonBlock } from '@/lib/content-os/blog-body-blocks'
import {
  attachContentAssetToBlogMedia,
  publishBlogPost,
  saveBlogEditor,
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
type AssetPickerTarget =
  | { type: 'new' }
  | { type: 'cover' }
  | { type: 'replace'; clientId: string }
  | { type: 'insertBefore'; clientId: string }
type EditorMode = 'write' | 'seo'
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
  heading: '제목',
  paragraph: '문단',
  image: '사진',
  link_button: '링크 버튼',
  guide_box: '안내 박스',
  qa: 'Q&A',
  cta: '상담 CTA',
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

  return base
}

function cleanQaQuestion(value: string | null | undefined) {
  return (value ?? '')
    .replace(/^(\s*(?:Q|질문)\s*[.:：)]\s*)+/i, '')
    .split(/\s+(?:A|답변)\s*[.:：)]\s*/i)[0]
    ?.trim() ?? ''
}

function cleanQaAnswer(value: string | null | undefined) {
  return (value ?? '').replace(/^(\s*(?:A|답변)\s*[.:：)]\s*)+/i, '').trim()
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
        <div className={`${styles.saveMessage} ${message.ok ? styles.saveOk : styles.saveError}`} role="status">
          {message.text}
        </div>
      )}
    </div>
  )
}

function EditorMobilePreview({
  post,
  blocks,
  media,
  relatedQuestions,
}: {
  post: EditablePost
  blocks: EditableBlock[]
  media: BlogEditorMedia[]
  relatedQuestions: string[]
}) {
  const mediaById = new Map(media.map(item => [item.id, item]))
  const cover = media.find(item => item.usedAsCover && (item.signedPreviewUrl || item.publicUrl)) ?? null
  const coverUrl = cover?.signedPreviewUrl ?? cover?.publicUrl ?? null

  return (
    <div className={styles.mobilePreviewShell} aria-label="모바일 미리보기">
      <div className={styles.mobilePreviewChrome}>
        <span />
      </div>
      <article className={styles.mobilePreviewArticle}>
        <div className={styles.mobilePreviewMeta}>
          <span>{CATEGORY_OPTIONS.find(option => option.value === post.category)?.label ?? '블로그'}</span>
          {post.primaryKeyword && <span>{post.primaryKeyword}</span>}
        </div>
        <h2>{post.title || '제목 없는 초안'}</h2>
        {coverUrl && (
          <figure className={styles.mobilePreviewCover}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={cover?.altText || cover?.sourceLabel || '대표사진'} />
          </figure>
        )}
        {post.summaryAnswer && <p className={styles.mobilePreviewLead}>{post.summaryAnswer}</p>}
        {post.excerpt && <p className={styles.mobilePreviewExcerpt}>{post.excerpt}</p>}
        <div className={styles.mobilePreviewBlocks}>
          {blocks.length === 0 ? (
            <p className={styles.mobilePreviewEmpty}>본문을 작성하면 여기에 바로 보입니다.</p>
          ) : blocks.map(block => {
            if (block.type === 'heading') {
              return <h3 key={block.clientId}>{block.text || '소제목'}</h3>
            }
            if (block.type === 'paragraph') {
              return <p key={block.clientId}>{block.text || '문단 내용'}</p>
            }
            if (block.type === 'image') {
              const item = block.mediaId ? mediaById.get(block.mediaId) : null
              const imageUrl = item?.signedPreviewUrl ?? item?.publicUrl ?? null
              return (
                <figure key={block.clientId}>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={item?.altText || item?.sourceLabel || '본문 사진'} />
                  ) : (
                    <div className={styles.mobilePreviewImageEmpty}>사진 없음</div>
                  )}
                  {item?.caption && <figcaption>{item.caption}</figcaption>}
                </figure>
              )
            }
            if (block.type === 'link_button') {
              const link = normalizeLinkButtonBlock(block)
              if (!link) return null

              return (
                <div key={block.clientId} className={styles.mobilePreviewLinkButton}>
                  <span>이어 확인하기</span>
                  {link.description && <p>{link.description}</p>}
                  <em>
                    {link.label}
                    <ArrowRight size={14} aria-hidden="true" />
                  </em>
                </div>
              )
            }
            if (block.type === 'guide_box') {
              const guide = normalizeGuideBoxBlock(block)
              if (!guide) return null

              return (
                <div key={block.clientId} className={`${styles.mobilePreviewGuideBox} ${styles[`mobilePreviewGuide_${guide.tone}`]}`}>
                  <span>{guide.label}</span>
                  {guide.title && <strong>{guide.title}</strong>}
                  <p>{guide.body}</p>
                </div>
              )
            }
            if (block.type === 'qa') {
              const question = cleanQaQuestion(block.text)
              const answer = cleanQaAnswer(block.metadata.answer)

              return (
                <div key={block.clientId} className={styles.mobilePreviewQa}>
                  <strong>Q. {question || '질문'}</strong>
                  <p>{answer || '답변'}</p>
                </div>
              )
            }
            if (block.type === 'cta') {
              return (
                <div key={block.clientId} className={styles.mobilePreviewCta}>
                  <div>
                    <span>무료 방문 실측견적 상담</span>
                    <strong>{block.text || '우리 집에 맞는 문과 시공 조건을 먼저 확인해보세요.'}</strong>
                  </div>
                  <em>
                    상담 신청
                    <ArrowRight size={14} aria-hidden="true" />
                  </em>
                </div>
              )
            }
            return null
          })}
        </div>
        {relatedQuestions.length > 0 && (
          <section className={styles.mobilePreviewRelated}>
            <strong>함께 확인할 질문</strong>
            <ul>
              {relatedQuestions.map(question => <li key={question}>{question}</li>)}
            </ul>
          </section>
        )}
      </article>
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
          <span className={styles.blockType}>{BLOCK_LABEL[block.type]}</span>
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
  const [editorMode, setEditorMode] = useState<EditorMode>('write')
  const titleRef = useRef<HTMLInputElement>(null)
  const slugRef = useRef<HTMLInputElement>(null)
  const summaryAnswerRef = useRef<HTMLTextAreaElement>(null)
  const metaDescriptionRef = useRef<HTMLTextAreaElement>(null)
  const targetQuestionRef = useRef<HTMLTextAreaElement>(null)
  const factCheckedRef = useRef<HTMLInputElement>(null)
  const coverPickerRef = useRef<HTMLDivElement>(null)
  const blockToolbarRef = useRef<HTMLDivElement>(null)
  const blockListRef = useRef<HTMLDivElement>(null)

  const isPublished = post.status === 'published'
  const selectableMedia = useMemo(() => editorMedia.filter(item => item.usageStatus !== 'rejected'), [editorMedia])
  const relatedQuestionsForPreview = useMemo(
    () => relatedText.split('\n').map(item => item.trim()).filter(Boolean),
    [relatedText],
  )
  const coverMedia = selectableMedia.find(item => item.usedAsCover) ?? null
  const coverMediaUrl = coverMedia?.signedPreviewUrl ?? coverMedia?.publicUrl ?? null

  const blockStats = useMemo(() => ({
    blockCount: blocks.length,
    ctaCount: blocks.filter(block => block.type === 'cta').length,
    imageCount: blocks.filter(block => block.type === 'image').length,
    unlinkedImages: blocks.filter(block => block.type === 'image' && !block.mediaId).length,
  }), [blocks])
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
      ok: Boolean(coverMedia),
      label: '대표사진',
      detail: coverMedia ? undefined : '선택 필요',
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
    {
      key: 'fact',
      ok: Boolean(factCheckedLocal),
      label: '근거',
      detail: `${initialPost.gateSummary.sourceEvidenceCount}개`,
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
    if (key === 'fact') {
      jumpToSeoField(factCheckedRef)
    }
  }

  const updatePost = <K extends keyof EditablePost>(key: K, value: EditablePost[K]) => {
    setPost(prev => ({ ...prev, [key]: value }))
  }

  const addBlock = (type: Exclude<BlogBlockType, 'image'>) => {
    setBlocks(prev => [...prev, createBlock(type)])
  }

  const openAssetPicker = (target: AssetPickerTarget) => {
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
            <button type="button" onClick={handleSave} disabled={isPending} className={styles.primaryButton}>
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
              {isPublished ? '발행완료' : isPending ? '발행 중' : '발행'}
            </button>
          </div>
        </div>
        <div className={styles.editorWorkbenchBar}>
          <div className={styles.editorModeTabs} aria-label="편집 모드">
            <button
              type="button"
              className={editorMode === 'write' ? styles.editorModeActive : ''}
              aria-pressed={editorMode === 'write'}
              onClick={() => setEditorMode('write')}
            >
              작성란
            </button>
            <button
              type="button"
              className={editorMode === 'seo' ? styles.editorModeActive : ''}
              aria-pressed={editorMode === 'seo'}
              onClick={() => setEditorMode('seo')}
            >
              SEO/AEO
            </button>
          </div>
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
          <div className={styles.lockNotice} role="status">
            발행된 글입니다. 저장하면 공개 블로그 화면에도 반영됩니다.
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

      <div className={styles.editorLayout}>
        <main className={styles.mainEditor}>
          {editorMode === 'write' && (
          <>
          <section className={styles.panel}>
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
                    <button type="button" onClick={() => openAssetPicker({ type: 'cover' })} disabled={isAssetPending}>
                      <Images size={15} aria-hidden="true" />
                      교체
                    </button>
                    <button type="button" onClick={handleRemoveCover} disabled={isAssetPending}>
                      <XCircle size={15} aria-hidden="true" />
                      제거
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.coverEmptyButton} onClick={() => openAssetPicker({ type: 'cover' })} disabled={isAssetPending}>
                  <ImageIcon size={18} aria-hidden="true" />
                  대표사진 선택
                </button>
              )}
            </div>
          </section>

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
                    disabled={false}
                    onChange={(next) => updateBlock(block.clientId, next)}
                    onInsertImageBefore={() => openAssetPicker({ type: 'insertBefore', clientId: block.clientId })}
                    onPickImage={() => openAssetPicker({ type: 'replace', clientId: block.clientId })}
                    onMediaChanged={handleMediaChanged}
                    onMove={(direction) => moveBlock(block.clientId, direction)}
                    onRemove={() => removeBlock(block.clientId)}
                  />
                ))
              )}
            </div>
          </section>
          </>
          )}

          {editorMode === 'seo' && (
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
              <Field label="사실 확인일">
                <input ref={factCheckedRef} type="datetime-local" value={factCheckedLocal} onChange={event => setFactCheckedLocal(event.target.value)} />
              </Field>
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
          )}
        </main>

        <aside className={styles.sidePanel} aria-label="모바일 미리보기">
          <div className={styles.mobilePreviewDock}>
            <EditorMobilePreview post={post} blocks={blocks} media={selectableMedia} relatedQuestions={relatedQuestionsForPreview} />
          </div>
        </aside>
      </div>
    </div>
  )
}
