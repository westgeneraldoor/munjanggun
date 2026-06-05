'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import styles from './portal.module.css'

interface UserProfile {
  email?: string
  displayName?: string
  role?: string
}

interface RecentMeasurementRequest {
  id: string
  status: string
  address: string
  created_at: string
  interest_category: string
  interest_categories: string[] | null
}

interface RecentAsRequest {
  id: string
  status: string
  issue_type: string
  address: string | null
  created_at: string
}

const MEASURE_STATUS_LABEL: Record<string, string> = {
  submitted: '접수 완료',
  appsheet_pending: '확인 중',
  appsheet_registered: '접수 등록',
  contacted: '상담 진행',
  assigned: '담당자 배정',
  scheduled: '방문 예정',
  measured: '실측 완료',
  cancelled: '취소',
}

const AS_STATUS_LABEL: Record<string, string> = {
  submitted: '접수 완료',
  reviewing: '확인 중',
  scheduled: '방문 예정',
  resolved: '처리 완료',
  cancelled: '취소',
}

const CATEGORY_LABEL: Record<string, string> = {
  middle_door: '중문',
  abs_door: 'ABS 도어',
  front_door: '현관문',
  molding_baseboard: '몰딩/걸레받이',
  other: '기타',
}

const ISSUE_LABEL: Record<string, string> = {
  door_adjustment: '문 여닫힘/수평',
  film_damage: '필름/표면 손상',
  hardware: '손잡이/부속',
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

export default function PortalPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [recentMeasurements, setRecentMeasurements] = useState<RecentMeasurementRequest[]>([])
  const [recentAsRequests, setRecentAsRequests] = useState<RecentAsRequest[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'platform' } }
  ), [])

  useEffect(() => {
    const fetchUser = async () => {
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
            .select('id, status, address, created_at, interest_category, interest_categories')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(4),
          supabase
            .from('as_requests')
            .select('id, status, issue_type, address, created_at')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(4),
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
    }
    fetchUser()
  }, [router, supabase])

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
      desc: '비용 부담 없이 우리 집 시공 가능 여부와 대략적인 방향을 먼저 확인해요.',
      href: '/portal/measure/new',
      active: true,
      cta: '신청하기',
    },
    {
      id: 'card-as',
      Icon: Wrench,
      title: 'A/S 접수',
      desc: '문 여닫힘, 부속, 필름 손상처럼 확인이 필요한 내용을 사진과 함께 남겨요.',
      href: '/portal/as/new',
      active: true,
      cta: '접수하기',
    },
    {
      id: 'card-estimate',
      Icon: FileText,
      title: '견적서 확인',
      desc: '담당자가 안내한 견적서를 이곳에서 확인할 수 있도록 준비 중입니다.',
      href: null,
      active: false,
      cta: '준비중',
    },
    {
      id: 'card-history',
      Icon: ShieldCheck,
      title: '시공/A/S 이력',
      desc: '진행했던 상담, 시공, 사후관리 기록을 한곳에 모을 예정입니다.',
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
                      <strong>{MEASURE_STATUS_LABEL[req.status] ?? req.status}</strong>
                    </div>
                    <p>{req.address}</p>
                    <small>{formatDate(req.created_at)}</small>
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
                      <strong>{AS_STATUS_LABEL[req.status] ?? req.status}</strong>
                    </div>
                    <p>{req.address || '주소 미입력'}</p>
                    <small>{formatDate(req.created_at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
