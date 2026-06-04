'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, ChevronLeft, Paperclip, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import DaumAddressSearch from '@/components/platform/DaumAddressSearch'
import VisitDatePicker from '@/components/platform/VisitDatePicker'
import styles from './measure-form.module.css'

interface Props {
  userId: string
}

interface CategoryOption {
  key: string
  label: string
  description: string | null
  image_url: string | null
}

interface FilePreview {
  file: File
  previewUrl: string | null
  type: 'image' | 'video'
}

const MAX_FILE_COUNT = 10
const MAX_FILE_SIZE_MB = 50
const MAX_TOTAL_SIZE_MB = 200

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export default function MeasureForm({ userId }: Props) {
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [postcode, setPostcode] = useState('')
  const [roadAddress, setRoadAddress] = useState('')
  const [jibunAddress, setJibunAddress] = useState('')
  const [addressExtra, setAddressExtra] = useState('')
  const [isManualAddress, setIsManualAddress] = useState(false)
  const [showAddressSearch, setShowAddressSearch] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [visitDate, setVisitDate] = useState('')
  const [message, setMessage] = useState('')
  const [referrerName, setReferrerName] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [files, setFiles] = useState<FilePreview[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'platform' } }
  ), [])

  useEffect(() => {
    async function loadCategories() {
      try {
        const { data, error } = await supabase
          .from('measurement_product_categories')
          .select('key, label, description, image_url')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })

        if (error) {
          logError('Error fetching product categories', error)
          return
        }

        setCategories((data ?? []) as CategoryOption[])
      } catch (err) {
        logError('Unexpected error fetching categories', err)
      } finally {
        setCategoriesLoading(false)
      }
    }

    loadCategories()
  }, [supabase])

  const handleAddressComplete = (data: {
    postcode: string
    roadAddress: string
    jibunAddress: string
    addressExtra: string
    isManual: boolean
  }) => {
    setIsManualAddress(data.isManual)
    if (data.isManual) {
      setAddress('')
      setPostcode('')
      setRoadAddress('')
      setJibunAddress('')
      setAddressExtra('')
    } else {
      setPostcode(data.postcode)
      setRoadAddress(data.roadAddress)
      setJibunAddress(data.jibunAddress)
      setAddressExtra(data.addressExtra)
      setAddress(`${data.roadAddress}${data.addressExtra}`)
    }
    setShowAddressSearch(false)
  }

  const handleCategoryToggle = (key: string) => {
    setSelectedCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const selected = Array.from(event.target.files ?? [])
    if (!selected.length) return

    const combined = [...files, ...selected.map(file => ({
      file,
      previewUrl: null,
      type: (file.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
    }))]

    if (combined.length > MAX_FILE_COUNT) {
      setFileError(`최대 ${MAX_FILE_COUNT}개까지 첨부할 수 있습니다.`)
      return
    }

    if (selected.some(file => file.size > MAX_FILE_SIZE_MB * 1024 * 1024)) {
      setFileError(`파일 1개당 최대 ${MAX_FILE_SIZE_MB}MB까지 첨부할 수 있습니다.`)
      return
    }

    const totalBytes = combined.reduce((sum, item) => sum + item.file.size, 0)
    if (totalBytes > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
      setFileError(`전체 첨부 용량은 ${MAX_TOTAL_SIZE_MB}MB를 넘을 수 없습니다.`)
      return
    }

    setFiles(combined.map(item => {
      if (item.previewUrl) return item
      if (item.type === 'image') return { ...item, previewUrl: URL.createObjectURL(item.file) }
      return item
    }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [files])

  const removeFile = (index: number) => {
    setFiles(prev => {
      const removed = prev[index]
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const missingItems = [
    !name.trim() && '이름',
    !phone.trim() && '연락처',
    !address.trim() && '방문 주소',
    selectedCategories.length === 0 && '관심 제품',
    !visitDate && '방문 희망일',
    !privacy && '개인정보 동의',
  ].filter(Boolean) as string[]

  const isFormValid = missingItems.length === 0

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isFormValid) {
      setSubmitError(`아직 필요한 항목이 남아 있습니다: ${missingItems.join(', ')}`)
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const legacyCategoryKeys = ['middle_door', 'abs_door', 'front_door', 'molding_baseboard', 'other'] as const
      const firstCategory = selectedCategories[0]
      const legacyCategory = (
        legacyCategoryKeys.includes(firstCategory as (typeof legacyCategoryKeys)[number])
          ? firstCategory
          : 'other'
      ) as 'middle_door' | 'abs_door' | 'front_door' | 'molding_baseboard' | 'other'

      const { data: reqData, error: reqError } = await supabase
        .from('measurement_requests')
        .insert({
          customer_id: userId,
          customer_name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          address_detail: addressDetail.trim() || null,
          postcode: postcode || null,
          road_address: roadAddress || null,
          jibun_address: jibunAddress || null,
          address_extra: addressExtra || null,
          preferred_visit_date: visitDate,
          preferred_visit_time_slot: null,
          interest_categories: selectedCategories,
          is_manual_address: isManualAddress,
          interest_category: legacyCategory,
          preferred_schedule: visitDate,
          message: message.trim() || '상담 희망 내용 미기입',
          referrer_name: referrerName.trim() || null,
          privacy_agreed_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (reqError || !reqData) {
        logError('Insert measurement_request error', reqError)
        setSubmitError(reqError?.message || '신청 저장 중 오류가 발생했습니다. 날짜와 주소를 다시 확인해 주세요.')
        setSubmitting(false)
        return
      }

      const requestId = reqData.id

      for (const item of files) {
        const ext = item.file.name.split('.').pop() ?? 'bin'
        const objectPath = `${userId}/${requestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('measurement-media')
          .upload(objectPath, item.file, { cacheControl: '3600', upsert: false })

        if (uploadError) {
          logError('File upload error', uploadError)
          continue
        }

        await supabase.from('measurement_media').insert({
          request_id: requestId,
          customer_id: userId,
          bucket: 'measurement-media',
          object_path: objectPath,
          media_type: item.type,
          file_name: item.file.name,
          file_size: item.file.size,
        })
      }

      setStep('done')
    } catch (err) {
      logError('Submit measurement request unexpected error', err)
      setSubmitError('예상하지 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done') {
    return (
      <div className={styles.container}>
        <div className={styles.doneCard}>
          <CheckCircle2 size={44} strokeWidth={1.8} className={styles.doneIcon} aria-hidden="true" />
          <h1 className={styles.doneTitle}>신청이 접수되었습니다</h1>
          <p className={styles.doneDesc}>
            담당 매니저가 신청 내용과 방문 희망일을 확인한 뒤 연락드립니다.
            정확한 방문 시간은 방문 전날 오후에 안내됩니다.
          </p>
          <Link href="/portal" className={styles.doneBtn} id="btn-back-portal">
            고객 포털로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const totalSize = files.reduce((sum, item) => sum + item.file.size, 0)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/portal" className={styles.backLink} id="btn-back">
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
          고객 포털로 돌아가기
        </Link>
        <h1 className={styles.pageTitle}>무료방문 실측 견적상담 신청</h1>
      </header>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <section className={styles.noticePanel}>
          <p className={styles.noticeLead}>
            방문 실측과 견적 상담은 무료입니다. 방문 시간은 지역 동선을 기준으로 배정되며,
            방문 전날 오후 담당 매니저가 예상 시간을 안내드립니다.
          </p>
          <details className={styles.noticeDetails}>
            <summary>
              <span>신청 전 확인사항 자세히 보기</span>
              <small>가능 지역, 지정 요일, 접수 기준을 확인해 주세요.</small>
            </summary>
            <div className={styles.noticeGrid}>
              <div>
                <h2>수도권 가능 지역</h2>
                <p>서울, 인천, 경기 지역은 상시 운영합니다. 단, 일부 외곽 지역은 방문 동선과 일정에 따라 상담 가능 여부를 확인한 뒤 안내드립니다.</p>
              </div>
              <div>
                <h2>충청권 운영 지역</h2>
                <p>천안, 아산, 대전, 세종, 청주 지역은 매주 수요일과 토요일 중심으로 운영합니다. 신청 후 담당자가 가능한 일정을 확인해 연락드립니다.</p>
              </div>
              <div>
                <h2>방문이 어려운 지역</h2>
                <p>포천, 동두천, 여주, 가평, 양평, 연천 등 경기 외곽 일부 지역과 영종도, 강화도, 영흥도, 대부도 같은 도서 지역은 방문이 어려울 수 있습니다.</p>
              </div>
              <div>
                <h2>접수 시간 기준</h2>
                <p>내일 방문 희망 건은 오늘 오후 3시까지 접수해 주세요. 오후 3시 이후 신청 건은 최소 이틀 뒤 일정부터 조율됩니다.</p>
              </div>
              <div>
                <h2>방문 시간 안내</h2>
                <p>정확한 방문 시간은 사전 지정이 어렵습니다. 지역별 이동 동선을 기준으로 배정되며, 방문 전날 오후 담당 매니저가 예상 시간을 안내드립니다.</p>
              </div>
              <div>
                <h2>자주 묻는 질문</h2>
                <p>견적 상담은 무료입니다. 계약 후 시공은 보통 7~10일 이내 진행되며, 견적서는 발행일 기준 30일간 유효합니다.</p>
              </div>
            </div>
          </details>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>기본 정보</h2>
          <div className={styles.fieldGroup}>
            <label htmlFor="field-name" className={styles.label}>이름 <span className={styles.required}>*</span></label>
            <input id="field-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" className={styles.input} required autoComplete="name" />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="field-phone" className={styles.label}>연락처 <span className={styles.required}>*</span></label>
            <input id="field-phone" type="tel" value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" className={styles.input} required autoComplete="tel" inputMode="numeric" />
            <span className={styles.hint}>담당 매니저가 이 번호로 연락드립니다.</span>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="field-referrer" className={styles.label}>추천인</label>
            <input id="field-referrer" type="text" value={referrerName} onChange={e => setReferrerName(e.target.value)} placeholder="추천인이 있다면 이름이나 연락처를 적어주세요." className={styles.input} autoComplete="off" />
            <span className={styles.hint}>선택사항입니다. 지인 소개나 담당자 추천이 있을 때만 작성해 주세요.</span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>방문 주소</h2>
          <div className={styles.fieldGroup}>
            <label htmlFor="field-address" className={styles.label}>기본 주소 <span className={styles.required}>*</span></label>
            <div className={styles.addressSearchRow}>
              <input
                id="field-address"
                type="text"
                value={address}
                readOnly={!isManualAddress}
                onChange={e => isManualAddress && setAddress(e.target.value)}
                onClick={() => !isManualAddress && setShowAddressSearch(true)}
                placeholder={isManualAddress ? '도로명 주소 또는 지번 주소 입력' : '주소 검색 버튼을 눌러주세요.'}
                className={`${styles.input} ${styles.addressInput}`}
                required
              />
              <button type="button" onClick={() => setShowAddressSearch(true)} className={styles.addressBtn}>
                주소 검색
              </button>
            </div>
            {isManualAddress && <span className={styles.manualAddressBadge}>수동 주소 입력 중입니다. 접수 후 주소 확인을 진행합니다.</span>}
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="field-address-detail" className={styles.label}>상세 주소</label>
            <input id="field-address-detail" type="text" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} placeholder="101동 1001호" className={styles.input} />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>관심 제품</h2>
          <p className={styles.sectionDesc}>상담받고 싶은 품목을 여러 개 선택할 수 있습니다.</p>
          {categoriesLoading ? (
            <div className={styles.spinnerWrapper}>
              <div className={styles.miniSpinner} />
              <span>품목을 불러오고 있습니다.</span>
            </div>
          ) : (
            <div className={styles.productList}>
              {categories.map(option => {
                const isActive = selectedCategories.includes(option.key)
                return (
                  <label key={option.key} className={`${styles.productOption} ${isActive ? styles.productOptionActive : ''}`}>
                    <input type="checkbox" checked={isActive} onChange={() => handleCategoryToggle(option.key)} className={styles.srOnly} />
                    <span className={styles.productCheck} aria-hidden="true" />
                    <span className={styles.productCopy}>
                      <strong>{option.label}</strong>
                      {option.description && <span>{option.description}</span>}
                    </span>
                    <span className={styles.productThumb}>
                      {option.image_url ? (
                        <Image src={option.image_url} alt="" width={72} height={72} unoptimized />
                      ) : (
                        <span className={styles.productThumbPlaceholder} />
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>상담 희망 내용</h2>
          <div className={styles.fieldGroup}>
            <label htmlFor="field-message" className={styles.label}>상담 희망 내용</label>
            <textarea id="field-message" value={message} onChange={e => setMessage(e.target.value)} placeholder="원하시는 제품, 현재 상황, 궁금한 점을 자유롭게 적어주세요." className={styles.textarea} rows={4} />
            <span className={styles.hint}>선택사항입니다. 사진과 주소만으로도 신청할 수 있습니다.</span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>방문 희망일</h2>
          <p className={styles.sectionDesc}>가능한 날짜만 선택할 수 있습니다. 정확한 방문 시간은 전날 오후에 안내됩니다.</p>
          <VisitDatePicker selectedDate={visitDate} onChange={setVisitDate} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>현장 사진 / 동영상 선택</h2>
          <p className={styles.sectionDesc}>현장 사진이나 동영상을 첨부하면 더 정확한 상담이 가능합니다. 파일당 최대 {MAX_FILE_SIZE_MB}MB, 최대 {MAX_FILE_COUNT}개까지 선택할 수 있습니다.</p>
          <div className={styles.uploadArea}>
            <button type="button" id="btn-add-files" onClick={() => fileInputRef.current?.click()} className={styles.uploadButton} disabled={files.length >= MAX_FILE_COUNT}>
              <Paperclip size={16} strokeWidth={1.8} aria-hidden="true" />
              사진 / 동영상 선택
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/x-msvideo" multiple onChange={handleFileChange} className={styles.srOnly} aria-label="파일 첨부" />
            {files.length > 0 && <span className={styles.fileCount}>{files.length}개 선택됨 ({formatBytes(totalSize)})</span>}
          </div>
          {fileError && <p className={styles.fileError} role="alert">{fileError}</p>}
          {files.length > 0 && (
            <ul className={styles.previewGrid}>
              {files.map((item, index) => (
                <li key={`${item.file.name}-${index}`} className={styles.previewItem}>
                  {item.type === 'image' && item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt={item.file.name} className={styles.previewImg} />
                  ) : (
                    <div className={styles.previewVideo}>동영상</div>
                  )}
                  <div className={styles.previewInfo}>
                    <span className={styles.previewName}>{item.file.name}</span>
                    <span className={styles.previewSize}>{formatBytes(item.file.size)}</span>
                  </div>
                  <button type="button" onClick={() => removeFile(index)} className={styles.previewRemove} aria-label={`${item.file.name} 삭제`}>
                    <X size={14} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <label className={styles.privacyLabel}>
            <input id="field-privacy" type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} className={styles.checkbox} required />
            <span><strong>[필수]</strong> 개인정보 수집 및 이용에 동의합니다. 이름, 연락처, 주소는 무료방문 실측 견적상담 제공 목적으로만 사용합니다.</span>
          </label>
        </section>

        {missingItems.length > 0 && (
          <div className={styles.missingBox} role="status">
            남은 필수 항목: {missingItems.join(', ')}
          </div>
        )}
        {submitError && <div className={styles.submitError} role="alert">{submitError}</div>}

        <button id="btn-submit-measure" type="submit" disabled={submitting || !isFormValid} className={styles.submitButton}>
          {submitting ? '신청 중...' : '무료방문 실측 견적상담 신청하기'}
        </button>
      </form>

      {showAddressSearch && (
        <DaumAddressSearch onComplete={handleAddressComplete} onClose={() => setShowAddressSearch(false)} />
      )}
    </div>
  )
}
