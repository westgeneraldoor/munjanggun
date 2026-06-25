'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
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
  Plus,
  RotateCcw,
  Rocket,
  Save,
  Trash2,
  Upload,
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
  publishBlogPost,
  saveBlogEditor,
  updateBlogMedia,
  uploadBlogMedia,
  type SaveBlogEditorPayload,
  type UpdateBlogMediaPayload,
} from './actions'
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
  image: 'Image Slot',
  qa: 'Q&A',
  cta: 'CTA',
}

const MEDIA_STATUS_LABEL: Record<BlogMediaUsageStatus, string> = {
  candidate: '후보',
  approved: '승인',
  published: '공개',
  rejected: '거절',
}

function emptyToNull(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

function createBlock(type: BlogBlockType): EditableBlock {
  const clientId = `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const base = {
    id: '',
    clientId,
    type,
    headingLevel: type === 'heading' ? 2 : null,
    text: '',
    mediaId: null,
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
    return { ...base, metadata: { photo_slot_label: '', required_media: '' } }
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
      <span>{media.usedAsCover ? '대표' : '본문'}</span>
      <span>{media.altText ? 'alt 있음' : 'alt 없음'}</span>
      <span>{media.privacyChecked ? '개인정보 확인' : '개인정보 미확인'}</span>
      <span>{media.promotionConsentChecked ? '홍보동의 확인' : '홍보동의 미확인'}</span>
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
  onChanged: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [altText, setAltText] = useState(media.altText ?? '')
  const [caption, setCaption] = useState(media.caption ?? '')
  const [sourceLabel, setSourceLabel] = useState(media.sourceLabel ?? '')
  const [privacyChecked, setPrivacyChecked] = useState(media.privacyChecked)
  const [promotionConsentChecked, setPromotionConsentChecked] = useState(media.promotionConsentChecked)
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
      if (result.ok) onChanged()
    })
  }

  return (
    <li className={styles.mediaEditorCard}>
      <div className={styles.mediaFrame}>
        {media.signedPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.signedPreviewUrl} alt={media.altText || media.sourceLabel || 'blog media preview'} />
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
            <strong>{media.sourceLabel || media.id.slice(0, 8)}</strong>
            <p>{formatDateTime(media.createdAt)}</p>
          </div>
          <MediaStatus media={{ ...media, altText, caption, privacyChecked, promotionConsentChecked, usedAsCover }} />
        </div>

        <div className={styles.formStack}>
          <Field label="alt text">
            <input value={altText} onChange={event => setAltText(event.target.value)} disabled={isDisabled} />
          </Field>
          <Field label="caption">
            <textarea value={caption} onChange={event => setCaption(event.target.value)} disabled={isDisabled} rows={2} />
          </Field>
          <Field label="source label">
            <input value={sourceLabel} onChange={event => setSourceLabel(event.target.value)} disabled={isDisabled} />
          </Field>
          <div className={styles.mediaChecks}>
            <label className={styles.checkField}>
              <input type="checkbox" checked={privacyChecked} onChange={event => setPrivacyChecked(event.target.checked)} disabled={isDisabled} />
              <span>개인정보 확인</span>
            </label>
            <label className={styles.checkField}>
              <input type="checkbox" checked={promotionConsentChecked} onChange={event => setPromotionConsentChecked(event.target.checked)} disabled={isDisabled} />
              <span>홍보동의 확인</span>
            </label>
            <label className={styles.checkField}>
              <input type="checkbox" checked={usedAsCover} onChange={event => setUsedAsCover(event.target.checked)} disabled={isDisabled || media.usageStatus === 'rejected'} />
              <span>대표 이미지</span>
            </label>
          </div>
          <Field label="rejection reason">
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
            승인
          </button>
          <button type="button" onClick={() => saveMedia('candidate')} disabled={isDisabled}>
            <RotateCcw size={15} aria-hidden="true" />
            후보
          </button>
          <button type="button" onClick={() => saveMedia('rejected')} disabled={isDisabled || !rejectionReason.trim()} className={styles.mediaRejectButton}>
            <XCircle size={15} aria-hidden="true" />
            거절
          </button>
        </div>

        {!canApprove && !isDisabled && (
          <div className={styles.slotNotice}>승인하려면 alt, 개인정보 확인, 홍보동의 확인이 모두 필요합니다.</div>
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
  onMove,
  onRemove,
}: {
  block: EditableBlock
  media: BlogEditorMedia[]
  index: number
  total: number
  onChange: (next: EditableBlock) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}) {
  const selectedMedia = block.mediaId ? media.find(item => item.id === block.mediaId) ?? null : null

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
            <Field label="사진 슬롯명">
              <input value={block.metadata.photo_slot_label ?? ''} onChange={event => updateMetadata('photo_slot_label', event.target.value)} />
            </Field>
            <Field label="필요 사진 유형">
              <input value={block.metadata.required_media ?? ''} onChange={event => updateMetadata('required_media', event.target.value)} />
            </Field>
          </div>
          <Field label="연결 media">
            <select
              value={block.mediaId ?? ''}
              onChange={event => onChange({ ...block, mediaId: emptyToNull(event.target.value) })}
            >
              <option value="">선택 필요</option>
              {media.map(item => (
                <option key={item.id} value={item.id}>
                  {item.sourceLabel || item.id.slice(0, 8)} · {MEDIA_STATUS_LABEL[item.usageStatus]} · {item.altText || 'alt 없음'}
                </option>
              ))}
            </select>
          </Field>
          {selectedMedia ? (
            <div className={styles.mediaPreview}>
              <div>
                <strong>{selectedMedia.sourceLabel || selectedMedia.id}</strong>
                <p>{selectedMedia.caption || 'caption 없음'}</p>
              </div>
              <MediaStatus media={selectedMedia} />
            </div>
          ) : (
            <div className={styles.slotNotice}>이미지 블록은 승인 전 후보 media도 연결할 수 있습니다. public 승격은 PR-06에서 처리합니다.</div>
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
  events,
}: {
  initialPost: BlogEditorPost
  initialBlocks: BlogEditorBlock[]
  media: BlogEditorMedia[]
  events: BlogEditorEvent[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMediaPending, startMediaTransition] = useTransition()
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
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadSourceLabel, setUploadSourceLabel] = useState('')
  const [uploadInputKey, setUploadInputKey] = useState(0)
  const [mediaMessage, setMediaMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const uploadBoxRef = useRef<HTMLDivElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  const isPublished = post.status === 'published'
  const selectableMedia = useMemo(() => media.filter(item => item.usageStatus !== 'rejected'), [media])
  const canAddImage = selectableMedia.length > 0

  const blockStats = useMemo(() => ({
    blockCount: blocks.length,
    ctaCount: blocks.filter(block => block.type === 'cta').length,
    imageCount: blocks.filter(block => block.type === 'image').length,
    unlinkedImages: blocks.filter(block => block.type === 'image' && !block.mediaId).length,
  }), [blocks])

  const updatePost = <K extends keyof EditablePost>(key: K, value: EditablePost[K]) => {
    setPost(prev => ({ ...prev, [key]: value }))
  }

  const addBlock = (type: BlogBlockType) => {
    setBlocks(prev => [...prev, createBlock(type)])
  }

  const handleImageBlockIntent = () => {
    if (canAddImage) {
      addBlock('image')
      return
    }

    setMediaMessage({
      ok: false,
      text: '이미지 블록을 추가하려면 먼저 private 후보 이미지를 업로드해주세요.',
    })
    uploadBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => uploadInputRef.current?.focus(), 250)
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

  const handleUploadMedia = () => {
    setMediaMessage(null)

    if (!uploadFile) {
      setMediaMessage({ ok: false, text: '업로드할 이미지 파일을 선택해주세요.' })
      return
    }

    startMediaTransition(async () => {
      const formData = new FormData()
      formData.set('postId', post.id)
      formData.set('sourceLabel', uploadSourceLabel)
      formData.set('file', uploadFile)

      const result = await uploadBlogMedia(formData)
      setMediaMessage({ ok: result.ok, text: result.message })
      if (result.ok) {
        setUploadFile(null)
        setUploadSourceLabel('')
        setUploadInputKey(prev => prev + 1)
        router.refresh()
      }
    })
  }

  const handleMediaChanged = () => {
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
            발행 완료 글은 이번 PR에서 읽기 전용입니다. published 전환과 발행 후 수정은 별도 server action에서 다룹니다.
          </div>
        )}
      </header>

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
              <button type="button" onClick={handleImageBlockIntent} disabled={isPublished}><Plus size={15} aria-hidden="true" /> Image</button>
              <button type="button" onClick={() => addBlock('qa')} disabled={isPublished}><Plus size={15} aria-hidden="true" /> Q&A</button>
              <button type="button" onClick={() => addBlock('cta')} disabled={isPublished}><Plus size={15} aria-hidden="true" /> CTA</button>
            </div>
            {!canAddImage && (
              <div className={styles.slotNotice}>이미지 블록은 먼저 private 후보 이미지를 업로드한 뒤 연결할 수 있습니다. Image 버튼을 누르면 업로드 영역으로 이동합니다.</div>
            )}
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
              <h2>이미지 슬롯</h2>
            </div>
            <div className={styles.uploadBox} ref={uploadBoxRef}>
              <Field label="private 후보 업로드" hint="private 후보 저장소에만 저장됩니다. public 승격은 PR-06 범위입니다.">
                <input
                  key={uploadInputKey}
                  ref={uploadInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={event => setUploadFile(event.target.files?.[0] ?? null)}
                  disabled={isPublished || isMediaPending}
                />
              </Field>
              <Field label="source label">
                <input
                  type="text"
                  value={uploadSourceLabel}
                  onChange={event => setUploadSourceLabel(event.target.value)}
                  disabled={isPublished || isMediaPending}
                  placeholder="예: 현장 후보 사진"
                />
              </Field>
              <button type="button" onClick={handleUploadMedia} disabled={isPublished || isMediaPending || !uploadFile} className={styles.mediaUploadButton}>
                <Upload size={15} aria-hidden="true" />
                {isMediaPending ? '업로드 중' : '후보 추가'}
              </button>
              {mediaMessage && (
                <div className={`${styles.saveMessage} ${mediaMessage.ok ? styles.saveOk : styles.saveError}`} role="status">
                  {mediaMessage.text}
                </div>
              )}
            </div>
            {media.length > 0 && (
              <ul className={styles.mediaEditorList}>
                {media.map(item => (
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
            {media.length === 0 ? (
              <div className={styles.emptyBlocks}>연결된 blog_media가 없습니다. private 후보 이미지를 먼저 추가하세요.</div>
            ) : (
              <ul className={styles.mediaList}>
                {media.map(item => (
                  <li key={item.id} className={styles.mediaCard}>
                    <div>
                      <strong>{item.sourceLabel || item.id}</strong>
                      <p>{item.caption || 'caption 없음'}</p>
                    </div>
                    <MediaStatus media={item} />
                    {item.rejectionReason && <small className={styles.rejection}>{item.rejectionReason}</small>}
                  </li>
                ))}
              </ul>
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
