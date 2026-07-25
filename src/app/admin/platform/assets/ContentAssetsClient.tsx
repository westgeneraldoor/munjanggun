'use client'

/* eslint-disable @next/next/no-img-element -- 사진보관함은 서버에서 이미 정리한 WebP/썸네일만 렌더링합니다. */

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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
  PlatformModal,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSegmentedControl,
  PlatformSelect,
  PlatformStatePanel,
  PlatformStatusBadge,
} from '@/components/platform/ui'
import {
  archiveContentAssetSearchResults,
  archiveContentAssets,
  prepareContentAssetSearchSelection,
  restoreContentAssets,
  updateContentAsset,
  uploadContentAssets,
  type ArchiveContentAssetsResult,
  type ContentAssetReference,
  type UploadContentAssetsResult,
} from './actions'
import type { AssetLibraryFilterOptions } from './library-data'
import {
  assetLibraryQueryKey,
  buildAssetLibraryUrl,
  type AssetLibraryQuery,
  type AssetLibrarySort,
  type AssetLibraryView,
} from './query-state'
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

type LifecycleSelection =
  | { kind: 'items'; items: ContentAssetLibraryItem[] }
  | { kind: 'query'; query: AssetLibraryQuery; totalCount: number; selectionToken: string }

type AllResultsSelection = {
  queryKey: string
  totalCount: number
  selectionToken: string
}

const FILTER_LABELS: Record<FilterKey, string> = {
  category: '분류',
  productType: '제품군',
  spaceType: '공간',
  region: '지역',
  usagePurpose: '사용 목적',
}

const MAX_UPLOAD_TOTAL_BYTES = 120 * 1024 * 1024
const SORT_OPTIONS: Array<{ value: AssetLibrarySort; label: string }> = [
  { value: 'newest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
  { value: 'nameAsc', label: '파일명 오름차순' },
  { value: 'nameDesc', label: '파일명 내림차순' },
  { value: 'sizeDesc', label: '용량 큰순' },
  { value: 'sizeAsc', label: '용량 작은순' },
]

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
  const labels: Record<string, string> = {
    draft: '초안',
    ai_draft: 'AI 초안',
    needs_media: '사진 필요',
    ready: '발행 준비',
    reviewing: '검토',
    approved: '승인',
    published: '발행',
    archived: '휴지통',
    linked: '연결됨',
  }
  return labels[status] ?? status
}

function referenceLocation(location: string) {
  const labels: Record<string, string> = { cover: '대표사진', body: '본문', blog_media: '연결된 사진' }
  return labels[location] ?? location
}

