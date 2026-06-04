'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import styles from './platform-detail.module.css'

interface MediaItem {
  id: string
  object_path: string
  media_type: 'image' | 'video'
  file_name: string
  file_size: number
}

interface DetailClientProps {
  requestId: string
  request: {
    id: string
    customer_name: string
    phone: string
    applicant_relationship: string | null
    contact_name: string | null
    contact_phone: string | null
    contact_relationship: string | null
    additional_contacts: unknown
    address: string
    address_detail: string | null
    postcode: string | null
    road_address: string | null
    jibun_address: string | null
    address_extra: string | null
    preferred_visit_date: string | null
    preferred_visit_time_slot: string | null
    interest_categories: string[] | null
    is_manual_address: boolean
    interest_category: string
    message: string
    referrer_name: string | null
    service_region: string | null
    service_region_status: string
    preferred_schedule: string | null
    status: string
    appsheet_status: string
    privacy_agreed_at: string
    created_at: string
  }
  media: MediaItem[]
}

interface AdditionalContact {
  name?: string
  phone?: string
  relationship?: string
  note?: string
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: '신규 접수' },
  { value: 'appsheet_pending', label: '등록 대기' },
  { value: 'appsheet_registered', label: '접수 완료' },
  { value: 'assigned', label: '담당자 배정' },
  { value: 'scheduled', label: '방문 예정' },
  { value: 'measured', label: '실측 완료' },
  { value: 'cancelled', label: '취소' },
]

const APPSHEET_OPTIONS = [
  { value: 'pending', label: '대기' },
  { value: 'registered', label: '등록 완료' },
  { value: 'skipped', label: '생략' },
]

