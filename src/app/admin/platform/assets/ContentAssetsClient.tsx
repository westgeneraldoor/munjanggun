'use client'

/* eslint-disable @next/next/no-img-element -- 사진보관함은 서버에서 이미 정리한 WebP/썸네일만 렌더링합니다. */

import { useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Images,
  Loader2,
  Plus,
  Save,
  Search,
  UploadCloud,
  X,
} from 'lucide-react'
import { updateContentAsset, uploadContentAssets, type UploadContentAssetsResult } from './actions'
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

const FILTER_LABELS: Record<FilterKey, string> = {
  category: '분류',
  productType: '제품군',
  spaceType: '공간',
  region: '지역',
  usagePurpose: '사용 목적',
}

const MAX_UPLOAD_TOTAL_BYTES = 120 * 1024 * 1024

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [result, setResult] = useState<UploadContentAssetsResult | null>(null)
  const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0)
  const isOverLimit = totalBytes > MAX_UPLOAD_TOTAL_BYTES

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files ?? []))
    setResult(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const nextResult = await uploadContentAssets(formData)
      setResult(nextResult)
      if (nextResult.ok) {
        setSelectedFiles([])
        form.reset()
        router.refresh()
        onUploaded()
      }
    })
  }

  return (
    <form className={styles.uploadPanel} onSubmit={handleSubmit}>
      <div className={styles.uploadDrop}>
        <UploadCloud aria-hidden="true" size={24} />
        <div>
          <strong>여러 장 업로드</strong>
          <span>사진을 선택하면 웹에 맞게 정리해서 보관합니다. 한 번에 합계 120MB까지 가능합니다.</span>
        </div>
        <input
          type="file"
          name="files"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={handleFileChange}
          disabled={isPending}
          aria-label="사진 파일 선택"
        />
      </div>

      {selectedFiles.length > 0 ? (
        <>
          <div className={isOverLimit ? styles.limitWarning : styles.limitInfo}>
            선택한 사진 {selectedFiles.length}장, 합계 {formatBytes(totalBytes)}
          </div>
          <ul className={styles.selectedFiles} aria-label="선택한 사진">
            {selectedFiles.map(file => (
              <li key={`${file.name}-${file.size}`}>
                <span>{file.name}</span>
                <small>{formatBytes(file.size)}</small>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className={styles.uploadFields}>
        <label>
          사진 설명
          <textarea name="description" rows={3} placeholder="예: 현관 중문 설치 전 확인용 사진" />
        </label>
        <label>
          분류
          <input name="category" placeholder="예: 중문, 현관, 시공후" />
        </label>
        <label>
          태그
          <input name="tags" placeholder="예: 3연동, 화이트, 좁은현관" />
        </label>
        <label>
          제품군
          <input name="productType" placeholder="예: 중문" />
        </label>
        <label>
          공간
          <input name="spaceType" placeholder="예: 현관" />
        </label>
        <label>
          지역
          <input name="region" placeholder="예: 동탄" />
        </label>
        <label>
          사용 목적
          <input name="usagePurpose" placeholder="예: 블로그, 상담자료" />
        </label>
      </div>

      <div className={styles.checkGrid}>
        <label className={styles.checkRow}>
          <input type="checkbox" name="privacyChecked" />
          <span>주소나 얼굴 등 민감정보 없음</span>
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" name="promotionConsentChecked" />
          <span>블로그/홍보 사용 가능</span>
        </label>
      </div>

      <div className={styles.uploadActions}>
        <button type="submit" className={styles.primaryButton} disabled={isPending || selectedFiles.length === 0 || isOverLimit}>
          {isPending ? <Loader2 aria-hidden="true" size={16} className={styles.spin} /> : <UploadCloud aria-hidden="true" size={16} />}
          사진 보관
        </button>
      </div>

      {result ? (
        <div className={result.ok ? styles.resultSuccess : styles.resultError} role="status">
          <strong>{result.message}</strong>
          {result.items.length > 0 ? (
            <ul>
              {result.items.map(item => (
                <li key={item.fileName}>
                  {item.ok ? <CheckCircle2 aria-hidden="true" size={14} /> : <AlertCircle aria-hidden="true" size={14} />}
                  <span>{item.fileName}: {item.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

function AssetThumbnail({ item }: { item: ContentAssetLibraryItem }) {
  const image = item.thumbnail?.url ?? item.web?.url

  if (!image) {
    return (
      <div className={styles.thumbPlaceholder}>
        <ImageIcon aria-hidden="true" size={28} />
      </div>
    )
  }

  return (
    <img
      src={image}
      alt={item.title || item.description || '보관함 사진'}
      loading="lazy"
      className={styles.thumbImage}
    />
  )
}

function AssetDetailPanel({
  item,
  mode,
  onClose,
}: {
  item: ContentAssetLibraryItem
  mode: 'desktop' | 'mobile'
  onClose?: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<DetailForm>(() => itemToForm(item))
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const image = item.web?.url ?? item.thumbnail?.url

  function setField<K extends keyof DetailForm>(key: K, value: DetailForm[K]) {
    setForm(current => ({ ...current, [key]: value }))
    setMessage(null)
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
      setMessage(result.message)
      if (result.ok) router.refresh()
    })
  }

  return (
    <aside className={styles.detailPanel} aria-label="사진 상세 정보">
      {mode === 'mobile' && onClose ? (
        <button type="button" className={styles.secondaryButton} onClick={onClose}>
          <X aria-hidden="true" size={16} />
          목록으로
        </button>
      ) : null}

      <div className={styles.detailPreview}>
        {image ? (
          <img src={image} alt={item.title || item.description || '선택한 사진'} />
        ) : (
          <div className={styles.thumbPlaceholder}>
            <Images aria-hidden="true" size={30} />
          </div>
        )}
      </div>

      <div className={styles.detailMeta}>
        <span>등록일 {formatDate(item.createdAt)}</span>
        <span>사용 {item.usedCount}회</span>
        <span>{formatBytes(item.web?.sizeBytes ?? item.thumbnail?.sizeBytes)}</span>
      </div>

      <form className={styles.detailForm} onSubmit={handleSubmit}>
        <label>
          사진명
          <input value={form.title} onChange={event => setField('title', event.target.value)} />
        </label>
        <label>
          사진 설명
          <textarea rows={4} value={form.description} onChange={event => setField('description', event.target.value)} />
        </label>
        <div className={styles.detailGrid}>
          <label>
            분류
            <input value={form.category} onChange={event => setField('category', event.target.value)} />
          </label>
          <label>
            태그
            <input value={form.tags} onChange={event => setField('tags', event.target.value)} />
          </label>
          <label>
            제품군
            <input value={form.productType} onChange={event => setField('productType', event.target.value)} />
          </label>
          <label>
            공간
            <input value={form.spaceType} onChange={event => setField('spaceType', event.target.value)} />
          </label>
          <label>
            지역
            <input value={form.region} onChange={event => setField('region', event.target.value)} />
          </label>
          <label>
            사용 목적
            <input value={form.usagePurpose} onChange={event => setField('usagePurpose', event.target.value)} />
          </label>
        </div>

        <div className={styles.checkGrid}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.privacyChecked}
              onChange={event => setField('privacyChecked', event.target.checked)}
            />
            <span>주소나 얼굴 등 민감정보 없음</span>
          </label>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.promotionConsentChecked}
              onChange={event => setField('promotionConsentChecked', event.target.checked)}
            />
            <span>블로그/홍보 사용 가능</span>
          </label>
        </div>

        <button type="submit" className={styles.primaryButton} disabled={isPending}>
          {isPending ? <Loader2 aria-hidden="true" size={16} className={styles.spin} /> : <Save aria-hidden="true" size={16} />}
          저장
        </button>
        {message ? <p className={styles.saveMessage}>{message}</p> : null}
      </form>
    </aside>
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
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? '')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)

  const filteredItems = useMemo(() => {
    return initialItems.filter(item => {
      if (!includesSearch(item, search.trim())) return false
      if (tagFilter && !item.tags.includes(tagFilter)) return false
      return (Object.entries(filters) as Array<[FilterKey, string]>).every(([key, value]) => {
        return !value || item[key] === value
      })
    })
  }, [filters, initialItems, search, tagFilter])

  const selectedItem = filteredItems.find(item => item.id === selectedId)
    ?? filteredItems[0]
    ?? initialItems.find(item => item.id === selectedId)
    ?? null

  const options = useMemo(() => ({
    category: optionValues(initialItems, 'category'),
    productType: optionValues(initialItems, 'productType'),
    spaceType: optionValues(initialItems, 'spaceType'),
    region: optionValues(initialItems, 'region'),
    usagePurpose: optionValues(initialItems, 'usagePurpose'),
  }), [initialItems])

  function chooseItem(id: string) {
    setSelectedId(id)
    setMobileDetailOpen(true)
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>문장군 콘텐츠 자산</p>
          <h1>사진보관함</h1>
          <p>블로그, 상담자료, 시공 콘텐츠에 다시 사용할 사진을 한곳에 정리합니다.</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setUploadOpen(current => !current)}>
          <Plus aria-hidden="true" size={16} />
          사진 추가
        </button>
      </header>

      {uploadOpen ? <UploadPanel onUploaded={() => setUploadOpen(false)} /> : null}

      {loadError ? (
        <div className={styles.errorState} role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          {loadError}
        </div>
      ) : null}

      <section className={styles.toolbar} aria-label="사진 검색과 필터">
        <label className={styles.searchBox}>
          <Search aria-hidden="true" size={16} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="사진명, 설명, 태그로 검색"
          />
        </label>
        <div className={styles.filterGrid}>
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map(key => (
            <label key={key}>
              <span>{FILTER_LABELS[key]}</span>
              <select
                value={filters[key]}
                onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}
              >
                <option value="">전체</option>
                {options[key].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          ))}
        </div>
        {tagOptions.length > 0 ? (
          <div className={styles.tagFilters} aria-label="태그 필터">
            <button
              type="button"
              className={!tagFilter ? styles.tagActive : styles.tagButton}
              onClick={() => setTagFilter('')}
            >
              전체 태그
            </button>
            {tagOptions.map(tag => (
              <button
                key={tag.id}
                type="button"
                className={tagFilter === tag.name ? styles.tagActive : styles.tagButton}
                onClick={() => setTagFilter(tag.name)}
              >
                {tag.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {mobileDetailOpen && selectedItem ? (
        <div className={styles.mobileDetail}>
          <AssetDetailPanel key={`mobile-${selectedItem.id}`} item={selectedItem} mode="mobile" onClose={() => setMobileDetailOpen(false)} />
        </div>
      ) : null}

      <div className={`${styles.libraryLayout} ${selectedItem ? styles.libraryLayoutSelected : ''}`}>
        <section className={styles.libraryList} aria-label="사진 목록">
          <div className={styles.listSummary}>
            <strong>{filteredItems.length}장</strong>
            <span>최근 수정 순</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              <Images aria-hidden="true" size={24} />
              <strong>아직 조건에 맞는 사진이 없습니다.</strong>
              <span>사진을 추가하거나 검색 조건을 줄여보세요.</span>
            </div>
          ) : (
            <div className={styles.assetGrid}>
              {filteredItems.map(item => {
                const isSelected = selectedItem?.id === item.id
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`${styles.assetCard} ${isSelected ? styles.assetCardSelected : ''}`}
                    onClick={() => chooseItem(item.id)}
                  >
                    <div className={styles.cardThumb}>
                      <AssetThumbnail item={item} />
                    </div>
                    <div className={styles.cardBody}>
                      <strong>{item.title || '이름 없는 사진'}</strong>
                      <span>{item.description || item.category || '설명을 추가해 주세요.'}</span>
                      <div className={styles.cardMeta}>
                        {item.category ? <em>{item.category}</em> : null}
                        {item.region ? <em>{item.region}</em> : null}
                        {item.promotionConsentChecked ? <em>홍보 가능</em> : null}
                      </div>
                      {item.tags.length > 0 ? (
                        <div className={styles.cardTags}>
                          {item.tags.slice(0, 3).map(tag => <small key={tag}>{tag}</small>)}
                          {item.tags.length > 3 ? <small>+{item.tags.length - 3}</small> : null}
                        </div>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {selectedItem ? (
          <div className={styles.desktopDetail}>
            <AssetDetailPanel key={`desktop-${selectedItem.id}`} item={selectedItem} mode="desktop" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
