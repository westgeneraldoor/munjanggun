'use client'

/* eslint-disable @next/next/no-img-element -- 사진보관함은 서버에서 이미 정리한 WebP/썸네일만 렌더링합니다. */

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  Images,
  Plus,
  UploadCloud,
  X,
} from 'lucide-react'
import {
  PlatformButton,
  PlatformCheckbox,
  PlatformField,
  PlatformIconButton,
  PlatformModal,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSegmentedControl,
  PlatformSelect,
  PlatformStatePanel,
  PlatformStatusBadge,
} from '@/components/platform/ui'
import {
  archiveContentAssets,
  restoreContentAssets,
  updateContentAsset,
  uploadContentAssets,
  type ArchiveContentAssetsResult,
  type ContentAssetReference,
  type UploadContentAssetsResult,
} from './actions'
import styles from './assets.module.css'

type AssetFileSummary = {
  url: string | null
  width: number | null
  height: number | null
  sizeBytes: number | null
  ready: boolean
} | null

export type ContentAssetLibraryItem = {
  id: string
  libraryState: 'available' | 'hidden' | 'archived'
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
  usedCount: number
  updatedAt: string
  createdAt: string
  thumbnail: AssetFileSummary
  web: AssetFileSummary
}

type LibraryView = 'active' | 'archived'

export type ContentAssetTagOption = {
  id: string
  name: string
}

type DetailForm = {
  title: string
  description: string
  category: string
  tags: string
  productType: string
  spaceType: string
  region: string
  usagePurpose: string
  privacyChecked: boolean
  promotionConsentChecked: boolean
}

type FilterKey = 'category' | 'productType' | 'spaceType' | 'region' | 'usagePurpose'
type SelectedUpload = {
  id: string
  file: File
  previewUrl: string
  title: string
  description: string
}

const FILTER_LABELS: Record<FilterKey, string> = {
  category: '분류',
  productType: '제품군',
  spaceType: '공간',
  region: '지역',
  usagePurpose: '사용 목적',
}

const MAX_UPLOAD_TOTAL_BYTES = 120 * 1024 * 1024

function fileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || fileName
}

function displayAssetTitle(item: ContentAssetLibraryItem, index = 0) {
  const title = textValue(item.title)
  return title || item.description?.trim() || `사진 ${index + 1}`
}