const FALLBACK_CATEGORY_LABEL: Record<string, string> = {
  middle_door: '중문',
  abs_door: 'ABS 도어',
  front_door: '현관문',
  molding_baseboard: '몰딩/걸레받이',
  other: '기타',
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export default function DetailClient({ requestId, request, media }: DetailClientProps) {
  const router = useRouter()
  const [status, setStatus] = useState(request.status)
  const [appsheetStatus, setAppsheetStatus] = useState(request.appsheet_status)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'platform' } }
  ), [])

  useEffect(() => {
    async function loadCategories() {
      try {
        const { data } = await supabase
          .from('measurement_product_categories')
          .select('key, label')
        if (data) {
          const map = data.reduce<Record<string, string>>((acc, category) => {
            acc[category.key] = category.label
            return acc
          }, {})
          setCategoryMap(map)
        }
      } catch (err) {
        logError('Error fetching category labels for detail', err)
      }
    }
    loadCategories()
  }, [supabase])

  const handleStatusSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(`/api/platform/measure/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, appsheet_status: appsheetStatus, memo }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        setSaveMsg(`저장 실패: ${err?.error ?? '알 수 없는 오류'}`)
      } else {
        setSaveMsg('저장되었습니다.')
        setMemo('')
        router.refresh()
      }
    } catch (err) {
      logError('Status save error', err)
      setSaveMsg('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const fetchSignedUrl = async (item: MediaItem) => {
    if (signedUrls[item.id]) return
    setLoadingMedia(prev => ({ ...prev, [item.id]: true }))
    try {
      const res = await fetch(
        `/api/platform/measure/media-url?object_path=${encodeURIComponent(item.object_path)}`
      )
      const data = await res.json()
      if (data.url) {
        setSignedUrls(prev => ({ ...prev, [item.id]: data.url }))
      }
    } catch (err) {
      logError('Fetch signed URL error', err)
    } finally {
      setLoadingMedia(prev => ({ ...prev, [item.id]: false }))
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const getCategoryLabelList = () => {
    if (request.interest_categories && request.interest_categories.length > 0) {
      return request.interest_categories.map(key => categoryMap[key] || FALLBACK_CATEGORY_LABEL[key] || key).join(', ')
    }
    return FALLBACK_CATEGORY_LABEL[request.interest_category] || request.interest_category
  }

  const getScheduleText = () => request.preferred_visit_date || request.preferred_schedule || '미기입'

  const additionalContacts = Array.isArray(request.additional_contacts)
    ? request.additional_contacts as AdditionalContact[]
    : []

  const formatAdditionalContacts = () => {
    if (additionalContacts.length === 0) return ''
    return additionalContacts
      .map((contact, index) => {
        const parts = [
          contact.name,
          contact.phone,
          contact.relationship ? `관계: ${contact.relationship}` : '',
          contact.note ? `메모: ${contact.note}` : '',
        ].filter(Boolean)
        return `${index + 1}. ${parts.join(' / ')}`
      })
      .join('\n')
  }

  const primaryContactText = [
    request.contact_name || request.customer_name,
    request.contact_phone || request.phone,
    request.contact_relationship ? `관계: ${request.contact_relationship}` : '',
  ].filter(Boolean).join(' / ')

  const appsheetBlock = [
    `신청자: ${request.customer_name}`,
    `신청자 연락처: ${request.phone}`,
    `신청자 관계: ${request.applicant_relationship || ''}`,
    `대표 연락 대상: ${primaryContactText}`,
    `추가 연락 대상: ${formatAdditionalContacts()}`,
    `추천인: ${request.referrer_name || ''}`,
    `우편번호: ${request.postcode || ''}`,
    `기본주소: ${request.road_address || request.address}`,
    `상세주소: ${request.address_detail || ''}`,
    `지번주소: ${request.jibun_address || ''}`,
    `참고항목: ${request.address_extra || ''}`,
    `주소유형: ${request.is_manual_address ? '수동 입력, 주소 검토 필요' : '주소 검색 입력'}`,
    `서비스 지역: ${request.service_region || ''} / ${request.service_region_status || ''}`,
    `관심품목: ${getCategoryLabelList()}`,
    `희망 방문일: ${getScheduleText()}`,
    `상담내용: ${request.message}`,
    `접수일시: ${new Date(request.created_at).toLocaleString('ko-KR')}`,
  ].join('\n')

  return (
    <div className={styles.page}>
      <button onClick={() => router.push('/admin/platform')} className={styles.backBtn} id="btn-back-list">
        목록으로
      </button>

      {request.is_manual_address && (
        <div className={styles.manualNoticeBanner} role="alert">
          <strong>수동 주소 검토 필요</strong>
          <span>주소 검색을 통하지 않고 입력된 건입니다. 도로명주소, 상세주소, 방문 가능 지역 여부를 담당자가 확인해 주세요.</span>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>고객 기본정보</h2>
            <dl className={styles.infoList}>
              <dt>이름</dt>
              <dd>{request.customer_name}</dd>
              <dt>연락처</dt>
              <dd>
                <span>{request.phone}</span>
                <button type="button" className={styles.copyBtn} onClick={() => copyToClipboard(request.phone, 'phone')}>
                  {copied === 'phone' ? '복사됨' : '복사'}
                </button>
              </dd>
              {request.applicant_relationship && (
                <>
                  <dt>신청자 관계</dt>
                  <dd>{request.applicant_relationship}</dd>
                </>
              )}
              <dt>대표 연락 대상</dt>
              <dd>
                <span>{primaryContactText}</span>
                <button type="button" className={styles.copyBtn} onClick={() => copyToClipboard(request.contact_phone || request.phone, 'contactPhone')}>
                  {copied === 'contactPhone' ? '복사됨' : '복사'}
                </button>
              </dd>
              {additionalContacts.length > 0 && (
                <>
                  <dt>추가 연락 대상</dt>
                  <dd className={styles.messageText}>{formatAdditionalContacts()}</dd>
                </>
              )}
              {request.referrer_name && (
                <>
                  <dt>추천인</dt>
                  <dd>{request.referrer_name}</dd>
                </>
              )}
              <dt>기본주소</dt>
              <dd>
                <span>{request.road_address || request.address}</span>
                <button type="button" className={styles.copyBtn} onClick={() => copyToClipboard(request.road_address || request.address, 'roadAddress')}>
                  {copied === 'roadAddress' ? '복사됨' : '복사'}
                </button>
              </dd>
              {request.address_detail && (
                <>
                  <dt>상세주소</dt>
                  <dd>
                    <span>{request.address_detail}</span>
                    <button type="button" className={styles.copyBtn} onClick={() => copyToClipboard(request.address_detail || '', 'addrDetail')}>
                      {copied === 'addrDetail' ? '복사됨' : '복사'}
                    </button>
                  </dd>
                </>
              )}
              {request.postcode && (
                <>
                  <dt>우편번호</dt>
                  <dd>{request.postcode}</dd>
                </>
              )}
              {request.jibun_address && (
                <>
                  <dt>지번주소</dt>
                  <dd>{request.jibun_address}</dd>
                </>
              )}
              {request.address_extra && (
                <>
                  <dt>참고항목</dt>
                  <dd>{request.address_extra}</dd>
                </>
              )}
              <dt>주소유형</dt>
              <dd>
                <span className={`${styles.addressTypeBadge} ${request.is_manual_address ? styles.typeManual : styles.typeApi}`}>
                  {request.is_manual_address ? '수동 입력' : '주소 검색'}
                </span>
              </dd>
              {request.service_region && (
                <>
                  <dt>서비스 지역</dt>
                  <dd>{request.service_region} / {request.service_region_status}</dd>
                </>
              )}
            </dl>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>상담 및 일정</h2>
            <dl className={styles.infoList}>
              <dt>관심품목</dt>
              <dd>
                {request.interest_categories && request.interest_categories.length > 0 ? (
                  <div className={styles.categoryBadgeRow}>
                    {request.interest_categories.map(key => (
                      <span key={key} className={styles.catBadge}>
                        {categoryMap[key] || FALLBACK_CATEGORY_LABEL[key] || key}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span>{FALLBACK_CATEGORY_LABEL[request.interest_category] || request.interest_category}</span>
                )}
              </dd>
              <dt>희망 방문일</dt>
              <dd><strong>{getScheduleText()}</strong></dd>
              <dt>상담내용</dt>
              <dd className={styles.messageText}>{request.message}</dd>
            </dl>
          </div>

          {media.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>현장 사진 및 미디어 ({media.length}개)</h2>
              <ul className={styles.mediaList}>
                {media.map(item => (
                  <li key={item.id} className={styles.mediaItem}>
                    <div className={styles.mediaInfo}>
                      <span className={styles.mediaType}>{item.media_type === 'image' ? '이미지' : '동영상'}</span>
                      <span className={styles.mediaName}>{item.file_name}</span>
                      <span className={styles.mediaSize}>{formatBytes(item.file_size)}</span>
                    </div>
                    {signedUrls[item.id] ? (
                      <a
                        href={signedUrls[item.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.mediaLink}
                      >
                        열기
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fetchSignedUrl(item)}
                        disabled={loadingMedia[item.id]}
                        className={styles.mediaFetchBtn}
                      >
                        {loadingMedia[item.id] ? '불러오는 중' : '미리보기'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.col}>
          <div className={`${styles.card} ${styles.appsheetCard}`}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>AppSheet 등록용 정보</h2>
              <button
                type="button"
                className={styles.copyAllBtn}
                onClick={() => copyToClipboard(appsheetBlock, 'appsheet')}
                id="btn-copy-appsheet"
              >
                {copied === 'appsheet' ? '복사됨' : '전체 복사'}
              </button>
            </div>
            <pre className={styles.appsheetText}>{appsheetBlock}</pre>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>상태 변경</h2>
            <div className={styles.statusRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="sel-status" className={styles.fieldLabel}>접수 상태</label>
                <select
                  id="sel-status"
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                  className={styles.select}
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="sel-appsheet" className={styles.fieldLabel}>AppSheet 상태</label>
                <select
                  id="sel-appsheet"
                  value={appsheetStatus}
                  onChange={event => setAppsheetStatus(event.target.value)}
                  className={styles.select}
                >
                  {APPSHEET_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="field-memo" className={styles.fieldLabel}>메모</label>
              <textarea
                id="field-memo"
                value={memo}
                onChange={event => setMemo(event.target.value)}
                placeholder="상태 변경 사유나 내부 메모를 입력하세요."
                className={styles.textarea}
                rows={3}
              />
            </div>
            {saveMsg && (
              <div className={`${styles.saveMsg} ${saveMsg.includes('실패') || saveMsg.includes('오류') ? styles.saveMsgError : styles.saveMsgOk}`}>
                {saveMsg}
              </div>
            )}
            <button
              id="btn-save-status"
              onClick={handleStatusSave}
              disabled={saving}
              className={styles.saveBtn}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>접수 정보</h2>
            <dl className={styles.infoList}>
              <dt>접수 ID</dt>
              <dd className={styles.idText}>{request.id}</dd>
              <dt>접수일시</dt>
              <dd>{new Date(request.created_at).toLocaleString('ko-KR')}</dd>
              <dt>개인정보 동의</dt>
              <dd>{new Date(request.privacy_agreed_at).toLocaleString('ko-KR')}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
