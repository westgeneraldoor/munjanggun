'use client'

import React, { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Home,
  Paperclip,
  Trash2,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import styles from './as-form.module.css'

interface Props {
  userId: string
}

interface FilePreview {
  file: File
  previewUrl: string | null
  type: 'image' | 'video'
}

const MAX_FILE_COUNT = 6
const MAX_FILE_SIZE_MB = 50

const STEPS = [
  { title: '안내', helper: '먼저 안심하셔도 돼요' },
  { title: '연락처', helper: '누가 연락을 받으면 좋을까요' },
  { title: '내용', helper: '어떤 부분을 봐드릴까요' },
  { title: '사진', helper: '있으면 더 정확해요' },
] as const

const ISSUE_OPTIONS = [
  { value: 'door_adjustment', label: '문 여닫힘/수평', desc: '문이 닿거나, 잘 닫히지 않거나, 틈이 신경 쓰이는 경우' },
  { value: 'film_damage', label: '필름/표면 손상', desc: '찍힘, 벗겨짐, 표면 오염처럼 외관 확인이 필요한 경우' },
  { value: 'hardware', label: '손잡이/부속', desc: '손잡이, 경첩, 레일, 부속품 움직임이 불편한 경우' },
  { value: 'noise', label: '소음/간섭', desc: '열고 닫을 때 소리나 걸림이 느껴지는 경우' },
  { value: 'other', label: '기타 문의', desc: '위 항목으로 딱 나누기 어려운 경우' },
]

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

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default function AsForm({ userId }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [sameContact, setSameContact] = useState(true)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactRelationship, setContactRelationship] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [issueType, setIssueType] = useState('door_adjustment')
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal')
  const [preferredContactMethod, setPreferredContactMethod] = useState<'phone' | 'sms' | 'kakao'>('phone')
  const [message, setMessage] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [files, setFiles] = useState<FilePreview[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'platform' } }
  ), [])

  const progress = ((currentStep + 1) / STEPS.length) * 100

  const primaryContact = {
    name: sameContact ? customerName.trim() : contactName.trim(),
    phone: sameContact ? phone.trim() : contactPhone.trim(),
    relationship: sameContact ? '접수자 본인' : contactRelationship.trim(),
  }

  const canGoNext = useMemo(() => {
    if (currentStep === 0) return true
    if (currentStep === 1) {
      if (!customerName.trim() || phone.replace(/\D/g, '').length < 10) return false
      if (!sameContact && (!contactName.trim() || contactPhone.replace(/\D/g, '').length < 10 || !contactRelationship.trim())) return false
      return true
    }
    if (currentStep === 2) return message.trim().length >= 8
    return privacy
  }, [contactName, contactPhone, contactRelationship, currentStep, customerName, message, phone, privacy, sameContact])

  const handleFiles = (selected: FileList | null) => {
    setFileError(null)
    if (!selected || selected.length === 0) return

    const incoming = Array.from(selected)
    if (files.length + incoming.length > MAX_FILE_COUNT) {
      setFileError(`사진과 동영상은 최대 ${MAX_FILE_COUNT}개까지 올릴 수 있어요.`)
      return
    }

    const nextFiles: FilePreview[] = []
    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFileError(`파일 1개는 ${MAX_FILE_SIZE_MB}MB 이하로 올려주세요.`)
        return
      }

      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      if (!isImage && !isVideo) {
        setFileError('사진 또는 동영상 파일만 올릴 수 있어요.')
        return
      }

      nextFiles.push({
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        type: isImage ? 'image' : 'video',
      })
    }

    setFiles(prev => [...prev, ...nextFiles])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => {
      const target = prev[index]
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const submit = async () => {
    if (!privacy || submitting) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const { data, error } = await supabase
        .from('as_requests')
        .insert({
          customer_id: userId,
          customer_name: customerName.trim(),
          phone: phone.trim(),
          contact_name: sameContact ? null : contactName.trim(),
          contact_phone: sameContact ? null : contactPhone.trim(),
          contact_relationship: sameContact ? null : contactRelationship.trim(),
          address: address.trim() || null,
          address_detail: addressDetail.trim() || null,
          issue_type: issueType,
          urgency,
          preferred_contact_method: preferredContactMethod,
          message: message.trim(),
          privacy_agreed_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error || !data) throw error ?? new Error('AS request was not created.')

      for (const [index, item] of files.entries()) {
        const objectPath = `${userId}/as/${data.id}/${Date.now()}-${index}-${sanitizeFileName(item.file.name)}`
        const { error: uploadError } = await supabase.storage
          .from('measurement-media')
          .upload(objectPath, item.file, {
            contentType: item.file.type,
            upsert: false,
          })

        if (uploadError) throw uploadError

        const { error: mediaError } = await supabase.from('as_media').insert({
          request_id: data.id,
          customer_id: userId,
          bucket: 'measurement-media',
          object_path: objectPath,
          media_type: item.type,
          file_name: item.file.name,
          file_size: item.file.size,
        })

        if (mediaError) throw mediaError
      }

      setIsDone(true)
    } catch (err) {
      logError('AS request submit error', err)
      setSubmitError('접수 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => {
    if (!canGoNext) return
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  if (isDone) {
    return (
      <div className={styles.container}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.logoLink}>MUNJANGGUN</Link>
          <Link href="/portal" className={styles.topLink}>
            <Home size={16} aria-hidden="true" />
            <span>마이페이지</span>
          </Link>
        </header>
        <main className={styles.doneShell}>
          <div className={styles.donePanel}>
            <CheckCircle2 size={44} aria-hidden="true" />
            <p className={styles.doneKicker}>A/S 접수가 완료되었습니다</p>
            <h1>남겨주신 내용을 확인하고 연락드릴게요.</h1>
            <p>
              사진과 증상을 함께 확인한 뒤 담당자가 연락드립니다. 전화 연결이 어려우면 문자나 카카오 안내를 남겨드릴 수 있어요.
            </p>
            <div className={styles.doneActions}>
              <Link href="/portal" className={styles.primaryButton}>마이페이지로 이동</Link>
              <Link href="/" className={styles.secondaryButton}>홈으로 이동</Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.logoLink}>MUNJANGGUN</Link>
        <div className={styles.topActions}>
          <Link href="/portal" className={styles.topLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>마이페이지</span>
          </Link>
          <Link href="/" className={styles.iconLink} aria-label="홈으로 이동">
            <Home size={17} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className={styles.shell}>
        <aside className={styles.rail}>
          <div className={styles.railCopy}>
            <p>A/S 접수</p>
            <h1>불편한 부분을 차분히 확인해볼게요.</h1>
            <span>사진이 없어도 접수할 수 있고, 사진이 있으면 담당자가 더 정확히 보고 연락드릴 수 있어요.</span>
          </div>
          <div className={styles.progressBlock}>
            <div className={styles.progressText}>
              <span>{currentStep + 1} / {STEPS.length}</span>
              <strong>{Math.round(progress)}%</strong>
            </div>
            <div className={styles.progressTrack}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <ol className={styles.stepList}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={index === currentStep ? styles.stepActive : index < currentStep ? styles.stepDone : ''}>
                <span>{index < currentStep ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
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
                <p className={styles.stepKicker}>먼저 안내드릴게요</p>
                <h2>A/S가 필요한 상황을 남겨주시면 문장군이 확인하고 연락드려요.</h2>
                <p>
                  시공 이후 확인이 필요한 부분을 편하게 남겨주세요. 접수 내용은 담당자가 보고 연락드리며, 방문이 필요한 경우 일정 안내까지 이어집니다.
                </p>
              </div>
              <div className={styles.noticeGrid}>
                <div>
                  <strong>사진은 선택입니다</strong>
                  <p>사진이 있으면 더 빠르게 판단할 수 있지만, 없어도 접수는 가능합니다.</p>
                </div>
                <div>
                  <strong>연락받을 사람을 따로 적을 수 있어요</strong>
                  <p>접수자와 실제 현장 연락자가 다르면 다음 단계에서 따로 남겨주세요.</p>
                </div>
                <div>
                  <strong>급한 건은 표시해주세요</strong>
                  <p>사용이 어렵거나 안전상 불편한 경우 우선 확인이 필요하다고 알려주세요.</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>연락 정보</p>
                <h2>접수하시는 분과 연락받을 분을 알려주세요.</h2>
                <p>집주인, 세입자, 가족처럼 접수자와 현장 연락자가 다를 수 있어요. 필요한 연락 흐름을 편하게 남겨주세요.</p>
              </div>
              <div className={styles.formGrid}>
                <label>
                  <span>접수자 이름</span>
                  <input id="as-customer-name" value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="예: 홍길동" />
                </label>
                <label>
                  <span>접수자 연락처</span>
                  <input id="as-phone" value={phone} onChange={event => setPhone(formatPhone(event.target.value))} inputMode="tel" placeholder="010-0000-0000" />
                </label>
              </div>
              <label className={styles.toggleRow}>
                <input type="checkbox" checked={sameContact} onChange={event => setSameContact(event.target.checked)} />
                <span>접수자가 직접 연락을 받습니다</span>
              </label>
              {!sameContact && (
                <div className={styles.formGrid}>
                  <label>
                    <span>연락받을 분</span>
                    <input id="as-contact-name" value={contactName} onChange={event => setContactName(event.target.value)} placeholder="예: 배우자, 세입자" />
                  </label>
                  <label>
                    <span>연락받을 분 연락처</span>
                    <input id="as-contact-phone" value={contactPhone} onChange={event => setContactPhone(formatPhone(event.target.value))} inputMode="tel" placeholder="010-0000-0000" />
                  </label>
                  <label className={styles.fullWidth}>
                    <span>접수자와의 관계</span>
                    <input id="as-contact-relationship" value={contactRelationship} onChange={event => setContactRelationship(event.target.value)} placeholder="예: 배우자, 세입자, 현장 담당자" />
                  </label>
                </div>
              )}
              <div className={styles.formGrid}>
                <label className={styles.fullWidth}>
                  <span>현장 주소</span>
                  <input id="as-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="예: 서울시 강남구 ..." />
                </label>
                <label className={styles.fullWidth}>
                  <span>상세 주소</span>
                  <input id="as-address-detail" value={addressDetail} onChange={event => setAddressDetail(event.target.value)} placeholder="동, 호수, 현관 비밀번호 안내가 필요하면 함께 적어주세요" />
                </label>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>A/S 내용</p>
                <h2>어떤 부분을 확인하면 좋을까요?</h2>
                <p>정확히 몰라도 괜찮아요. 가장 가까운 항목을 고르고, 실제로 느끼는 불편함을 그대로 적어주세요.</p>
              </div>
              <div className={styles.optionGrid} role="radiogroup" aria-label="A/S 유형">
                {ISSUE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    id={`as-issue-${option.value}`}
                    className={issueType === option.value ? styles.optionSelected : styles.optionCard}
                    onClick={() => setIssueType(option.value)}
                    aria-pressed={issueType === option.value}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.desc}</span>
                  </button>
                ))}
              </div>
              <div className={styles.segmentGroup}>
                <p>확인 우선도</p>
                <div>
                  <button type="button" className={urgency === 'normal' ? styles.segmentActive : ''} onClick={() => setUrgency('normal')}>일반 확인</button>
                  <button type="button" className={urgency === 'urgent' ? styles.segmentActive : ''} onClick={() => setUrgency('urgent')}>빠른 확인 필요</button>
                </div>
              </div>
              <div className={styles.segmentGroup}>
                <p>연락 선호 방식</p>
                <div>
                  <button type="button" className={preferredContactMethod === 'phone' ? styles.segmentActive : ''} onClick={() => setPreferredContactMethod('phone')}>전화</button>
                  <button type="button" className={preferredContactMethod === 'sms' ? styles.segmentActive : ''} onClick={() => setPreferredContactMethod('sms')}>문자</button>
                  <button type="button" className={preferredContactMethod === 'kakao' ? styles.segmentActive : ''} onClick={() => setPreferredContactMethod('kakao')}>카카오</button>
                </div>
              </div>
              <label className={styles.textareaLabel}>
                <span>불편한 내용을 적어주세요</span>
                <textarea
                  id="as-message"
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  placeholder="예: 중문을 닫을 때 아래쪽이 바닥에 살짝 닿는 느낌이 있고, 닫힐 때 소리가 납니다."
                  rows={6}
                />
              </label>
            </div>
          )}

          {currentStep === 3 && (
            <div className={styles.stepScreen}>
              <div className={styles.screenHeader}>
                <p className={styles.stepKicker}>마무리</p>
                <h2>사진이 있으면 올려주세요. 없으면 바로 접수해도 됩니다.</h2>
                <p>전체 모습 1장과 문제가 보이는 부분 1장을 함께 올리면 담당자가 상황을 더 쉽게 확인할 수 있어요.</p>
              </div>
              <div className={styles.uploadBox}>
                <input
                  ref={fileInputRef}
                  id="as-files"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={event => handleFiles(event.target.files)}
                  hidden
                />
                <button type="button" onClick={() => fileInputRef.current?.click()} className={styles.uploadButton}>
                  <Camera size={18} aria-hidden="true" />
                  <span>사진/동영상 선택</span>
                </button>
                <p>최대 {MAX_FILE_COUNT}개, 파일 1개당 {MAX_FILE_SIZE_MB}MB 이하</p>
              </div>
              {fileError && <p className={styles.errorText}>{fileError}</p>}
              {files.length > 0 && (
                <ul className={styles.fileList}>
                  {files.map((item, index) => (
                    <li key={`${item.file.name}-${index}`}>
                      <div className={styles.fileThumb}>
                        {item.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.previewUrl} alt="" />
                        ) : (
                          <Paperclip size={18} aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <strong>{item.file.name}</strong>
                        <span>{formatBytes(item.file.size)}</span>
                      </div>
                      <button type="button" onClick={() => removeFile(index)} aria-label={`${item.file.name} 삭제`}>
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.summaryBox}>
                <strong>접수 후 연락받을 분</strong>
                <p>{primaryContact.name} · {primaryContact.phone} · {primaryContact.relationship}</p>
              </div>
              <label className={styles.privacyRow}>
                <input id="as-privacy" type="checkbox" checked={privacy} onChange={event => setPrivacy(event.target.checked)} />
                <span>접수 내용 확인과 안내 연락을 위한 개인정보 수집 및 이용에 동의합니다.</span>
              </label>
              {submitError && <p className={styles.errorText}>{submitError}</p>}
            </div>
          )}

          <footer className={styles.actions}>
            <button type="button" onClick={goBack} disabled={currentStep === 0 || submitting} className={styles.secondaryButton}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>이전</span>
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button type="button" onClick={goNext} disabled={!canGoNext} className={styles.primaryButton}>
                <span>다음</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button id="btn-submit-as" type="button" onClick={submit} disabled={!canGoNext || submitting} className={styles.primaryButton}>
                {submitting ? '접수 중' : 'A/S 접수하기'}
              </button>
            )}
          </footer>
        </section>
      </main>
    </div>
  )
}