function formatDateTime(value: string) {
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

function formatBytes(value: number | null | undefined) {
  if (!value) return '용량 확인 중'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`
  return `${(value / (1024 * 1024)).toFixed(1)}MB`
}

function textValue(value: string | null) {
  return value?.trim() || ''
}

function itemToForm(item: ContentAssetLibraryItem): DetailForm {
  return {
    title: textValue(item.title),
    description: textValue(item.description),
    category: textValue(item.category),
    tags: item.tags.join(', '),
    productType: textValue(item.productType),
    spaceType: textValue(item.spaceType),
    region: textValue(item.region),
    usagePurpose: textValue(item.usagePurpose),
    privacyChecked: item.privacyChecked,
    promotionConsentChecked: item.promotionConsentChecked,
  }
}

function splitTags(value: string) {
  return [...new Set(value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean))]
}

function includesSearch(item: ContentAssetLibraryItem, search: string) {
  if (!search) return true
  const haystack = [
    item.title,
    item.description,
    item.category,
    item.productType,
    item.spaceType,
    item.region,
    item.usagePurpose,
    ...item.tags,
  ].filter(Boolean).join(' ').toLowerCase()

  return haystack.includes(search.toLowerCase())
}

function optionValues(items: ContentAssetLibraryItem[], key: FilterKey) {
  return [...new Set(items
    .map(item => item[key])
    .filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, 'ko-KR'))
}

function uploadId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function UploadPanel() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedUploads, setSelectedUploads] = useState<SelectedUpload[]>([])
  const selectedUploadsRef = useRef<SelectedUpload[]>([])
  const [result, setResult] = useState<UploadContentAssetsResult | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [promotionConsentChecked, setPromotionConsentChecked] = useState(false)
  const totalBytes = selectedUploads.reduce((sum, item) => sum + item.file.size, 0)
  const isOverLimit = totalBytes > MAX_UPLOAD_TOTAL_BYTES

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedUploads(current => {
      current.forEach(item => URL.revokeObjectURL(item.previewUrl))
      return Array.from(event.target.files ?? []).map(file => ({
        id: uploadId(file),
        file,
        previewUrl: URL.createObjectURL(file),
        title: fileTitle(file.name),
        description: '',
      }))
    })
    setResult(null)
    setUploadProgress(0)
  }

  function updateSelectedUpload(id: string, patch: Partial<Pick<SelectedUpload, 'title' | 'description'>>) {
    setSelectedUploads(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  useEffect(() => {
    selectedUploadsRef.current = selectedUploads
  }, [selectedUploads])

  useEffect(() => {
    return () => {
      selectedUploadsRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  useEffect(() => {
    if (!isPending) return

    const timer = window.setInterval(() => {
      setUploadProgress(current => Math.min(92, current + Math.max(2, Math.round((92 - current) / 7))))
    }, 450)

    return () => window.clearInterval(timer)
  }, [isPending])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set('fileMeta', JSON.stringify(selectedUploads.map(item => ({
      name: item.file.name,
      size: item.file.size,
      lastModified: item.file.lastModified,
      title: item.title,
      description: item.description,
    }))))

    setUploadProgress(8)

    startTransition(async () => {
      const nextResult = await uploadContentAssets(formData)
      setUploadProgress(100)
      setResult(nextResult)
      if (nextResult.ok) {
        selectedUploads.forEach(item => URL.revokeObjectURL(item.previewUrl))
        setSelectedUploads([])
        setPrivacyChecked(false)
        setPromotionConsentChecked(false)
        form.reset()
        router.refresh()
      }
    })
  }

  return (
    <PlatformPanel className={styles.uploadPanel}>
      <form className={styles.uploadForm} onSubmit={handleSubmit}>
      <div className={styles.uploadDrop}>
        <UploadCloud aria-hidden="true" size={24} />
        <div>
          <strong>여러 장 업로드</strong>
          <span>사진을 선택하면 웹에 맞게 정리해서 보관합니다. 한 번에 합계 120MB까지 가능합니다.</span>
        </div>
        <input
          type="file"
          name="files"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          multiple
          onChange={handleFileChange}
          disabled={isPending}
          aria-label="사진 파일 선택"
        />
      </div>

      {selectedUploads.length > 0 ? (
        <>
          <div className={isOverLimit ? styles.limitWarning : styles.limitInfo}>
            선택한 사진 {selectedUploads.length}장, 합계 {formatBytes(totalBytes)}
          </div>
          <ul className={styles.selectedPreviews} aria-label="선택한 사진 미리보기">
            {selectedUploads.map(item => (
              <li key={item.id}>
                <div className={styles.selectedPreviewImage}>
                  <img src={item.previewUrl} alt={item.title || item.file.name} />
                </div>
                <div className={styles.selectedPreviewBody}>
                  <PlatformField
                    label="사진 이름"
                    value={item.title}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateSelectedUpload(item.id, { title: event.target.value })}
                    placeholder="예: 현관 중문 설치 후"
                  />
                  <PlatformField
                    label="짧은 설명"
                    multiline
                    value={item.description}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateSelectedUpload(item.id, { description: event.target.value })}
                    rows={2}
                    placeholder="예: 좁은 현관에 맞춘 3연동 중문"
                  />
                  <small>{formatBytes(item.file.size)}</small>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <details className={styles.optionalFields} open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
        <summary>
          <span>선택 정보</span>
          <small>분류, 태그, 제품군, 공간, 지역, 사용 목적은 나중에 수정해도 됩니다.</small>
        </summary>
        <div className={styles.uploadFields}>
          <PlatformField label="분류" name="category" placeholder="예: 중문, 현관, 시공후" />
          <PlatformField label="태그" name="tags" placeholder="예: 3연동, 화이트, 좁은현관" />
          <PlatformField label="제품군" name="productType" placeholder="예: 중문" />
          <PlatformField label="공간" name="spaceType" placeholder="예: 현관" />
          <PlatformField label="지역" name="region" placeholder="예: 동탄" />
          <PlatformField label="사용 목적" name="usagePurpose" placeholder="예: 블로그, 상담자료" />
        </div>
      </details>

      <fieldset className={styles.uploadReview}>
        <legend>사진 사용 전 확인</legend>
        <PlatformCheckbox
          name="privacyChecked"
          checked={privacyChecked}
          onChange={event => setPrivacyChecked(event.target.checked)}
          disabled={isPending}
        >
          고객 정보·주소·연락처 등 민감정보가 보이지 않는지 확인했습니다.
        </PlatformCheckbox>
        <PlatformCheckbox
          name="promotionConsentChecked"
          checked={promotionConsentChecked}
          onChange={event => setPromotionConsentChecked(event.target.checked)}
          disabled={isPending}
        >
          블로그·홍보용으로 사용할 수 있는 사진인지 확인했습니다.
        </PlatformCheckbox>
      </fieldset>

      {isPending || uploadProgress > 0 ? (
        <div className={styles.uploadProgress} role="status" aria-live="polite">
          <div className={styles.uploadProgressTop}>
            <strong>{isPending ? '사진을 정리하고 있습니다' : '사진 정리 완료'}</strong>
            <span>{uploadProgress}%</span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
          </div>
          <p>원본 보관, 웹용 변환, 썸네일 생성을 처리 중입니다. 사진이 많으면 잠시 걸릴 수 있습니다.</p>
        </div>
      ) : null}

      <div className={styles.uploadActions}>
        <PlatformButton
          type="submit"
          isLoading={isPending}
          loadingLabel="사진 보관 중…"
          disabled={selectedUploads.length === 0 || isOverLimit || !privacyChecked || !promotionConsentChecked}
        >
          <UploadCloud aria-hidden="true" size={16} />
          사진 보관
        </PlatformButton>
      </div>

      {result ? (
        <div className={styles.resultGroup}>
          <PlatformStatePanel
            tone={result.ok ? 'success' : 'error'}
            title={result.message}
            description={result.items.length > 0 ? `${result.items.length}개 파일의 처리 결과를 확인해 주세요.` : undefined}
          />
          {result.items.length > 0 ? (
            <ul className={styles.resultItems} aria-label="파일별 업로드 결과">
              {result.items.map((item, index) => (
                <li key={`${item.fileName}-${index}`}>
                  {item.ok ? <CheckCircle2 aria-hidden="true" size={14} /> : <X aria-hidden="true" size={14} />}
                  <span>{fileTitle(item.fileName)}: {item.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      </form>
    </PlatformPanel>
  )
}

function AssetThumbnail({ item }: { item: ContentAssetLibraryItem }) {
  const image = item.thumbnail?.url ?? item.web?.url
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [failureReason, setFailureReason] = useState('네트워크 또는 브라우저에서 미리보기를 열지 못했습니다.')

  async function explainImageFailure() {
    if (!image) return
    try {
      const response = await fetch(image, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
      if (response.status === 401 || response.status === 403) setFailureReason('관리자 인증 또는 권한을 다시 확인해 주세요.')
      else if (response.status === 404) setFailureReason('안전한 미리보기 파일을 찾지 못했습니다. 변환 상태를 확인해 주세요.')
      else if (response.status >= 500) setFailureReason('미리보기 서버가 일시적으로 응답하지 않습니다.')
      else setFailureReason('브라우저가 미리보기 응답을 표시하지 못했습니다.')
    } catch {
      setFailureReason('네트워크 연결을 확인한 뒤 다시 시도해 주세요.')
    }
  }

  if (!image || (!item.thumbnail?.ready && !item.web?.ready)) {
    return (
      <div className={styles.thumbPlaceholder} role="status">
        <ImageIcon aria-hidden="true" size={28} />
        <span>미리보기 준비 중</span>
      </div>
    )
  }

  if (failed) {
    return (
      <div className={styles.previewFailure} role="status">
        <AlertTriangle aria-hidden="true" size={20} />
        <span>안전한 미리보기를 불러오지 못했습니다.</span>
        <small>{failureReason}</small>
        <PlatformButton type="button" variant="secondary" size="sm" onClick={() => { setFailed(false); setAttempt(value => value + 1); setFailureReason('다시 미리보기를 요청하고 있습니다.') }}>다시 시도</PlatformButton>
      </div>
    )
  }

  return (
    <img
      src={`${image}${image.includes('?') ? '&' : '?'}retry=${attempt}`}
      alt={item.title || item.description || '보관함 사진'}
      loading="lazy"
      className={styles.thumbImage}
      onError={() => { setFailed(true); void explainImageFailure() }}
    />
  )
}

function referenceStatus(status: string) {
  const labels: Record<string, string> = { draft: '초안', reviewing: '검토', approved: '승인', published: '발행', archived: '보관', linked: '연결됨' }
  return labels[status] ?? status
}

function referenceLocation(location: string) {
  const labels: Record<string, string> = { cover: '대표사진', body: '본문', blog_media: '연결된 사진' }
  return labels[location] ?? location
}

function ArchiveDialog({
  items,
  restore,
  onClose,
  onComplete,
}: {
  items: ContentAssetLibraryItem[]
  restore: boolean
  onClose: () => void
  onComplete: (result: ArchiveContentAssetsResult) => void
}) {
  const [result, setResult] = useState<ArchiveContentAssetsResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const blocked = result?.results.filter(item => item.reason === 'in_use') ?? []
  const changed = result?.results.filter(item => item.changed) ?? []

  function submit() {
    startTransition(async () => {
      const next = restore
        ? await restoreContentAssets(items.map(item => item.id))
        : await archiveContentAssets(items.map(item => item.id))
      setResult(next)
      onComplete(next)
    })
  }

  return (
    <PlatformModal isOpen title={restore ? '사진 복원' : '사진 보관'} onClose={onClose} closeDisabled={isPending}>
      <PlatformPanel as="section" className={styles.archiveDialog}>
        <h2 id="asset-archive-title">{restore ? '사진 보관함에서 복원' : '사진 보관함으로 이동'}</h2>
        {!result ? (
          <>
            <p>{restore ? `${items.length}장을 다시 사진보관함에 표시합니다.` : `${items.length}장의 사용처를 서버에서 다시 확인합니다. 사용 중인 사진은 보관하지 않으며, 사진 파일은 삭제하지 않습니다.`}</p>
            <div className={styles.dialogActions}>
              <PlatformButton type="button" variant="secondary" onClick={onClose} disabled={isPending}>취소</PlatformButton>
              <PlatformButton type="button" variant={restore ? 'primary' : 'danger'} onClick={submit} isLoading={isPending} loadingLabel="확인 중…">{restore ? '복원' : '사용처 확인 후 보관'}</PlatformButton>
            </div>
          </>
        ) : (
          <>
            <p role="status" aria-live="polite">{result.message}</p>
            {changed.length > 0 ? <p className={styles.resultSuccess}>{changed.length}장은 안전하게 처리했습니다.</p> : null}
            {blocked.length > 0 ? (
              <section id="asset-usage-results" tabIndex={-1} className={styles.blockedReferences} aria-label="사용 중인 사진">
                <h3>사용 중인 사진은 보관할 수 없습니다</h3>
                {blocked.map(item => {
                  const asset = items.find(candidate => candidate.id === item.assetId)
                  return (
                    <div key={item.assetId} className={styles.blockedReference}>
                      <strong>{asset ? displayAssetTitle(asset) : '사진'}</strong>
                      <ul>{item.references.map((reference: ContentAssetReference, index) => <li key={`${reference.postId ?? 'linked'}-${reference.location}-${index}`}>{reference.postTitle} · {referenceStatus(reference.status)} · {referenceLocation(reference.location)}</li>)}</ul>
                    </div>
                  )
                })}
                <p>사용처를 확인해 연결을 해제한 뒤 다시 시도해 주세요.</p>
              </section>
            ) : null}
            <div className={styles.dialogActions}>
              {blocked.length > 0 ? <PlatformButton type="button" variant="secondary" onClick={() => document.getElementById('asset-usage-results')?.focus()}>사용처 보기</PlatformButton> : null}
              <PlatformButton type="button" onClick={onClose}>{blocked.length > 0 ? '취소' : '확인'}</PlatformButton>
            </div>
          </>
        )}
      </PlatformPanel>
    </PlatformModal>
  )
}

function AssetDetailPanel({
  item,
  mode,
  onClose,
  onRequestLifecycle,
}: {
  item: ContentAssetLibraryItem
  mode: 'desktop' | 'mobile'
  onClose?: () => void
  onRequestLifecycle: (item: ContentAssetLibraryItem) => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<DetailForm>(() => itemToForm(item))
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function setField<K extends keyof DetailForm>(key: K, value: DetailForm[K]) {
    setForm(current => ({ ...current, [key]: value }))
    setFeedback(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateContentAsset({
        assetId: item.id,
        title: form.title,
        description: form.description,
        category: form.category,
        tags: splitTags(form.tags),
        productType: form.productType,
        spaceType: form.spaceType,
        region: form.region,
        usagePurpose: form.usagePurpose,
        privacyChecked: form.privacyChecked,
        promotionConsentChecked: form.promotionConsentChecked,
      })
      setFeedback({ ok: result.ok, message: result.message })
      if (result.ok) router.refresh()
    })
  }

  return (
    <PlatformPanel as="aside" className={styles.detailPanel} aria-label="사진 상세 정보">
      {onClose ? (
        mode === 'mobile' ? (
          <PlatformButton type="button" variant="secondary" fullWidth autoFocus onClick={onClose}>
            <X aria-hidden="true" size={16} />
            목록으로
          </PlatformButton>
        ) : (
          <PlatformIconButton
            type="button"
            className={styles.detailCloseButton}
            onClick={onClose}
            aria-label="사진 상세 닫기"
          >
            <X aria-hidden="true" size={16} />
          </PlatformIconButton>
        )
      ) : null}

      <div className={styles.detailPreview}>
        <AssetThumbnail item={item} />
      </div>

      <div className={styles.detailMeta}>
        <span className={styles.detailMetaItem}>업로드 {formatDateTime(item.createdAt)}</span>
        <span className={styles.detailMetaItem}>사용 {item.usedCount}회</span>
        <span className={styles.detailMetaItem}>{formatBytes(item.web?.sizeBytes ?? item.thumbnail?.sizeBytes)}</span>
        <PlatformStatusBadge tone={item.privacyChecked && item.promotionConsentChecked ? 'success' : 'warning'}>
          {item.privacyChecked && item.promotionConsentChecked ? '검수 완료' : '검수 필요'}
        </PlatformStatusBadge>
      </div>

      <form className={styles.detailForm} onSubmit={handleSubmit}>
        <PlatformField label="사진명" value={form.title} onChange={(event: ChangeEvent<HTMLInputElement>) => setField('title', event.target.value)} />
        <PlatformField label="사진 설명" multiline rows={4} value={form.description} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setField('description', event.target.value)} />
        <details className={styles.optionalFields}>
          <summary>
            <span>선택 정보</span>
            <small>분류, 태그, 제품군, 공간, 지역, 사용 목적은 필요할 때만 채우면 됩니다.</small>
          </summary>
          <div className={styles.detailGrid}>
            <PlatformField label="분류" value={form.category} onChange={(event: ChangeEvent<HTMLInputElement>) => setField('category', event.target.value)} />
            <PlatformField label="태그" value={form.tags} onChange={(event: ChangeEvent<HTMLInputElement>) => setField('tags', event.target.value)} />
            <PlatformField label="제품군" value={form.productType} onChange={(event: ChangeEvent<HTMLInputElement>) => setField('productType', event.target.value)} />
            <PlatformField label="공간" value={form.spaceType} onChange={(event: ChangeEvent<HTMLInputElement>) => setField('spaceType', event.target.value)} />
            <PlatformField label="지역" value={form.region} onChange={(event: ChangeEvent<HTMLInputElement>) => setField('region', event.target.value)} />
            <PlatformField label="사용 목적" value={form.usagePurpose} onChange={(event: ChangeEvent<HTMLInputElement>) => setField('usagePurpose', event.target.value)} />
          </div>
        </details>

        <PlatformButton type="submit" isLoading={isPending} loadingLabel="저장 중…">저장</PlatformButton>
        <PlatformButton type="button" variant={item.libraryState === 'archived' ? 'primary' : 'danger'} onClick={() => onRequestLifecycle(item)}>
          {item.libraryState === 'archived' ? '사진 보관함으로 복원' : '사진 보관함으로 이동'}
        </PlatformButton>
        {feedback ? (
          <p className={styles.saveMessage} role="status" aria-live="polite" data-tone={feedback.ok ? 'success' : 'error'}>
            {feedback.message}
          </p>
        ) : null}
      </form>
    </PlatformPanel>
  )
}

export default function ContentAssetsClient({
  initialItems,
  tagOptions,
  loadError,
}: {
  initialItems: ContentAssetLibraryItem[]
  tagOptions: ContentAssetTagOption[]
  loadError: string | null
}) {
  const router = useRouter()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    category: '',
    productType: '',
    spaceType: '',
    region: '',
    usagePurpose: '',
  })
  const [tagFilter, setTagFilter] = useState('')
  const [libraryView, setLibraryView] = useState<LibraryView>('active')
  const [selectedForAction, setSelectedForAction] = useState<Set<string>>(() => new Set())
  const [lifecycleItems, setLifecycleItems] = useState<ContentAssetLibraryItem[] | null>(null)
  const [lifecycleResult, setLifecycleResult] = useState<ArchiveContentAssetsResult | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)

  const filteredItems = useMemo(() => {
    return initialItems.filter(item => {
      if (libraryView === 'archived' ? item.libraryState !== 'archived' : item.libraryState === 'archived') return false
      if (!includesSearch(item, search.trim())) return false
      if (tagFilter && !item.tags.includes(tagFilter)) return false
      return (Object.entries(filters) as Array<[FilterKey, string]>).every(([key, value]) => {
        return !value || item[key] === value
      })
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [filters, initialItems, libraryView, search, tagFilter])

  const selectedItem = selectedId
    ? filteredItems.find(item => item.id === selectedId) ?? null
    : null

  const options = useMemo(() => ({
    category: optionValues(initialItems, 'category'),
    productType: optionValues(initialItems, 'productType'),
    spaceType: optionValues(initialItems, 'spaceType'),
    region: optionValues(initialItems, 'region'),
    usagePurpose: optionValues(initialItems, 'usagePurpose'),
  }), [initialItems])

  function chooseItem(id: string, trigger: HTMLButtonElement) {
    const isClosingCurrent = selectedId === id
    returnFocusRef.current = trigger
    setSelectedId(isClosingCurrent ? '' : id)
    setMobileDetailOpen(!isClosingCurrent)
  }

  function closeDetail() {
    const returnTarget = returnFocusRef.current
    setSelectedId('')
    setMobileDetailOpen(false)
    window.requestAnimationFrame(() => returnTarget?.focus())
  }

  function toggleActionSelection(id: string) {
    setSelectedForAction(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectFiltered() {
    setSelectedForAction(new Set(filteredItems.map(item => item.id)))
  }

  function requestLifecycle(items: ContentAssetLibraryItem[]) {
    if (items.length > 0) setLifecycleItems(items)
  }

  function completeLifecycle(result: ArchiveContentAssetsResult) {
    setLifecycleResult(result)
    if (result.ok) {
      setSelectedForAction(current => {
        const next = new Set(current)
        result.results.filter(item => item.changed).forEach(item => next.delete(item.assetId))
        return next
      })
      if (result.results.some(item => item.changed && item.assetId === selectedId)) closeDetail()
      router.refresh()
    }
  }

  const actionItems = filteredItems.filter(item => selectedForAction.has(item.id))

  return (
    <div className={styles.page}>
      <PlatformPageHeader
        className={styles.pageHeader}
        title="사진보관함"
        description="블로그, 상담자료, 시공 콘텐츠에 다시 사용할 사진을 한곳에 정리합니다."
        actions={(
          <PlatformButton type="button" onClick={() => setUploadOpen(current => !current)} aria-expanded={uploadOpen}>
            <Plus aria-hidden="true" size={16} />
            {uploadOpen ? '사진 추가 닫기' : '사진 추가'}
          </PlatformButton>
        )}
      />

      {uploadOpen ? <UploadPanel /> : null}

      {loadError ? (
        <PlatformStatePanel tone="error" title="사진보관함을 불러오지 못했습니다." description={loadError} />
      ) : null}

      <PlatformPanel as="section" className={styles.toolbar} aria-label="사진 검색과 필터">
        <PlatformSegmentedControl
          label="사진 보관함 보기"
          value={libraryView}
          onChange={value => { setLibraryView(value); setSelectedForAction(new Set()); closeDetail() }}
          items={[{ value: 'active', label: '사진보관함' }, { value: 'archived', label: '보관된 사진' }]}
        />
        <PlatformField
          type="search"
          label="사진 검색"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="사진명, 설명, 태그로 검색"
        />
        <details className={styles.filterDetails}>
          <summary>
            <span>상세 필터</span>
            <small>분류, 제품군, 공간, 지역, 목적, 태그로 좁혀보기</small>
          </summary>
          <div className={styles.filterGrid}>
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map(key => (
              <PlatformSelect
                key={key}
                label={FILTER_LABELS[key]}
                value={filters[key]}
                onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}
                options={[
                  { value: '', label: '전체' },
                  ...options[key].map(value => ({ value, label: value })),
                ]}
              />
            ))}
          </div>
          {tagOptions.length > 0 ? (
            <PlatformSegmentedControl
              className={styles.tagFilters}
              label="태그 필터"
              value={tagFilter}
              onChange={setTagFilter}
              items={[{ value: '', label: '전체 태그' }, ...tagOptions.map(tag => ({ value: tag.name, label: tag.name }))]}
            />
          ) : null}
        </details>
      </PlatformPanel>

      {mobileDetailOpen && selectedItem ? (
        <div className={styles.mobileDetail}>
          <AssetDetailPanel key={`mobile-${selectedItem.id}`} item={selectedItem} mode="mobile" onClose={closeDetail} onRequestLifecycle={item => requestLifecycle([item])} />
        </div>
      ) : null}

      <div className={`${styles.libraryLayout} ${selectedItem ? styles.libraryLayoutSelected : ''}`}>
        <section className={styles.libraryList} aria-label="사진 목록">
          <div className={styles.listSummary}>
            <strong>{filteredItems.length}장</strong>
            <span>{libraryView === 'archived' ? '복원할 수 있는 보관함' : '최근 업로드 순'}</span>
          </div>

          {filteredItems.length > 0 ? (
            <div className={styles.selectionControls}>
              <PlatformButton type="button" variant="secondary" size="sm" onClick={selectFiltered}>현재 필터 결과 전체 선택</PlatformButton>
              <PlatformButton type="button" variant="ghost" size="sm" onClick={() => setSelectedForAction(new Set())} disabled={selectedForAction.size === 0}>선택 해제</PlatformButton>
              <span role="status" aria-live="polite">{actionItems.length}장 선택</span>
            </div>
          ) : null}

          {filteredItems.length === 0 && !loadError ? (
            <PlatformStatePanel
              tone="empty"
              icon={<Images size={24} />}
              title="아직 조건에 맞는 사진이 없습니다."
              description="사진을 추가하거나 검색 조건을 줄여보세요."
            />
          ) : filteredItems.length > 0 ? (
            <div className={styles.assetGrid}>
              {filteredItems.map((item, index) => {
                const isSelected = selectedItem?.id === item.id
                return (
                  <article
                    key={item.id}
                    className={`${styles.assetCard} ${isSelected ? styles.assetCardSelected : ''}`}
                  >
                    <div className={styles.cardThumb}>
                      <AssetThumbnail item={item} />
                    </div>
                    <div className={styles.cardBody}>
                      <PlatformCheckbox
                        checked={selectedForAction.has(item.id)}
                        onChange={() => toggleActionSelection(item.id)}
                      >
                        {displayAssetTitle(item, index)} 선택
                      </PlatformCheckbox>
                      <strong>{displayAssetTitle(item, index)}</strong>
                      <span>{item.description || '설명을 추가해 주세요.'}</span>
                      <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                      <PlatformButton type="button" variant="secondary" size="sm" onClick={event => chooseItem(item.id, event.currentTarget)} aria-pressed={isSelected}>상세 보기</PlatformButton>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </section>

        {selectedItem ? (
          <div className={styles.desktopDetail}>
            <AssetDetailPanel key={`desktop-${selectedItem.id}`} item={selectedItem} mode="desktop" onClose={closeDetail} onRequestLifecycle={item => requestLifecycle([item])} />
          </div>
        ) : null}
      </div>
      {actionItems.length > 0 ? (
        <PlatformPanel as="section" className={styles.selectionBar} aria-label="선택한 사진 작업">
          <strong>{actionItems.length}장 선택</strong>
          <PlatformButton type="button" variant={libraryView === 'archived' ? 'primary' : 'danger'} onClick={() => requestLifecycle(actionItems)}>
            {libraryView === 'archived' ? '선택한 사진 복원' : '선택한 사진 보관'}
          </PlatformButton>
        </PlatformPanel>
      ) : null}
      {lifecycleResult && !lifecycleItems ? <p className={styles.saveMessage} role="status">{lifecycleResult.message}</p> : null}
      {lifecycleItems ? <ArchiveDialog items={lifecycleItems} restore={libraryView === 'archived' || lifecycleItems.every(item => item.libraryState === 'archived')} onClose={() => setLifecycleItems(null)} onComplete={completeLifecycle} /> : null}
    </div>
  )
}
