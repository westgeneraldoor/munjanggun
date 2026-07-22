'use client'

import React, { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  Pencil,
  Ruler,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import MunjanggunWordmark from '@/app/blog/BlogBrandWordmark'
import {
  CustomerCollectionPanel,
  type CustomerBlogActivityPost,
  type CustomerBlogActivityQuestion,
} from '@/components/platform/customer/CustomerCollectionPanel'
import { CustomerRequestStatus, QueueSourceType } from '@/types/database'
import { logError } from '@/lib/logger'
import styles from './portal.module.css'

interface UserProfile {
  id: string
  email: string
  displayName: string
  phone: string
  role: string
}

interface RecentMeasurementRequest {
  id: string
  customer_status: CustomerRequestStatus
  customer_action_note: string | null
  address: string
  created_at: string
  interest_category: string
  interest_categories: string[] | null
}

interface RecentAsRequest {
  id: string
  customer_status: CustomerRequestStatus
  customer_action_note: string | null
  issue_type: string
  address: string | null
  created_at: string
}

interface ActionTarget {
  sourceType: QueueSourceType
  requestId: string
  action: 'change' | 'cancel'
  title: string
  description: string
}

const CUSTOMER_STATUS_LABEL: Record<CustomerRequestStatus, string> = {
  confirmation_pending: '확정대기',
  confirmed: '접수확정',
  change_pending: '수정대기',
  change_confirmed: '수정확정',
  cancel_pending: '취소대기',
  cancel_confirmed: '취소확정',
}

const CATEGORY_LABEL: Record<string, string> = {
  middle_door: '중문',
  abs_door: 'ABS 도어',
  front_door: '현관문',
  molding_baseboard: '몰딩/걸레받이',
  other: '기타',
}

const ISSUE_LABEL: Record<string, string> = {
  customer_description: '상세 내용',
  door_adjustment: '문 여닫힘/수평',
  film_damage: '필름/표면 손상',
  hardware: '손잡이/부속 문제',
  noise: '소음/간섭',
  other: '기타 문의',
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function normalizeDisplayName(value: string | null | undefined, role: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed || /^[?\s]+$/.test(trimmed) || trimmed.includes('�')) {
    return role === 'administrator' ? '문장군 관리자' : '문장군 고객'
  }
  return trimmed
}

function canRequestChange(status: CustomerRequestStatus) {
  return status !== 'cancel_pending' && status !== 'cancel_confirmed'
}

function canRequestCancel(status: CustomerRequestStatus) {
  return status !== 'cancel_pending' && status !== 'cancel_confirmed'
}

export default function PortalPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [recentMeasurements, setRecentMeasurements] = useState<RecentMeasurementRequest[]>([])
  const [recentAsRequests, setRecentAsRequests] = useState<RecentAsRequest[]>([])
  const [likedPosts, setLikedPosts] = useState<CustomerBlogActivityPost[]>([])
  const [recentViewedPosts, setRecentViewedPosts] = useState<CustomerBlogActivityPost[]>([])
  const [blogQuestions, setBlogQuestions] = useState<CustomerBlogActivityQuestion[]>([])
  const [activityCounts, setActivityCounts] = useState({ likes: 0, questions: 0, recent: 0 })
  const [activityError, setActivityError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountOpen, setAccountOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState({ displayName: '', phone: '' })
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  const [actionMemo, setActionMemo] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const modalTextareaRef = React.useRef<HTMLTextAreaElement>(null)
  const modalReturnFocusRef = React.useRef<HTMLElement | null>(null)

  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) return null

    return createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      { db: { schema: 'platform' } }
    )
  }, [])

  const fetchUser = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      return
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login?next=/portal')
        return
      }

      const { data: profileData, error: profileFetchError } = await supabase
        .from('profiles')
        .select('display_name, phone, email, role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileFetchError) logError('Fetch portal profile error', profileFetchError)

      const dbProfile = profileData as {
        display_name: string | null
        phone: string | null
        email: string | null
        role: 'customer' | 'sales_manager' | 'administrator'
      } | null

      const nextProfile = {
        id: user.id,
        email: dbProfile?.email || user.email || '',
        displayName: normalizeDisplayName(
          dbProfile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name,
          dbProfile?.role || 'customer'
        ),
        phone: dbProfile?.phone || '',
        role: dbProfile?.role || 'customer',
      }
      setProfile(nextProfile)
      setProfileDraft({ displayName: nextProfile.displayName, phone: nextProfile.phone })

      const [measureResult, asResult, likesResult, questionsResult, recentResult] = await Promise.all([
        supabase
          .from('measurement_requests')
          .select('id, customer_status, customer_action_note, address, created_at, interest_category, interest_categories')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('as_requests')
          .select('id, customer_status, customer_action_note, issue_type, address, created_at')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('blog_article_likes')
          .select('id, post_slug, post_title_snapshot, created_at', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('blog_article_questions')
          .select('id, post_slug, post_title_snapshot, status, created_at', { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('blog_article_recent_views')
          .select('id, post_slug, post_title_snapshot, last_viewed_at', { count: 'exact' })
          .eq('user_id', user.id)
          .order('last_viewed_at', { ascending: false })
          .limit(5),
      ])

      if (measureResult.error) logError('Fetch measurement requests error', measureResult.error)
      else setRecentMeasurements((measureResult.data ?? []) as RecentMeasurementRequest[])

      if (asResult.error) logError('Fetch AS requests error', asResult.error)
      else setRecentAsRequests((asResult.data ?? []) as RecentAsRequest[])

      const activityLoadFailed = Boolean(likesResult.error || questionsResult.error || recentResult.error)
      setActivityError(activityLoadFailed ? '나의 활동을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.' : null)

      if (likesResult.error) logError('Fetch liked blog posts error', likesResult.error)
      else setLikedPosts((likesResult.data ?? []) as CustomerBlogActivityPost[])

      if (questionsResult.error) logError('Fetch blog questions error', questionsResult.error)
      else setBlogQuestions((questionsResult.data ?? []) as CustomerBlogActivityQuestion[])

      if (recentResult.error) logError('Fetch recent blog views error', recentResult.error)
      else setRecentViewedPosts((recentResult.data ?? []) as CustomerBlogActivityPost[])

      setActivityCounts({
        likes: likesResult.count ?? 0,
        questions: questionsResult.count ?? 0,
        recent: recentResult.count ?? 0,
      })
    } catch (error) {
      logError('Fetch portal unexpected error', error)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- authenticated portal data is initialized after mount.
    void fetchUser()
  }, [fetchUser])

  const handleLogout = async () => {
    if (!supabase) return

    try {
      const { error } = await supabase.auth.signOut()
      if (error) logError('Portal signout error', error)
      router.push('/blog')
      router.refresh()
    } catch (error) {
      logError('Portal signout unexpected error', error)
    }
  }

  const startProfileEdit = () => {
    if (!profile) return
    setProfileDraft({ displayName: profile.displayName, phone: profile.phone })
    setProfileError(null)
    setProfileNotice(null)
    setEditingProfile(true)
  }

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !profile || profileBusy) return

    const displayName = profileDraft.displayName.trim()
    const phone = formatPhone(profileDraft.phone)

    if (displayName.length < 1 || displayName.length > 50) {
      setProfileError('이름은 1~50자로 입력해 주세요.')
      return
    }

    if (phone && !/^01\d-\d{3,4}-\d{4}$/.test(phone)) {
      setProfileError('전화번호를 010-0000-0000 형식으로 확인해 주세요.')
      return
    }

    setProfileBusy(true)
    setProfileError(null)
    setProfileNotice(null)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: displayName, phone: phone || null })
        .eq('id', profile.id)
        .select('display_name, phone')
        .single()

      if (error) throw error

      setProfile(current => current ? {
        ...current,
        displayName: data.display_name || displayName,
        phone: data.phone || '',
      } : current)
      setProfileDraft({ displayName: data.display_name || displayName, phone: data.phone || '' })
      setEditingProfile(false)
      setProfileNotice('나의 정보를 수정했어요.')
    } catch (error) {
      logError('Save portal profile error', error)
      setProfileError('지금은 정보를 수정하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setProfileBusy(false)
    }
  }

  const openAction = (target: ActionTarget) => {
    modalReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setActionTarget(target)
    setActionMemo('')
    setActionError(null)
  }

  const closeActionModal = useCallback(() => {
    setActionTarget(null)
    window.requestAnimationFrame(() => modalReturnFocusRef.current?.focus())
  }, [])

  React.useEffect(() => {
    if (!actionTarget) return

    modalTextareaRef.current?.focus()
  }, [actionTarget])

  React.useEffect(() => {
    if (!actionTarget) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !actionBusy) closeActionModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [actionBusy, actionTarget, closeActionModal])

  const submitAction = async () => {
    if (!actionTarget || actionBusy) return
    setActionBusy(true)
    setActionError(null)

    try {
      const response = await fetch('/api/platform/customer-request-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: actionTarget.sourceType,
          requestId: actionTarget.requestId,
          action: actionTarget.action,
          memo: actionMemo.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || '요청을 저장하지 못했습니다.')
      }

      closeActionModal()
      setActionMemo('')
      await fetchUser()
      router.refresh()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '요청을 저장하지 못했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const getCategoryLabel = (request: RecentMeasurementRequest) => {
    if (request.interest_categories && request.interest_categories.length > 0) {
      return request.interest_categories.map(key => CATEGORY_LABEL[key] ?? key).join(', ')
    }
    return CATEGORY_LABEL[request.interest_category] ?? request.interest_category
  }

  if (loading) {
    return (
      <div className={`${styles.container} ${styles.loading}`} data-mg-theme="portal">
        <div className={styles.spinner} aria-label="마이페이지를 불러오는 중" />
      </div>
    )
  }

  const hasRequests = recentMeasurements.length > 0 || recentAsRequests.length > 0

  return (
    <div className={styles.container} data-mg-theme="portal">
      <header className={styles.portalHeader}>
        <Link href="/blog" className={styles.brand} aria-label="문장군 블로그로 이동">
          <MunjanggunWordmark label="MY" compact />
        </Link>
        <div className={styles.accountWrap}>
          <button
            type="button"
            className={styles.accountButton}
            aria-label="계정 메뉴"
            aria-expanded={accountOpen}
            aria-controls="portal-account-menu"
            onClick={() => setAccountOpen(open => !open)}
          >
            <UserRound size={18} aria-hidden="true" />
            <span className={styles.accountButtonName}>{profile?.displayName || '고객'}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {accountOpen ? (
            <div id="portal-account-menu" className={styles.accountMenu}>
              <strong>{profile?.displayName || '고객'}</strong>
              {profile?.email ? <span>{profile.email}</span> : null}
              <button type="button" onClick={handleLogout}>로그아웃</button>
            </div>
          ) : null}
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>마이페이지</h1>
        </section>

        <section className={styles.profileSection} aria-labelledby="profile-title">
          <div className={styles.sectionHeading}>
            <div>
              <p>나의 정보</p>
              <h2 id="profile-title">연락받을 정보를 확인해요.</h2>
            </div>
            {!editingProfile ? (
              <button type="button" className={styles.editButton} onClick={startProfileEdit}>
                <Pencil size={15} aria-hidden="true" />
                수정
              </button>
            ) : null}
          </div>

          {editingProfile ? (
            <form className={styles.profileForm} onSubmit={saveProfile}>
              <label>
                <span>이름</span>
                <input
                  value={profileDraft.displayName}
                  onChange={event => setProfileDraft(draft => ({ ...draft, displayName: event.target.value }))}
                  autoComplete="name"
                  maxLength={50}
                />
              </label>
              <label>
                <span>이메일</span>
                <input value={profile?.email || ''} readOnly aria-readonly="true" />
              </label>
              <label>
                <span>전화번호</span>
                <input
                  value={profileDraft.phone}
                  onChange={event => setProfileDraft(draft => ({ ...draft, phone: formatPhone(event.target.value) }))}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="010-0000-0000"
                />
              </label>
              {profileError ? <p className={styles.profileError} role="alert">{profileError}</p> : null}
              <div className={styles.profileActions}>
                <button type="button" onClick={() => setEditingProfile(false)} disabled={profileBusy}>취소</button>
                <button type="submit" disabled={profileBusy}>{profileBusy ? '저장 중' : '저장'}</button>
              </div>
            </form>
          ) : (
            <dl className={styles.profileDetails}>
              <div><dt>이름</dt><dd>{profile?.displayName || '-'}</dd></div>
              <div><dt>이메일</dt><dd>{profile?.email || '-'}</dd></div>
              <div><dt>전화번호</dt><dd>{profile?.phone || '등록하지 않음'}</dd></div>
            </dl>
          )}
          {profileNotice ? <p className={styles.profileNotice} role="status">{profileNotice}</p> : null}
        </section>

        <CustomerCollectionPanel
          likedPosts={likedPosts}
          questions={blogQuestions}
          recentViewedPosts={recentViewedPosts}
          likesCount={activityCounts.likes}
          questionsCount={activityCounts.questions}
          recentViewedCount={activityCounts.recent}
          errorMessage={activityError}
        />

        <section className={styles.shortcutSection} aria-labelledby="service-shortcuts-title">
          <h2 id="service-shortcuts-title">고객 서비스</h2>
          <div className={styles.shortcutGrid}>
            <Link href="/measure" className={styles.shortcut}>
              <Ruler size={21} aria-hidden="true" strokeWidth={1.8} />
              <span>무료 실측상담</span>
            </Link>
            <Link href="/portal/as/new" className={styles.shortcut}>
              <Wrench size={21} aria-hidden="true" strokeWidth={1.8} />
              <span>A/S 접수</span>
            </Link>
          </div>
        </section>

        <section className={styles.requestSection} aria-labelledby="request-history-title">
          <div className={styles.sectionHeading}>
            <div>
              <p>요청 내역</p>
              <h2 id="request-history-title">진행 중인 요청</h2>
            </div>
          </div>
          {!hasRequests ? (
            <p className={styles.requestEmpty}>아직 진행 중인 상담이나 A/S 요청이 없어요.</p>
          ) : (
            <div className={styles.historyGrid}>
              {recentMeasurements.length > 0 ? (
                <RequestList
                  title="최근 견적상담"
                  requests={recentMeasurements}
                  getLabel={getCategoryLabel}
                  onAction={openAction}
                  sourceType="measurement"
                />
              ) : null}
              {recentAsRequests.length > 0 ? (
                <RequestList
                  title="최근 A/S 접수"
                  requests={recentAsRequests}
                  getLabel={request => ISSUE_LABEL[request.issue_type] ?? request.issue_type}
                  onAction={openAction}
                  sourceType="as"
                />
              ) : null}
            </div>
          )}
        </section>
      </main>

      {actionTarget ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="customer-action-title">
          <div className={styles.actionModal}>
            <header>
              <div>
                <h2 id="customer-action-title">{actionTarget.title}</h2>
                <p>{actionTarget.description}</p>
              </div>
              <button type="button" onClick={closeActionModal} aria-label="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <label className={styles.modalLabel} htmlFor="customer-action-memo">요청 내용</label>
            <textarea
              id="customer-action-memo"
              ref={modalTextareaRef}
              value={actionMemo}
              onChange={event => setActionMemo(event.target.value)}
              placeholder="담당자가 확인할 수 있도록 필요한 내용을 남겨주세요."
              rows={5}
            />
            {actionError ? <p className={styles.modalError}>{actionError}</p> : null}
            <footer>
              <button type="button" onClick={closeActionModal} disabled={actionBusy}>취소</button>
              <button type="button" onClick={() => void submitAction()} disabled={actionBusy}>
                {actionBusy ? '저장 중' : '요청 남기기'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type RequestItem = RecentMeasurementRequest | RecentAsRequest

function RequestList<T extends RequestItem>({
  title,
  requests,
  getLabel,
  onAction,
  sourceType,
}: {
  title: string
  requests: T[]
  getLabel: (request: T) => string
  onAction: (target: ActionTarget) => void
  sourceType: QueueSourceType
}) {
  return (
    <section className={styles.requestListSection} aria-label={title}>
      <h3>{title}</h3>
      <ul className={styles.requestList}>
        {requests.map(request => (
          <li key={request.id} className={styles.requestItem}>
            <div className={styles.requestMeta}>
              <span>{getLabel(request)}</span>
              <strong className={styles[`customer_${request.customer_status}`]}>
                {CUSTOMER_STATUS_LABEL[request.customer_status] ?? request.customer_status}
              </strong>
            </div>
            <p>{'address' in request && request.address ? request.address : '주소 미입력'}</p>
            {request.customer_action_note ? <small className={styles.actionNote}>요청 메모: {request.customer_action_note}</small> : null}
            <small>{formatDate(request.created_at)}</small>
            <div className={styles.requestActions}>
              {canRequestChange(request.customer_status) ? (
                <button type="button" onClick={() => onAction({
                  sourceType,
                  requestId: request.id,
                  action: 'change',
                  title: `${title} 수정 요청`,
                  description: '변경해야 할 내용을 적어주세요.',
                })}>수정요청</button>
              ) : null}
              {canRequestCancel(request.customer_status) ? (
                <button type="button" className={styles.dangerAction} onClick={() => onAction({
                  sourceType,
                  requestId: request.id,
                  action: 'cancel',
                  title: `${title} 취소 요청`,
                  description: '취소가 필요한 이유나 담당자에게 남길 말을 적어주세요.',
                })}>취소요청</button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