function ArchiveDialog({
  selection,
  restore,
  onClose,
  onComplete,
}: {
  selection: LifecycleSelection
  restore: boolean
  onClose: () => void
  onComplete: (result: ArchiveContentAssetsResult) => void
}) {
  const [result, setResult] = useState<ArchiveContentAssetsResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const blocked = result?.results.filter(item => item.reason === 'in_use') ?? []
  const changed = result?.results.filter(item => item.changed) ?? []
  const items = selection.kind === 'items' ? selection.items : []
  const targetCount = selection.kind === 'items' ? selection.items.length : selection.totalCount

  function submit() {
    startTransition(async () => {
      const next = selection.kind === 'query'
        ? await archiveContentAssetSearchResults(selection.query, selection.totalCount, selection.selectionToken, restore)
        : restore
          ? await restoreContentAssets(items.map(item => item.id))
          : await archiveContentAssets(items.map(item => item.id))
      setResult(next)
      onComplete(next)
    })
  }

  return (
    <PlatformModal isOpen title={restore ? '사진 복원' : '휴지통 이동'} onClose={onClose} closeDisabled={isPending}>
      <PlatformPanel as="section" className={styles.archiveDialog}>
        <h2 id="asset-archive-title">{restore ? '휴지통에서 복원' : '휴지통으로 이동'}</h2>
        {!result ? (
          <>
            <p>{restore ? `${targetCount}장을 다시 사진보관함에 표시합니다.` : `${targetCount}장의 사용처와 검색 결과 수를 서버에서 다시 확인합니다. 사용 중인 사진은 휴지통으로 이동하지 않으며, 사진 파일은 삭제하지 않습니다.`}</p>
            {selection.kind === 'query' ? <p>대상: 현재 검색·필터 결과 전체 {selection.totalCount}장</p> : <p>대상: 현재 페이지에서 선택한 {items.length}장</p>}
            <div className={styles.dialogActions}>
              <PlatformButton type="button" variant="secondary" onClick={onClose} disabled={isPending}>취소</PlatformButton>
              <PlatformButton type="button" variant={restore ? 'primary' : 'danger'} onClick={submit} isLoading={isPending} loadingLabel="확인 중…">{restore ? '복원' : '사용처 확인 후 휴지통으로 이동'}</PlatformButton>
            </div>
          </>
        ) : (
          <>
            <p role="status" aria-live="polite">{result.message}</p>
            {changed.length > 0 ? <p className={styles.resultSuccess}>{changed.length}장은 안전하게 처리했습니다.</p> : null}
            {blocked.length > 0 ? (
              <section id="asset-usage-results" tabIndex={-1} className={styles.blockedReferences} aria-label="사용 중인 사진">
                <h3>사용 중인 사진은 휴지통으로 이동할 수 없습니다</h3>
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
  onRequestLifecycle,
}: {
  item: ContentAssetLibraryItem
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
          {item.libraryState === 'archived' ? '휴지통에서 복원' : '휴지통으로 이동'}
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
  query,
  totalCount,
  totalPages,
  filterOptions,
  tagOptions,
  loadError,
}: {
  initialItems: ContentAssetLibraryItem[]
  query: AssetLibraryQuery
  totalCount: number
  totalPages: number
  filterOptions: AssetLibraryFilterOptions
  tagOptions: ContentAssetTagOption[]
  loadError: string | null
}) {
  const router = useRouter()
  const queryKey = assetLibraryQueryKey(query)
  const [isPagePending, startPageTransition] = useTransition()
  const serverItemsKey = initialItems.map(item => `${item.id}:${item.updatedAt}`).join('|')
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<{ serverItemsKey: string; ids: Set<string> } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(query.search)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedForAction, setSelectedForAction] = useState<Set<string>>(() => new Set())
  const [allResultsSelection, setAllResultsSelection] = useState<AllResultsSelection | null>(null)
  const [lifecycleSelection, setLifecycleSelection] = useState<LifecycleSelection | null>(null)
  const [lifecycleResult, setLifecycleResult] = useState<ArchiveContentAssetsResult | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [dragRect, setDragRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const selectionAnchorRef = useRef('')
  const suppressCardClickRef = useRef(false)
  const lastServerQueryKeyRef = useRef(queryKey)
  const dragSelectionRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    baseSelection: Set<string>
    active: boolean
  } | null>(null)

  const locallyRemovedIds = optimisticallyRemoved?.serverItemsKey === serverItemsKey
    ? optimisticallyRemoved.ids
    : new Set<string>()
  const libraryItems = initialItems.filter(item => !locallyRemovedIds.has(item.id))
  const pageItems = libraryItems
  const normalizedSearchDraft = searchDraft.trim().replace(/\s+/g, ' ').slice(0, 120)
  const selectionScopeStable = normalizedSearchDraft === query.search && !isPagePending
  const allResultsSelected = Boolean(allResultsSelection)

  const selectedItem = selectedId
    ? libraryItems.find(item => item.id === selectedId) ?? null
    : null

  useEffect(() => {
    lastServerQueryKeyRef.current = queryKey
  }, [queryKey])

  useEffect(() => {
    const nextSearch = normalizedSearchDraft
    if (nextSearch === query.search) return
    const timer = window.setTimeout(() => {
      startPageTransition(() => {
        router.replace(buildAssetLibraryUrl({ ...query, search: nextSearch, page: 1 }), { scroll: false })
      })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [normalizedSearchDraft, query, queryKey, router])

  function handleSearchDraftChange(value: string) {
    setSearchDraft(value)
    const nextSearch = value.trim().replace(/\s+/g, ' ').slice(0, 120)
    if (nextSearch === query.search) return
    setSelectedForAction(new Set())
    setAllResultsSelection(null)
    setSelectionMode(false)
    setLifecycleSelection(null)
    selectionAnchorRef.current = ''
    setSelectedId('')
  }

  function navigateQuery(patch: Partial<AssetLibraryQuery>, replace = true) {
    const nextQuery = {
      ...query,
      ...patch,
      page: patch.page ?? 1,
    }
    setSelectedForAction(new Set())
    setAllResultsSelection(null)
    setSelectionMode(false)
    selectionAnchorRef.current = ''
    closeDetail()
    startPageTransition(() => {
      const href = buildAssetLibraryUrl(nextQuery)
      if (replace) router.replace(href, { scroll: false })
      else router.push(href, { scroll: false })
    })
  }

  function closeDetail() {
    setSelectedId('')
  }

  function toggleActionSelection(id: string, range = false) {
    if (allResultsSelected) return
    setSelectedForAction(current => {
      const next = new Set(current)
      if (range && selectionAnchorRef.current) {
        const anchorIndex = pageItems.findIndex(item => item.id === selectionAnchorRef.current)
        const targetIndex = pageItems.findIndex(item => item.id === id)
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const start = Math.min(anchorIndex, targetIndex)
          const end = Math.max(anchorIndex, targetIndex)
          pageItems.slice(start, end + 1).forEach(item => next.add(item.id))
          return next
        }
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    selectionAnchorRef.current = id
  }

  function selectCurrentPage() {
    setAllResultsSelection(null)
    setSelectedForAction(new Set(pageItems.map(item => item.id)))
  }

  function clearCurrentPageSelection() {
    const pageIds = new Set(pageItems.map(item => item.id))
    setSelectedForAction(current => new Set([...current].filter(id => !pageIds.has(id))))
    selectionAnchorRef.current = ''
  }

  function selectAllResults() {
    if (totalCount < 1 || !selectionScopeStable) return
    const requestedQueryKey = queryKey
    setSelectedForAction(new Set())
    selectionAnchorRef.current = ''
    startPageTransition(async () => {
      const result = await prepareContentAssetSearchSelection(query)
      if (lastServerQueryKeyRef.current !== requestedQueryKey) return
      if (!result.ok || !result.selectionToken || !result.totalCount) {
        setAllResultsSelection(null)
        setLifecycleResult({ ok: false, message: result.message, results: [] })
        return
      }
      setAllResultsSelection({
        queryKey: requestedQueryKey,
        totalCount: result.totalCount,
        selectionToken: result.selectionToken,
      })
      setLifecycleResult({ ok: true, message: result.message, results: [] })
    })
  }

  function clearAllResultsSelection() {
    setSelectedForAction(new Set())
    setAllResultsSelection(null)
    selectionAnchorRef.current = ''
  }

  function handleCardClick(item: ContentAssetLibraryItem, event: ReactMouseEvent<HTMLButtonElement>) {
    if (suppressCardClickRef.current) return
    if (selectionMode) {
      toggleActionSelection(item.id, event.shiftKey)
      return
    }
    setSelectedId(item.id)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!selectionMode || event.pointerType !== 'mouse' || event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('[data-selection-control]')) return
    if (allResultsSelected) return
    dragSelectionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseSelection: event.ctrlKey || event.metaKey ? new Set(selectedForAction) : new Set(),
      active: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragSelectionRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (!drag.active && Math.hypot(deltaX, deltaY) < 8) return
    drag.active = true
    event.preventDefault()

    const left = Math.min(drag.startX, event.clientX)
    const top = Math.min(drag.startY, event.clientY)
    const right = Math.max(drag.startX, event.clientX)
    const bottom = Math.max(drag.startY, event.clientY)
    setDragRect({ left, top, width: right - left, height: bottom - top })

    const next = new Set(drag.baseSelection)
    event.currentTarget.querySelectorAll<HTMLElement>('[data-asset-id]').forEach(card => {
      const rect = card.getBoundingClientRect()
      if (rect.left <= right && rect.right >= left && rect.top <= bottom && rect.bottom >= top) {
        const id = card.dataset.assetId
        if (id) next.add(id)
      }
    })
    setSelectedForAction(next)
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragSelectionRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.active) {
      suppressCardClickRef.current = true
      window.setTimeout(() => { suppressCardClickRef.current = false }, 0)
    }
    dragSelectionRef.current = null
    setDragRect(null)
  }

  function requestLifecycle(items: ContentAssetLibraryItem[]) {
    if (items.length === 0) return
    closeDetail()
    setLifecycleSelection({ kind: 'items', items })
  }

  function requestAllResultsLifecycle() {
    if (!allResultsSelection || allResultsSelection.queryKey !== queryKey || !selectionScopeStable) return
    closeDetail()
    setLifecycleSelection({
      kind: 'query',
      query,
      totalCount: allResultsSelection.totalCount,
      selectionToken: allResultsSelection.selectionToken,
    })
  }

  function completeLifecycle(result: ArchiveContentAssetsResult) {
    setLifecycleResult(result)
    if (result.ok) {
      const changedIds = new Set(result.results.filter(item => item.changed).map(item => item.assetId))
      setOptimisticallyRemoved(current => ({
        serverItemsKey,
        ids: new Set([...(current?.serverItemsKey === serverItemsKey ? current.ids : []), ...changedIds]),
      }))
      setSelectedForAction(current => {
        const next = new Set(current)
        result.results.filter(item => item.changed).forEach(item => next.delete(item.assetId))
        return next
      })
      setAllResultsSelection(null)
      if (result.results.some(item => item.changed && item.assetId === selectedId)) closeDetail()
      router.refresh()
    }
  }

  const actionItems = pageItems.filter(item => selectedForAction.has(item.id))
  const actionCount = allResultsSelection?.totalCount ?? actionItems.length

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
          value={query.view}
          onChange={value => {
            navigateQuery({ view: value as AssetLibraryView })
          }}
          items={[{ value: 'active', label: '사진보관함' }, { value: 'archived', label: '휴지통' }]}
        />
        <div className={styles.toolbarControls}>
          <PlatformField
            type="search"
            label="사진 검색"
            value={searchDraft}
            onChange={event => handleSearchDraftChange(event.target.value)}
            placeholder="사진명, 설명, 태그로 검색"
          />
          <PlatformSelect
            label="정렬"
            value={query.sort}
            onChange={event => navigateQuery({ sort: event.target.value as AssetLibrarySort })}
            options={SORT_OPTIONS}
          />
          <PlatformButton
            type="button"
            variant={selectionMode ? 'primary' : 'secondary'}
            aria-pressed={selectionMode}
            disabled={!selectionScopeStable}
            onClick={() => {
              const next = !selectionMode
              setSelectionMode(next)
              if (!next) {
                setSelectedForAction(new Set())
                setAllResultsSelection(null)
                selectionAnchorRef.current = ''
              } else {
                closeDetail()
              }
            }}
          >
            {selectionMode ? '선택 끝내기' : '선택'}
          </PlatformButton>
        </div>
        <details className={styles.filterDetails}>
          <summary>
            <span>필터</span>
            <small>분류, 제품군, 공간, 지역, 목적, 태그</small>
          </summary>
          <div className={styles.filterGrid}>
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map(key => (
              <PlatformSelect
                key={key}
                label={FILTER_LABELS[key]}
                value={query[key]}
                onChange={event => navigateQuery({ [key]: event.target.value })}
                options={[
                  { value: '', label: '전체' },
                  ...filterOptions[key].map(value => ({ value, label: value })),
                ]}
              />
            ))}
          </div>
          {tagOptions.length > 0 ? (
            <PlatformSegmentedControl
              className={styles.tagFilters}
              label="태그 필터"
              value={query.tagId}
              onChange={value => navigateQuery({ tagId: value })}
              items={[{ value: '', label: '전체 태그' }, ...tagOptions.map(tag => ({ value: tag.id, label: tag.name }))]}
            />
          ) : null}
        </details>
      </PlatformPanel>

      <div className={styles.libraryLayout}>
        <section className={styles.libraryList} aria-label="사진 목록">
          <div className={styles.listSummary}>
            <strong>전체 결과 {totalCount}장</strong>
            <span>{totalCount > 0 ? `${query.page}/${totalPages} 페이지 · 현재 ${pageItems.length}장 · ${SORT_OPTIONS.find(option => option.value === query.sort)?.label}` : query.view === 'archived' ? '복원할 수 있는 휴지통' : '조건에 맞는 사진이 없습니다'}</span>
          </div>
          {isPagePending ? <p className={styles.pageLoading} role="status" aria-live="polite">사진 결과를 불러오는 중…</p> : null}

          {selectionMode && pageItems.length > 0 ? (
            <div className={styles.selectionControls}>
              <PlatformButton type="button" variant="secondary" size="sm" onClick={selectCurrentPage}>현재 페이지 전체 선택 ({pageItems.length}장)</PlatformButton>
              {!allResultsSelected ? (
                <PlatformButton type="button" variant="ghost" size="sm" onClick={clearCurrentPageSelection} disabled={actionItems.length === 0}>현재 페이지 전체 해제</PlatformButton>
              ) : null}
              <PlatformButton type="button" variant={allResultsSelected ? 'primary' : 'secondary'} size="sm" onClick={selectAllResults} disabled={!selectionScopeStable || allResultsSelected}>검색 결과 전체 선택 ({totalCount}장)</PlatformButton>
              {allResultsSelected ? <PlatformButton type="button" variant="ghost" size="sm" onClick={clearAllResultsSelection}>검색 결과 전체 해제</PlatformButton> : null}
              <span role="status" aria-live="polite">{actionCount}장 선택</span>
            </div>
          ) : null}

          {pageItems.length === 0 && !loadError ? (
            <PlatformStatePanel
              tone="empty"
              icon={<Images size={24} />}
              title="아직 조건에 맞는 사진이 없습니다."
              description="사진을 추가하거나 검색 조건을 줄여보세요."
            />
          ) : pageItems.length > 0 ? (
            <>
              <div
                className={`${styles.assetGrid} ${selectionMode ? styles.assetGridSelecting : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
              {pageItems.map((item, index) => {
                const isSelected = allResultsSelected || selectedForAction.has(item.id)
                return (
                  <article
                    key={item.id}
                    data-asset-id={item.id}
                    className={`${styles.assetCard} ${isSelected ? styles.assetCardSelected : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.cardButton}
                      data-asset-card-button
                      aria-label={selectionMode
                        ? allResultsSelected
                          ? `${displayAssetTitle(item)} 검색 결과 전체 선택됨`
                          : `${displayAssetTitle(item)} ${isSelected ? '선택 해제' : '선택'}`
                        : `${displayAssetTitle(item)} 상세 보기`}
                      aria-pressed={selectionMode ? isSelected : undefined}
                      onClick={event => handleCardClick(item, event)}
                    >
                      <span className={styles.cardThumb}>
                        <AssetThumbnail item={item} />
                      </span>
                      <strong className={styles.cardTitle}>{displayAssetTitle(item, index)}</strong>
                    </button>
                    {selectionMode ? (
                      <div className={styles.cardSelection} data-selection-control>
                      <PlatformCheckbox
                        checked={isSelected}
                        disabled={allResultsSelected}
                        onChange={() => toggleActionSelection(item.id)}
                      >
                          <span className={styles.srOnly}>{displayAssetTitle(item, index)} 선택</span>
                      </PlatformCheckbox>
                      </div>
                    ) : null}
                  </article>
                )
              })}
              </div>
            </>
          ) : null}
          {totalPages > 1 ? (
            <nav className={styles.pagination} aria-label="사진 페이지">
              <PlatformButton type="button" variant="secondary" disabled={query.page <= 1 || isPagePending} onClick={() => navigateQuery({ page: query.page - 1 }, false)}>이전 페이지</PlatformButton>
              <span aria-current="page">{query.page} / {totalPages}</span>
              <PlatformButton type="button" variant="secondary" disabled={query.page >= totalPages || isPagePending} onClick={() => navigateQuery({ page: query.page + 1 }, false)}>다음 페이지</PlatformButton>
            </nav>
          ) : null}
        </section>
      </div>
      {selectionMode && actionCount > 0 ? (
        <PlatformPanel as="section" className={styles.selectionBar} aria-label="선택한 사진 작업">
          <strong>{allResultsSelected ? `검색 결과 전체 ${actionCount}장 선택` : `현재 페이지 ${actionItems.length}장 선택`}</strong>
          <PlatformButton type="button" variant={query.view === 'archived' ? 'primary' : 'danger'} disabled={!selectionScopeStable} onClick={() => allResultsSelected ? requestAllResultsLifecycle() : requestLifecycle(actionItems)}>
            {query.view === 'archived' ? '선택한 사진 복원' : '선택한 사진 휴지통으로 이동'}
          </PlatformButton>
        </PlatformPanel>
      ) : null}
      {dragRect ? <div className={styles.dragSelectionRect} style={dragRect} aria-hidden="true" /> : null}
      {selectedItem ? (
        <PlatformModal
          isOpen
          title={`${displayAssetTitle(selectedItem)} 사진 상세`}
          onClose={closeDetail}
          size="wide"
          closeOnBackdrop
          showCloseButton
          closeLabel="사진 상세 닫기"
          className={styles.detailModal}
        >
          <AssetDetailPanel key={selectedItem.id} item={selectedItem} onRequestLifecycle={item => requestLifecycle([item])} />
        </PlatformModal>
      ) : null}
      {lifecycleResult && !lifecycleSelection ? <p className={styles.saveMessage} role="status">{lifecycleResult.message}</p> : null}
      {lifecycleSelection ? <ArchiveDialog selection={lifecycleSelection} restore={query.view === 'archived' || (lifecycleSelection.kind === 'items' && lifecycleSelection.items.every(item => item.libraryState === 'archived'))} onClose={() => setLifecycleSelection(null)} onComplete={completeLifecycle} /> : null}
    </div>
  )
}
