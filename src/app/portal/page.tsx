'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Ruler,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { CustomerRequestStatus, QueueSourceType } from '@/types/database'
import { logError } from '@/lib/logger'
import styles from './portal.module.css'

interface UserProfile {
  email?: string
  displayName?: string
  role?: string
}

interface RecentMeasurementRequest {
  id: string
  customer_status: CustomerRequestStatus
  queue_status: string
  customer_action_note: string | null
  address: string
  created_at: string
  interest_category: string
  interest_categories: string[] | null
}

interface RecentAsRequest {
  id: string
  customer_status: CustomerRequestStatus
  queue_status: string
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
  const [loading, setLoading] = useState(true)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  const [actionMemo, setActionMemo] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'platform' } }
  ), [])

  const fetchUser = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login?next=/portal')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, email, role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        logError('Fetch user profile error', profileError)
      }

      const dbProfile = data as {
        display_name: string | null
        email: string | null
        role: 'customer' | 'sales_manager' | 'administrator'
      } | null

      setProfile({
        email: dbProfile?.email || user.email,
        displayName: dbProfile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || '고객',
        role: dbProfile?.role || 'customer',
      })

      const [measureResult, asResult] = await Promise.all([
        supabase
          .from('measurement_requests')
          .select('id, customer_status, queue_status, customer_action_note, address, created_at, interest_category, interest_categories')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('as_requests')
          .select('id, customer_status, queue_status, customer_action_note, issue_type, address, created_at')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(6),
      ])

      if (measureResult.error) {
        logError('Fetch measurement requests error', measureResult.error)
      } else {
        setRecentMeasurements((measureResult.data ?? []) as RecentMeasurementRequest[])
      }

      if (asResult.error) {
        logError('Fetch AS requests error', asResult.error)
      } else {
        setRecentAsRequests((asResult.data ?? []) as RecentAsRequest[])
      }
    } catch (err) {
      logError('Fetch user unexpected error', err)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUser()
  }, [fetchUser])

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) logError('Signout error', error)
      router.push('/')
      router.refresh()
    } catch (err) {
      logError('Signout unexpected error', err)
    }
  }

  const openAction = (target: ActionTarget) => {
    setActionTarget(target)
    setActionMemo('')
    setActionError(null)
  }

  const submitAction = async () => {
    if (!actionTarget || actionBusy) return
    setActionBusy(true)
    setActionError(null)

    try {
      const res = await fetch('/api/platform/customer-request-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: actionTarget.sourceType,
          requestId: actionTarget.requestId,
          action: actionTarget.action,
          memo: actionMemo.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || '요청을 저장하지 못했습니다.')
      }

      setActionTarget(null)
      setActionMemo('')
      await fetchUser()
      router.refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '요청을 저장하지 못했습니다.')
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
      <div className={`${styles.container} ${styles.loading}`}>
        <div className={styles.spinner} aria-label="마이페이지를 불러오는 중" />
      </div>
    )
  }

  const serviceCards = [
    {
      id: 'card-measure',
      Icon: Ruler,
      title: '무료방문 실측견적 상담',
      desc: '견적상담을 받고 진행하지 않아도 비용이 들지 않아요. 우리 집 시공 가능 여부와 방향을 먼저 확인해요.',
      href: '/portal/measure/new',
      active: true,
      cta: '신청하기',
    },
    {
      id: 'card-as',
      Icon: Wrench,
      title: 'A/S 접수',
      desc: '문 여닫힘, 부속, 표면 손상처럼 확인이 필요한 내용을 사진이나 동영상과 함께 남겨주세요.',
      href: '/portal/as/new',
      active: true,
      cta: '접수하기',
    },
    {
      id: 'card-estimate',
      Icon: FileText,
      title: '견적서 확인',
      desc: '담당자가 안내한 견적서를 마이페이지에서 확인할 수 있도록 준비 중입니다.',
      href: null,
      active: false,
      cta: '준비중',
    },
    {
      id: 'card-history',
      Icon: ShieldCheck,
      title: '시공/A/S 이력',
      desc: '상담, 시공, 사후관리 기록을 한곳에서 볼 수 있도록 이어서 만들겠습니다.',
      href: null,
      active: false,
      cta: '준비중',
    },
  ]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="문장군 홈으로 이동">MUNJANGGUN</Link>
        <div className={styles.userMenu}>
          <Link href="/" className={styles.homeButton}>
            <Home size={15} aria-hidden="true" />
            <span>홈</span>
          </Link>
          <span className={styles.userInfo}>
            <strong>{profile?.displayName}</strong>님
          </span>
          <button onClick={handleLogout} className={styles.logoutButton} id="btn-logout" aria-label="로그아웃">
            <LogOut size={15} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>문장군 마이페이지</p>
          <h1>남겨주신 상담과 요청을 한곳에서 확인해요.</h1>
          <p>
            무료방문 실측견적 상담, A/S 접수, 이후 견적서와 진행 이력까지 고객님의 흐름이 끊기지 않도록 정리해둘게요.
          </p>
        </section>

        <section className={styles.menuGrid} aria-label="고객 서비스">
          {serviceCards.map(card => {
            const Icon = card.Icon
            return (
              <article key={card.id} className={`${styles.menuCard} ${!card.active ? styles.inactive : ''}`}>
                <div className={styles.cardTopline}>
                  <span className={styles.cardIconWrap}>
                    <Icon className={styles.cardIcon} aria-hidden="true" strokeWidth={1.8} />
                  </span>
                  <span className={styles.cardBadge}>{card.cta}</span>
                </div>
                <h2>{card.title}</h2>
                <p>{card.desc}</p>
                {card.active && card.href ? (
                  <Link href={card.href} id={card.id} className={styles.cardCta}>
                    <span>{card.cta}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : null}
              </article>
            )
          })}
        </section>

        <div className={styles.historyGrid}>
          <section className={styles.requestSection}>
            <div className={styles.sectionHeader}>
              <h2>최근 견적상담</h2>
              <Link href="/portal/measure/new">새 상담 신청</Link>
            </div>
            {recentMeasurements.length === 0 ? (
              <div className={styles.emptyState}>
                <ClipboardList className={styles.emptyIcon} aria-hidden="true" strokeWidth={1.7} />
                <p>아직 남겨주신 견적상담이 없습니다.</p>
              </div>
            ) : (
              <ul className={styles.requestList}>
                {recentMeasurements.map(req => (
                  <li key={req.id} className={styles.requestItem}>
                    <div className={styles.requestMeta}>
                      <span>{getCategoryLabel(req)}</span>
                      <strong className={styles[`customer_${req.customer_status}`]}>
                        {CUSTOMER_STATUS_LABEL[req.customer_status] ?? req.customer_status}
                      </strong>
                    </div>
                    <p>{req.address}</p>
                    {req.customer_action_note && <small className={styles.actionNote}>요청 메모: {req.customer_action_note}</small>}
                    <small>{formatDate(req.created_at)}</small>
                    <div className={styles.requestActions}>
                      {canRequestChange(req.customer_status) && (
                        <button type="button" onClick={() => openAction({
                          sourceType: 'measurement',
                          requestId: req.id,
                          action: 'change',
                          title: '견적상담 수정 요청',
                          description: '변경해야 할 날짜, 연락처, 주소, 요청 내용을 적어주세요.',
                        })}>
                          수정요청
                        </button>
                      )}
                      {canRequestCancel(req.customer_status) && (
                        <button type="button" className={styles.dangerAction} onClick={() => openAction({
                          sourceType: 'measurement',
                          requestId: req.id,
                          action: 'cancel',
                          title: '견적상담 취소 요청',
                          description: '취소가 필요한 이유나 담당자에게 남길 말을 적어주세요.',
                        })}>
                          취소요청
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.requestSection}>
            <div className={styles.sectionHeader}>
              <h2>최근 A/S 접수</h2>
              <Link href="/portal/as/new">A/S 접수</Link>
            </div>
            {recentAsRequests.length === 0 ? (
              <div className={styles.emptyState}>
                <Wrench className={styles.emptyIcon} aria-hidden="true" strokeWidth={1.7} />
                <p>아직 남겨주신 A/S 접수가 없습니다.</p>
              </div>
            ) : (
              <ul className={styles.requestList}>
                {recentAsRequests.map(req => (
                  <li key={req.id} className={styles.requestItem}>
                    <div className={styles.requestMeta}>
                      <span>{ISSUE_LABEL[req.issue_type] ?? req.issue_type}</span>
                      <strong className={styles[`customer_${req.customer_status}`]}>
                        {CUSTOMER_STATUS_LABEL[req.customer_status] ?? req.customer_status}
                      </strong>
                    </div>
                    <p>{req.address || '주소 미입력'}</p>
                    {req.customer_action_note && <small className={styles.actionNote}>요청 메모: {req.customer_action_note}</small>}
                    <small>{formatDate(req.created_at)}</small>
                    <div className={styles.requestActions}>
                      {canRequestChange(req.customer_status) && (
                        <button type="button" onClick={() => openAction({
                          sourceType: 'as',
                          requestId: req.id,
                          action: 'change',
                          title: 'A/S 수정 요청',
                          description: '변경해야 할 연락처, 주소, 증상 내용을 적어주세요.',
                        })}>
                          수정요청
                        </button>
                      )}
                      {canRequestCancel(req.customer_status) && (
                        <button type="button" className={styles.dangerAction} onClick={() => openAction({
                          sourceType: 'as',
                          requestId: req.id,
                          action: 'cancel',
                          title: 'A/S 취소 요청',
                          description: '취소가 필요한 이유나 담당자에게 남길 말을 적어주세요.',
                        })}>
                          취소요청
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      {actionTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="customer-action-title">
          <div className={styles.actionModal}>
            <header>
              <div>
                <h2 id="customer-action-title">{actionTarget.title}</h2>
                <p>{actionTarget.description}</p>
              </div>
              <button type="button" onClick={() => setActionTarget(null)} aria-label="닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <textarea
              value={actionMemo}
              onChange={event => setActionMemo(event.target.value)}
              placeholder="담당자가 확인할 수 있도록 필요한 내용을 남겨주세요."
              rows={5}
            />
            {actionError && <p className={styles.modalError}>{actionError}</p>}
            <footer>
              <button type="button" onClick={() => setActionTarget(null)} disabled={actionBusy}>닫기</button>
              <button type="button" onClick={submitAction} disabled={actionBusy}>
                {actionBusy ? '저장 중' : '요청 남기기'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
