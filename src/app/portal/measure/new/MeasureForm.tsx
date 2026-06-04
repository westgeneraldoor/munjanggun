'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Home,
  MapPin,
  Paperclip,
  Plus,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import DaumAddressSearch from '@/components/platform/DaumAddressSearch'
import VisitDatePicker, { type VisitRegionMode } from '@/components/platform/VisitDatePicker'
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

interface ExtraContact {
  id: string
  name: string
  phone: string
  relationship: string
  note: string
}

type ServiceRegionStatus = 'supported' | 'chungcheong_limited' | 'unsupported' | 'unknown'

interface ServiceRegion {
  status: ServiceRegionStatus
  label: string
  mode: VisitRegionMode
  title: string
  description: string
}

const MAX_FILE_COUNT = 10
const MAX_FILE_SIZE_MB = 50
const MAX_TOTAL_SIZE_MB = 200

const FLOW_STEPS = [
  { key: 'start', title: '안내', helper: '무료 상담 범위' },
  { key: 'contact', title: '연락', helper: '누가 연락받나요' },
  { key: 'address', title: '주소', helper: '방문 가능 지역' },
  { key: 'products', title: '품목', helper: '필요한 공사' },
  { key: 'schedule', title: '일정', helper: '가능한 방문일' },
  { key: 'finish', title: '마무리', helper: '사진과 요청사항' },
] as const

const CHUNGCHEONG_KEYWORDS = ['천안', '아산', '청주', '세종', '대전']
const SUPPORTED_KEYWORDS = ['서울', '인천', '경기']
const UNSUPPORTED_GYEONGGI_KEYWORDS = ['연천', '가평', '양평', '여주', '포천', '동두천', '파주']

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

function makeContactId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function classifyServiceRegion(addressText: string): ServiceRegion {
  const normalized = addressText.replace(/\s/g, '')

  if (!normalized) {
    return {
      status: 'unknown',
      label: '주소 확인 전',
      mode: 'standard',
      title: '주소를 선택하면 방문 가능 여부를 바로 확인해드릴게요.',
      description: '문장군 방문 상담 가능 지역인지, 선택 가능한 방문일이 달라지는 지역인지 이 단계에서 먼저 안내합니다.',
    }
  }

  if (CHUNGCHEONG_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return {
      status: 'chungcheong_limited',
      label: '충청권 제한 운영',
      mode: 'chungcheong_limited',
      title: '이 지역은 수요일과 토요일 중심으로 방문 상담을 운영합니다.',
      description: '천안, 아산, 청주, 세종, 대전은 담당자 동선이 정해진 날에 맞춰 방문 상담을 도와드리고 있어요.',
    }
  }

  if (UNSUPPORTED_GYEONGGI_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return {
      status: 'unsupported',
      label: '방문 상담 어려움',
      mode: 'unsupported',
      title: '현재 문장군 방문 상담 가능 지역 밖입니다.',
      description: '이 주소는 현재 무료방문 실측견적 상담 접수가 어렵습니다. 가능 지역이 넓어지면 다시 안내드릴게요.',
    }
  }

  if (SUPPORTED_KEYWORDS.some(keyword => normalized.includes(keyword))) {
    return {
      status: 'supported',
      label: '방문 가능 지역',
      mode: 'standard',
      title: '방문 상담 가능 지역입니다.',
      description: '이제 가능한 방문일을 선택하면 담당자가 전날 코스를 확정해 시간 안내를 드립니다.',
    }
  }

  return {
    status: 'unsupported',
    label: '방문 상담 어려움',
    mode: 'unsupported',
    title: '현재 문장군 방문 상담 가능 지역 밖입니다.',
    description: '주소 기준으로는 무료방문 실측견적 상담 접수가 어렵습니다. 접수 전에 방문 가능 지역부터 넓혀가겠습니다.',
  }
}

