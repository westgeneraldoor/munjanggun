'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, Home, ReceiptText, Ruler, Wrench } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import styles from './portal.module.css'

interface UserProfile {
  email?: string
  displayName?: string
  role?: string
}

interface RecentRequest {
  id: string
  status: string
  address: string
  created_at: string
  interest_category: string
  interest_categories: string[] | null
}

const STATUS_LABEL: Record<string, string> = {
  submitted: '신청 접수',
  appsheet_pending: '확인 중',
  appsheet_registered: '접수 완료',
  contacted: '상담 진행',
  assigned: '담당자 배정',
  scheduled: '방문 예정',
  measured: '실측 완료',
  cancelled: '취소',
}

const CATEGORY_LABEL: Record<string, string> = {
  middle_door: '중문',
  abs_door: 'ABS 도어',
  front_door: '현관문',
  molding_baseboard: '몰딩/걸레받이',
  other: '기타',
}

export default function PortalPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { db: { schema: 'platform' } }
        )
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

        const { data: requests, error: reqError } = await supabase
          .from('measurement_requests')
          .select('id, status, address, created_at, interest_category, interest_categories')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (reqError) {
          logError('Fetch measurement requests error', reqError)
        } else {
          setRecentRequests((requests ?? []) as RecentRequest[])
        }
      } catch (err) {
        logError('Fetch user unexpected error', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [router])

  const handleLogout = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: 'platform' } }
      )
      const { error } = await supabase.auth.signOut()
      if (error) logError('Signout error', error)
      router.push('/')
      router.refresh()
    } catch (err) {
      logError('Signout unexpected error', err)
    }
  }

  if (loading) {
    return (
      <div className={`${styles.container} ${styles.loading}`}>
        <div className={styles.spinner} aria-label="불러오는 중" />
      </div>
    )
  }

  const menuCards = [
    {
      id: 'card-measure',
      Icon: Ruler,
      title: '무료방문견적 신청',
      desc: '주소와 희망 방문일을 남기면 문장군이 가능 여부를 확인해 연락드립니다.',
      href: '/portal/measure/new',
      active: true,
      cta: '신청하기',
    },
    {
      id: 'card-estimate',
      Icon: ReceiptText,
      title: '견적서 확인',
      desc: '담당자가 안내한 견적 내용을 이곳에서 확인할 수 있게 준비 중입니다.',
      href: null,
      active: false,
      cta: '준비중',
    },
    {
      id: 'card-history',
      Icon: Home,
      title: '시공 이력',
      desc: '시공일, 담당자, A/S 기록을 차례로 연결할 예정입니다.',
      href: null,
      active: false,
      cta: '준비중',
    },
    {
      id: 'card-as',
      Icon: Wrench,
      title: 'A/S 접수',
      desc: '시공 후 확인이 필요한 내용을 남기고 진행 상태를 확인합니다.',
      href: null,
      active: false,
      cta: '준비중',
    },
  ]

  const getCategoryLabel = (request: RecentRequest) => {
    if (request.interest_categories && request.interest_categories.length > 0) {
      return request.interest_categories.map(key => CATEGORY_LABEL[key] ?? key).join(', ')
    }
    return CATEGORY_LABEL[request.interest_category] ?? request.interest_category
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="문장군 홈으로 이동">MUNJANGGUN</Link>
        <div className={styles.userMenu}>
          <Link href="/" className={styles.homeButton}>
            <Home size={15} aria-hidden="true" />
            <span>쇼룸 홈</span>
          </Link>
          <span className={styles.userInfo}>
            <strong>{profile?.displayName}</strong>님
          </span>
          <button onClick={handleLogout} className={styles.logoutButton} id="btn-logout">
            로그아웃
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.greeting}>
          <h1 className={styles.greetingTitle}>마이페이지</h1>
          <p className={styles.greetingDesc}>
            문장군에 남긴 상담 신청과 앞으로 받을 견적, 시공 이력을 한곳에서 확인합니다.
          </p>
        </div>

        <div className={styles.menuGrid}>
          {menuCards.map(card => {
            const Icon = card.Icon
            return (
              <div key={card.id} className={`${styles.menuCard} ${!card.active ? styles.inactive : ''}`}>
                <div className={styles.cardIconWrap}>
                  <Icon className={styles.cardIcon} aria-hidden="true" strokeWidth={1.8} />
                </div>
                <h2 className={styles.cardTitle}>{card.title}</h2>
                <p className={styles.cardDesc}>{card.desc}</p>
                {card.active && card.href ? (
                  <Link href={card.href} id={card.id} className={styles.cardCta}>
                    {card.cta}
                  </Link>
                ) : (
                  <span className={styles.cardBadge}>{card.cta}</span>
                )}
              </div>
            )
          })}
        </div>

        <section className={styles.requestSection}>
          <h2 className={styles.sectionTitle}>최근 상담 신청</h2>
          {recentRequests.length === 0 ? (
            <div className={styles.emptyState}>
              <ClipboardList className={styles.emptyIcon} aria-hidden="true" strokeWidth={1.7} />
              <p>아직 남긴 신청이 없습니다.</p>
              <Link href="/portal/measure/new" className={styles.emptyLink}>
                무료방문견적 신청하기
              </Link>
            </div>
          ) : (
            <ul className={styles.requestList}>
              {recentRequests.map(req => (
                <li key={req.id} className={styles.requestItem}>
                  <div className={styles.requestMeta}>
                    <span className={styles.requestCategory}>{getCategoryLabel(req)}</span>
                    <span className={`${styles.requestStatus} ${styles[`status_${req.status}`]}`}>
                      {STATUS_LABEL[req.status] ?? req.status}
                    </span>
                  </div>
                  <div className={styles.requestAddress}>{req.address}</div>
                  <div className={styles.requestDate}>
                    {new Date(req.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
