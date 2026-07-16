'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import {
  PlatformButton,
  PlatformField,
  PlatformLinkButton,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSelect,
  PlatformStatePanel,
  PlatformStatusBadge,
} from '@/components/platform/ui'
import styles from './platform-detail.module.css'

interface MediaItem {
  id: string
  media_type: 'image' | 'video'
  file_name: string
  file_size: number
}

interface DetailClientProps {
  requestId: string
  initialCategoryMap?: Record<string, string>
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
  { value: 'contacted', label: '연락 완료' },
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

const KOREAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function formatKoreanDateTime(value: string) {
  const parts = Object.fromEntries(
    KOREAN_DATE_TIME_FORMATTER
      .formatToParts(new Date(value))
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  )
  return `${parts.year}. ${parts.month}. ${parts.day}. ${parts.hour}:${parts.minute}:${parts.second}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

interface FeedbackState {
  tone: 'success' | 'error'
  message: string
}

export default function DetailClient({ requestId, request, media, initialCategoryMap }: DetailClientProps) {
  const router = useRouter()
  const [status, setStatus] = useState(request.status)
  const [appsheetStatus, setAppsheetStatus] = useState(request.appsheet_status)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({})
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(initialCategoryMap ?? {})

  const supabase = useMemo(() => initialCategoryMap ? null : createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'platform' } }
  ), [initialCategoryMap])

  useEffect(() => {
    async function loadCategories() {
      if (!supabase) return
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
    setSaveFeedback(null)
    try {
      const res = await fetch(`/api/platform/measure/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, appsheet_status: appsheetStatus, memo }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        setSaveFeedback({
          tone: 'error',
          message: `저장 실패: ${typeof err?.error === 'string' ? err.error : '알 수 없는 오류'}`,
        })
      } else {
        setSaveFeedback({ tone: 'success', message: '상태를 저장했습니다.' })
        setMemo('')
        router.refresh()
      }
    } catch (err) {
      logError('Status save error', err)
      setSaveFeedback({ tone: 'error', message: '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => document.getElementById('btn-save-status')?.focus({ preventScroll: true }))
      })
    }
  }

  const requestMediaUrl = async (item: MediaItem, force = false) => {
    if (mediaUrls[item.id] && !force) return
    setLoadingMedia(prev => ({ ...prev, [item.id]: true }))
    setMediaErrors(prev => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
    try {
      const res = await fetch(
        `/api/platform/measure/media-url?media_id=${encodeURIComponent(item.id)}`
      )
      if (!res.ok) throw new Error('Private media URL request failed')
      const data = await res.json()
      const expectedUrl = `/api/platform/measure/media-file?media_id=${encodeURIComponent(item.id)}`
      if (data.url !== expectedUrl) throw new Error('Private media URL is not opaque')
      setMediaUrls(prev => ({ ...prev, [item.id]: expectedUrl }))
    } catch (err) {
      logError('Fetch signed URL error', err)
      setMediaErrors(prev => ({ ...prev, [item.id]: '미디어를 불러오지 못했습니다. 다시 시도해 주세요.' }))
    } finally {
      setLoadingMedia(prev => ({ ...prev, [item.id]: false }))
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(current => current === key ? null : current), 2000)
    } catch (err) {
      logError('Clipboard copy error', err)
      setCopied(null)
      setCopyError('클립보드에 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.')
    }
  }

  const refreshMediaUrl = (item: MediaItem) => requestMediaUrl(item, true)

  const copyAccessibleLabel = (defaultLabel: string, key: string) => (
    copied === key ? `${defaultLabel} 완료` : defaultLabel
  )

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
    `접수일시: ${formatKoreanDateTime(request.created_at)}`,
  ].join('\n')

  return (
    <div className={styles.page} data-admin-detail>
      <PlatformPageHeader
        className={styles.pageHeader}
        title="접수 상세"
        description="고객 요청과 처리 상태를 한 화면에서 확인합니다."
        actions={(
          <PlatformLinkButton href="/admin/platform" variant="secondary" id="btn-back-list">
            접수 목록으로
          </PlatformLinkButton>
        )}
      />

      {copyError ? <p className={styles.copyError} role="alert">{copyError}</p> : null}

      {request.is_manual_address && (
        <PlatformStatePanel
          className={styles.manualNoticeBanner}
          tone="error"
          title="수동 주소 검토 필요"
          description="주소 검색을 통하지 않고 입력된 건입니다. 도로명주소, 상세주소, 방문 가능 지역 여부를 담당자가 확인해 주세요."
        />
      )}

      <div className={styles.grid}>
        <div className={styles.col}>
          <PlatformPanel as="section" className={styles.card}>
            <h2 className={styles.cardTitle}>고객 기본정보</h2>
            <dl className={styles.infoList}>
              <dt>이름</dt>
              <dd>{request.customer_name}</dd>
              <dt>연락처</dt>
              <dd>
                <span>{request.phone}</span>
                <PlatformButton type="button" variant="secondary" size="sm" aria-label={copyAccessibleLabel('전화번호 복사', 'phone')} onClick={() => copyToClipboard(request.phone, 'phone')}>
                  {copied === 'phone' ? '복사됨' : '복사'}
                </PlatformButton>
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
                <PlatformButton type="button" variant="secondary" size="sm" aria-label={copyAccessibleLabel('대표 연락처 복사', 'contactPhone')} onClick={() => copyToClipboard(request.contact_phone || request.phone, 'contactPhone')}>
                  {copied === 'contactPhone' ? '복사됨' : '복사'}
                </PlatformButton>
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
                <PlatformButton type="button" variant="secondary" size="sm" aria-label={copyAccessibleLabel('기본 주소 복사', 'roadAddress')} onClick={() => copyToClipboard(request.road_address || request.address, 'roadAddress')}>
                  {copied === 'roadAddress' ? '복사됨' : '복사'}
                </PlatformButton>
              </dd>
              {request.address_detail && (
                <>
                  <dt>상세주소</dt>
                  <dd>
                    <span>{request.address_detail}</span>
                    <PlatformButton type="button" variant="secondary" size="sm" aria-label={copyAccessibleLabel('상세 주소 복사', 'addrDetail')} onClick={() => copyToClipboard(request.address_detail || '', 'addrDetail')}>
                      {copied === 'addrDetail' ? '복사됨' : '복사'}
                    </PlatformButton>
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
                <PlatformStatusBadge tone={request.is_manual_address ? 'danger' : 'success'}>
                  {request.is_manual_address ? '수동 입력' : '주소 검색'}
                </PlatformStatusBadge>
              </dd>
              {request.service_region && (
                <>
                  <dt>서비스 지역</dt>
                  <dd>{request.service_region} / {request.service_region_status}</dd>
                </>
              )}
            </dl>
          </PlatformPanel>

          <PlatformPanel as="section" className={styles.card}>
            <h2 className={styles.cardTitle}>상담 및 일정</h2>
            <dl className={styles.infoList}>
              <dt>관심품목</dt>
              <dd>
                {request.interest_categories && request.interest_categories.length > 0 ? (
                  <div className={styles.categoryBadgeRow}>
                    {request.interest_categories.map(key => (
                      <PlatformStatusBadge key={key} tone="info">
                        {categoryMap[key] || FALLBACK_CATEGORY_LABEL[key] || key}
                      </PlatformStatusBadge>
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
          </PlatformPanel>

          <PlatformPanel as="section" className={styles.card}>
            <h2 className={styles.cardTitle}>현장 사진 및 미디어 ({media.length}개)</h2>
            {media.length === 0 ? (
              <PlatformStatePanel tone="empty" title="첨부된 미디어가 없습니다." />
            ) : (
              <ul className={styles.mediaList}>
                {media.map(item => {
                  const mediaErrorId = `media-error-${item.id}`
                  const hasMediaUrl = Boolean(mediaUrls[item.id])
                  return (
                    <li key={item.id} className={styles.mediaItem}>
                      <div className={styles.mediaInfo}>
                        <PlatformStatusBadge tone="neutral">{item.media_type === 'image' ? '이미지' : '동영상'}</PlatformStatusBadge>
                        <span className={styles.mediaName}>{item.file_name}</span>
                        <span className={styles.mediaSize}>{formatBytes(item.file_size)}</span>
                      </div>
                      <div className={styles.mediaActions}>
                        {hasMediaUrl ? (
                          <PlatformLinkButton
                            href={mediaUrls[item.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="secondary"
                            size="sm"
                            aria-label={`${item.file_name} 새 창에서 열기`}
                          >
                            새 창에서 열기
                          </PlatformLinkButton>
                        ) : null}
                        <PlatformButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => hasMediaUrl ? refreshMediaUrl(item) : requestMediaUrl(item)}
                          isLoading={Boolean(loadingMedia[item.id])}
                          loadingLabel="불러오는 중"
                          aria-label={`${item.file_name} ${hasMediaUrl ? '보안 링크 다시 받기' : mediaErrors[item.id] ? '다시 시도' : '미리보기'}`}
                          aria-describedby={mediaErrors[item.id] ? mediaErrorId : undefined}
                        >
                          {hasMediaUrl ? '보안 링크 다시 받기' : mediaErrors[item.id] ? '다시 시도' : '미리보기'}
                        </PlatformButton>
                      </div>
                      {mediaErrors[item.id] ? (
                        <p id={mediaErrorId} className={styles.mediaError} role="alert">{mediaErrors[item.id]}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </PlatformPanel>
        </div>

        <div className={styles.col}>
          <PlatformPanel as="section" className={`${styles.card} ${styles.appsheetCard}`}>
            <div className={styles.cardTitleRow}>
              <h2 className={styles.cardTitle}>AppSheet 등록용 정보</h2>
              <PlatformButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(appsheetBlock, 'appsheet')}
                id="btn-copy-appsheet"
                aria-label={copyAccessibleLabel('AppSheet 등록 정보 복사', 'appsheet')}
              >
                {copied === 'appsheet' ? '복사됨' : '전체 복사'}
              </PlatformButton>
            </div>
            <pre className={styles.appsheetText}>{appsheetBlock}</pre>
          </PlatformPanel>

          <PlatformPanel as="section" className={styles.card}>
            <h2 className={styles.cardTitle}>상태 변경</h2>
            <div className={styles.statusRow}>
              <PlatformSelect
                id="sel-status"
                label="접수 상태"
                value={status}
                onChange={event => setStatus(event.target.value)}
                options={STATUS_OPTIONS}
              />
              <PlatformSelect
                id="sel-appsheet"
                label="AppSheet 상태"
                value={appsheetStatus}
                onChange={event => setAppsheetStatus(event.target.value)}
                options={APPSHEET_OPTIONS}
              />
            </div>
            <PlatformField
              multiline
              id="field-memo"
              label="메모"
              value={memo}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setMemo(event.target.value)}
              placeholder="상태 변경 사유나 내부 메모를 입력하세요."
              rows={3}
            />
            {saveFeedback ? (
              <PlatformStatePanel
                className={styles.inlineState}
                tone={saveFeedback.tone}
                title={saveFeedback.message}
              />
            ) : null}
            <PlatformButton
              id="btn-save-status"
              type="button"
              onClick={handleStatusSave}
              isLoading={saving}
              loadingLabel="저장 중"
              fullWidth
            >
              상태 저장
            </PlatformButton>
          </PlatformPanel>

          <PlatformPanel as="section" className={styles.card}>
            <h2 className={styles.cardTitle}>접수 정보</h2>
            <dl className={styles.infoList}>
              <dt>접수 ID</dt>
              <dd className={styles.idText}>{request.id}</dd>
              <dt>접수일시</dt>
              <dd>{formatKoreanDateTime(request.created_at)}</dd>
              <dt>개인정보 동의</dt>
              <dd>{formatKoreanDateTime(request.privacy_agreed_at)}</dd>
            </dl>
          </PlatformPanel>
        </div>
      </div>
    </div>
  )
}