export default function MeasureForm({ userId }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [applicantRelationship, setApplicantRelationship] = useState('본인')
  const [sameContact, setSameContact] = useState(true)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactRelationship, setContactRelationship] = useState('')
  const [extraContacts, setExtraContacts] = useState<ExtraContact[]>([])

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

  const regionText = [address, roadAddress, jibunAddress].filter(Boolean).join(' ')
  const serviceRegion = useMemo(() => classifyServiceRegion(regionText), [regionText])

  const primaryContact = {
    name: sameContact ? name.trim() : contactName.trim(),
    phone: sameContact ? phone.trim() : contactPhone.trim(),
    relationship: sameContact ? (applicantRelationship.trim() || '신청자') : contactRelationship.trim(),
  }

  const handleAddressComplete = (data: {
    postcode: string
    roadAddress: string
    jibunAddress: string
    addressExtra: string
    isManual: boolean
  }) => {
    setIsManualAddress(data.isManual)
    setVisitDate('')
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

  const addExtraContact = () => {
    setExtraContacts(prev => [...prev, { id: makeContactId(), name: '', phone: '', relationship: '', note: '' }])
  }

  const updateExtraContact = (id: string, field: keyof Omit<ExtraContact, 'id'>, value: string) => {
    setExtraContacts(prev => prev.map(contact => (
      contact.id === id ? { ...contact, [field]: field === 'phone' ? formatPhone(value) : value } : contact
    )))
  }

  const removeExtraContact = (id: string) => {
    setExtraContacts(prev => prev.filter(contact => contact.id !== id))
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

  const stepErrors = useMemo(() => {
    const errors: Record<number, string[]> = {
      0: [],
      1: [
        !name.trim() && '신청자 이름',
        !phone.trim() && '신청자 연락처',
        !sameContact && !contactName.trim() && '연락받을 분 이름',
        !sameContact && !contactPhone.trim() && '연락받을 분 연락처',
        !sameContact && !contactRelationship.trim() && '연락받을 분 관계',
      ].filter(Boolean) as string[],
      2: [
        !address.trim() && '방문 주소',
        serviceRegion.status === 'unsupported' && '방문 가능 지역',
      ].filter(Boolean) as string[],
      3: [
        selectedCategories.length === 0 && '관심 품목',
      ].filter(Boolean) as string[],
      4: [
        !visitDate && '방문 희망일',
      ].filter(Boolean) as string[],
      5: [
        !privacy && '개인정보 동의',
      ].filter(Boolean) as string[],
    }
    return errors
  }, [address, contactName, contactPhone, contactRelationship, name, phone, privacy, sameContact, selectedCategories.length, serviceRegion.status, visitDate])

  const isCurrentStepValid = stepErrors[currentStep]?.length === 0
  const allMissingItems = FLOW_STEPS.flatMap((_, index) => stepErrors[index] ?? [])
  const isFormValid = allMissingItems.length === 0
  const totalSize = files.reduce((sum, item) => sum + item.file.size, 0)

  const goNext = () => {
    setSubmitError(null)
    if (!isCurrentStepValid) {
      setSubmitError(`아직 필요한 항목이 남아 있습니다: ${stepErrors[currentStep].join(', ')}`)
      return
    }
    setCurrentStep(step => Math.min(step + 1, FLOW_STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goPrev = () => {
    setSubmitError(null)
    setCurrentStep(step => Math.max(step - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    if (!isFormValid) {
      setSubmitError(`아직 필요한 항목이 남아 있습니다: ${allMissingItems.join(', ')}`)
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

      const additionalContacts = extraContacts
        .map(contact => ({
          name: contact.name.trim(),
          phone: contact.phone.trim(),
          relationship: contact.relationship.trim(),
          note: contact.note.trim(),
        }))
        .filter(contact => contact.name || contact.phone || contact.relationship || contact.note)

      const { data: reqData, error: reqError } = await supabase
        .from('measurement_requests')
        .insert({
          customer_id: userId,
          customer_name: name.trim(),
          phone: phone.trim(),
          applicant_relationship: applicantRelationship.trim() || null,
          contact_name: primaryContact.name,
          contact_phone: primaryContact.phone,
          contact_relationship: primaryContact.relationship || null,
          additional_contacts: additionalContacts,
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
          service_region: serviceRegion.label,
          service_region_status: serviceRegion.status,
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

      setIsDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      logError('Submit measurement request unexpected error', err)
      setSubmitError('예상하지 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const stepTitle = FLOW_STEPS[currentStep].title
  const progressPercent = Math.round(((currentStep + 1) / FLOW_STEPS.length) * 100)

  if (isDone) {
    return (
      <div className={styles.container}>
        <div className={styles.doneShell}>
          <Link href="/" className={styles.logoLink} id="btn-done-home">MUNJANGGUN</Link>
          <div className={styles.doneCard}>
            <CheckCircle2 size={46} strokeWidth={1.7} className={styles.doneIcon} aria-hidden="true" />
            <h1 className={styles.doneTitle}>접수되었습니다.</h1>
            <p className={styles.doneDesc}>
              담당자가 주소, 품목, 방문 희망일을 확인한 뒤 연락드릴게요.
              방문 시간은 전날 오후 4~5시쯤 코스 마감 후 안내드립니다.
            </p>
            <div className={styles.doneNotice}>
              전화가 부재중이면 문자라도 남겨드립니다. 안내받은 시간이 맞지 않으면 일정 변경도 도와드려요.
            </div>
            <div className={styles.doneActions}>
              <Link href="/portal" className={styles.doneBtn} id="btn-back-portal">마이페이지에서 확인</Link>
              <Link href="/" className={styles.doneSecondaryBtn} id="btn-back-home">홈으로 돌아가기</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} id="btn-measure-home">MUNJANGGUN</Link>
        <div className={styles.topActions}>
          <Link href="/portal" className={styles.topLink} id="btn-back">
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            마이페이지
          </Link>
          <Link href="/" className={styles.iconLink} aria-label="홈으로 이동">
            <Home size={17} strokeWidth={1.9} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className={styles.shell}>
        <aside className={styles.rail} aria-label="접수 진행 단계">
          <div className={styles.railCopy}>
            <p className={styles.railLabel}>무료방문 실측견적 상담</p>
            <h1>조금씩 확인하고 접수할게요.</h1>
            <p>중간에 막히지 않도록 필요한 내용만 나누어 묻습니다.</p>
          </div>
          <div className={styles.progressBlock}>
            <div className={styles.progressText}>
              <span>{stepTitle}</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div className={styles.progressTrack}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <ol className={styles.stepList}>
            {FLOW_STEPS.map((step, index) => (
              <li key={step.key} className={`${styles.stepItem} ${index === currentStep ? styles.stepActive : ''} ${index < currentStep ? styles.stepDone : ''}`}>
                <span>{index < currentStep ? <Check size={14} strokeWidth={2.3} /> : index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <small>{step.helper}</small>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        <section className={styles.panel}>
          {currentStep === 0 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>시작하기 전에</p>
                <h2>무료방문 실측견적 상담은 무료입니다.</h2>
                <p>
                  상담을 받고 진행하지 않아도 비용이 들지 않습니다. 우리 집에 가능한지, 어떤 방식이 맞을지 부담 없이 먼저 확인해드릴게요.
                </p>
              </div>
              <div className={styles.reassuranceList}>
                <div>
                  <CalendarDays size={20} strokeWidth={1.8} aria-hidden="true" />
                  <strong>시간은 전날 안내드려요</strong>
                  <span>방문 전날 오후 4~5시쯤 코스를 마감하고 담당자가 직접 연락드립니다.</span>
                </div>
                <div>
                  <UserRound size={20} strokeWidth={1.8} aria-hidden="true" />
                  <strong>연락받을 분을 따로 적을 수 있어요</strong>
                  <span>집주인, 세입자, 배우자처럼 실제 연락받아야 하는 분을 함께 남겨주세요.</span>
                </div>
                <div>
                  <Camera size={20} strokeWidth={1.8} aria-hidden="true" />
                  <strong>사진은 있으면 좋아요</strong>
                  <span>필수는 아니지만 현장 사진이 있으면 상담이 더 정확해집니다.</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>연락 정보</p>
                <h2>누가 신청하고, 누가 연락을 받으면 될까요?</h2>
                <p>신청자와 실제 연락받을 분이 달라도 괜찮습니다. 집주인과 세입자 모두 연락이 필요하면 추가 연락처에 남겨주세요.</p>
              </div>

              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span>신청자 이름 <b>*</b></span>
                  <input value={name} onChange={event => setName(event.target.value)} placeholder="홍길동" autoComplete="name" />
                </label>
                <label className={styles.field}>
                  <span>신청자 연락처 <b>*</b></span>
                  <input value={phone} onChange={event => setPhone(formatPhone(event.target.value))} placeholder="010-0000-0000" autoComplete="tel" inputMode="numeric" />
                </label>
              </div>

              <label className={styles.field}>
                <span>신청자 관계</span>
                <input value={applicantRelationship} onChange={event => setApplicantRelationship(event.target.value)} placeholder="본인, 남편, 집주인, 세입자 등" />
              </label>

              <div className={styles.segmentGroup} role="radiogroup" aria-label="연락받을 사람 선택">
                <button type="button" className={sameContact ? styles.segmentActive : styles.segment} onClick={() => setSameContact(true)}>
                  신청자가 연락받아요
                </button>
                <button type="button" className={!sameContact ? styles.segmentActive : styles.segment} onClick={() => setSameContact(false)}>
                  다른 분이 연락받아요
                </button>
              </div>

              {!sameContact && (
                <div className={styles.softBox}>
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>연락받을 분 이름 <b>*</b></span>
                      <input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="연락받을 분 이름" />
                    </label>
                    <label className={styles.field}>
                      <span>연락받을 분 연락처 <b>*</b></span>
                      <input value={contactPhone} onChange={event => setContactPhone(formatPhone(event.target.value))} placeholder="010-0000-0000" inputMode="numeric" />
                    </label>
                  </div>
                  <label className={styles.field}>
                    <span>신청자와의 관계 <b>*</b></span>
                    <input value={contactRelationship} onChange={event => setContactRelationship(event.target.value)} placeholder="아내, 세입자, 집주인, 현장 담당자 등" />
                  </label>
                </div>
              )}

              <div className={styles.extraContactHeader}>
                <div>
                  <strong>추가로 함께 연락받을 분</strong>
                  <span>집주인과 세입자 모두 연락이 필요할 때 남겨주세요.</span>
                </div>
                <button type="button" onClick={addExtraContact} className={styles.addButton}>
                  <Plus size={16} strokeWidth={2} aria-hidden="true" />
                  추가
                </button>
              </div>

              {extraContacts.map((contact, index) => (
                <div key={contact.id} className={styles.contactCard}>
                  <div className={styles.contactCardTop}>
                    <strong>추가 연락처 {index + 1}</strong>
                    <button type="button" onClick={() => removeExtraContact(contact.id)} aria-label="추가 연락처 삭제">
                      <Trash2 size={16} strokeWidth={1.9} />
                    </button>
                  </div>
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>이름</span>
                      <input value={contact.name} onChange={event => updateExtraContact(contact.id, 'name', event.target.value)} placeholder="이름" />
                    </label>
                    <label className={styles.field}>
                      <span>연락처</span>
                      <input value={contact.phone} onChange={event => updateExtraContact(contact.id, 'phone', event.target.value)} placeholder="010-0000-0000" inputMode="numeric" />
                    </label>
                  </div>
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>관계</span>
                      <input value={contact.relationship} onChange={event => updateExtraContact(contact.id, 'relationship', event.target.value)} placeholder="집주인, 세입자 등" />
                    </label>
                    <label className={styles.field}>
                      <span>메모</span>
                      <input value={contact.note} onChange={event => updateExtraContact(contact.id, 'note', event.target.value)} placeholder="언제 연락하면 좋은지 등" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>방문 주소</p>
                <h2>방문할 주소를 확인할게요.</h2>
                <p>주소를 기준으로 방문 가능 지역과 선택 가능한 요일을 먼저 확인합니다.</p>
              </div>

              <div className={styles.addressSearchRow}>
                <label className={styles.field}>
                  <span>기본 주소 <b>*</b></span>
                  <input
                    value={address}
                    readOnly={!isManualAddress}
                    onChange={event => isManualAddress && setAddress(event.target.value)}
                    onClick={() => !isManualAddress && setShowAddressSearch(true)}
                    placeholder={isManualAddress ? '도로명 주소 또는 지번 주소 입력' : '주소 검색 버튼을 눌러주세요'}
                  />
                </label>
                <button type="button" onClick={() => setShowAddressSearch(true)} className={styles.addressButton}>
                  <MapPin size={17} strokeWidth={1.8} aria-hidden="true" />
                  주소 검색
                </button>
              </div>

              {isManualAddress && (
                <p className={styles.inlineCaution}>수동 주소 입력 중입니다. 지역 판정이 정확하지 않으면 접수가 제한될 수 있어요.</p>
              )}

              <label className={styles.field}>
                <span>상세 주소</span>
                <input value={addressDetail} onChange={event => setAddressDetail(event.target.value)} placeholder="동, 호수, 현관 비밀번호 메모 등" />
              </label>

              <div className={`${styles.regionNotice} ${styles[`region_${serviceRegion.status}`]}`}>
                <strong>{serviceRegion.title}</strong>
                <span>{serviceRegion.description}</span>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>관심 품목</p>
                <h2>어떤 공사를 상담받고 싶으세요?</h2>
                <p>정확하지 않아도 괜찮습니다. 관련 있어 보이는 항목을 여러 개 선택해 주세요.</p>
              </div>

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
                        <span className={styles.productCheck} aria-hidden="true">{isActive && <Check size={14} strokeWidth={2.2} />}</span>
                        <span className={styles.productCopy}>
                          <strong>{option.label}</strong>
                          {option.description && <span>{option.description}</span>}
                        </span>
                        <span className={styles.productThumb}>
                          {option.image_url ? (
                            <Image src={option.image_url} alt="" width={78} height={78} unoptimized />
                          ) : (
                            <span className={styles.productThumbPlaceholder} />
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>방문 희망일</p>
                <h2>가능한 날짜를 선택해 주세요.</h2>
                <p>시간 지정은 어렵지만, 담당자가 방문 전날 오후 4~5시쯤 코스를 마감하고 직접 안내드립니다.</p>
              </div>

              <div className={styles.scheduleGuide}>
                <strong>전화가 부재중이면 문자라도 남겨드려요.</strong>
                <span>안내받은 시간이 맞지 않으면 일정을 변경해 드립니다. 이 단계에서는 가능한 날짜만 골라주세요.</span>
              </div>

              <VisitDatePicker selectedDate={visitDate} onChange={setVisitDate} regionMode={serviceRegion.mode} />
            </div>
          )}

          {currentStep === 5 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>이제 얼마 남지 않았어요</p>
                <h2>사진과 요청사항을 남기면 더 정확해집니다.</h2>
                <p>사진은 필수가 아닙니다. 다만 현장 상태가 보이면 방문 전 상담 품질이 좋아져요.</p>
              </div>

              <label className={styles.field}>
                <span>상담 희망 내용</span>
                <textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="원하는 제품, 현재 상황, 궁금한 점을 편하게 적어주세요." rows={4} />
              </label>

              <label className={styles.field}>
                <span>추천인</span>
                <input value={referrerName} onChange={event => setReferrerName(event.target.value)} placeholder="추천인이 있다면 이름이나 연락처를 적어주세요." />
              </label>

              <div className={styles.uploadPanel}>
                <div>
                  <strong>사진 또는 동영상 첨부</strong>
                  <span>파일 1개당 최대 {MAX_FILE_SIZE_MB}MB, 최대 {MAX_FILE_COUNT}개까지 가능합니다.</span>
                </div>
                <button type="button" id="btn-add-files" onClick={() => fileInputRef.current?.click()} className={styles.uploadButton} disabled={files.length >= MAX_FILE_COUNT}>
                  <Paperclip size={16} strokeWidth={1.8} aria-hidden="true" />
                  파일 선택
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/x-msvideo" multiple onChange={handleFileChange} className={styles.srOnly} aria-label="파일 첨부" />
              </div>

              {fileError && <p className={styles.fileError} role="alert">{fileError}</p>}
              {files.length > 0 && (
                <>
                  <p className={styles.fileCount}>{files.length}개 선택됨, 총 {formatBytes(totalSize)}</p>
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
                </>
              )}

              <div className={styles.reviewBox}>
                <strong>접수 내용 확인</strong>
                <dl>
                  <dt>신청자</dt>
                  <dd>{name || '-'} / {phone || '-'}</dd>
                  <dt>연락 대상</dt>
                  <dd>{primaryContact.name || '-'} / {primaryContact.phone || '-'} {primaryContact.relationship ? `(${primaryContact.relationship})` : ''}</dd>
                  <dt>주소</dt>
                  <dd>{address || '-'} {addressDetail}</dd>
                  <dt>방문 희망일</dt>
                  <dd>{visitDate || '-'}</dd>
                  <dt>지역</dt>
                  <dd>{serviceRegion.label}</dd>
                </dl>
              </div>

              <label className={styles.privacyLabel}>
                <input type="checkbox" checked={privacy} onChange={event => setPrivacy(event.target.checked)} className={styles.checkbox} />
                <span><strong>[필수]</strong> 개인정보 수집 및 이용에 동의합니다. 이름, 연락처, 주소는 무료방문 실측견적 상담 제공 목적으로만 사용합니다.</span>
              </label>
            </div>
          )}

          {submitError && <div className={styles.submitError} role="alert">{submitError}</div>}

          <footer className={styles.navFooter}>
            <button type="button" onClick={goPrev} disabled={currentStep === 0 || submitting} className={styles.secondaryButton}>
              <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
              이전
            </button>
            {currentStep < FLOW_STEPS.length - 1 ? (
              <button type="button" onClick={goNext} className={styles.primaryButton}>
                다음
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : (
              <button id="btn-submit-measure" type="button" onClick={handleSubmit} disabled={submitting || !isFormValid} className={styles.primaryButton}>
                {submitting ? '접수 중...' : '무료방문 실측견적 상담 신청하기'}
              </button>
            )}
          </footer>
        </section>
      </main>

      {showAddressSearch && (
        <DaumAddressSearch onComplete={handleAddressComplete} onClose={() => setShowAddressSearch(false)} />
      )}
    </div>
  )
}
