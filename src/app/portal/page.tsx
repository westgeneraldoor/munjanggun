'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-client'
import { logError } from '@/lib/logger'
import styles from './portal.module.css'

interface UserProfile {
  email?: string
  displayName?: string
  role?: string
}

export default function PortalPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createPlatformClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          router.push('/login')
          return
        }

        // platform.profiles에서 프로필 정보 추가 로드
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
          role: dbProfile?.role || 'customer'
        })
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
      const supabase = createPlatformClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        logError('Signout error', error)
      }
      router.push('/login')
      router.refresh()
    } catch (err) {
      logError('Signout unexpected error', err)
    }
  }

  if (loading) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <a href="#" className={styles.logo}>MUNJANGGUN</a>
        <div className={styles.userMenu}>
          <span className={styles.userInfo}>
            <strong>{profile?.displayName}</strong> 님 ({profile?.email})
          </span>
          <button onClick={handleLogout} className={styles.logoutButton}>
            로그아웃
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.welcomeCard}>
          <h1 className={styles.title}>문장군 고객 포털에 오신 것을 환영합니다</h1>
          <p className={styles.welcomeText}>
            이곳은 문장군 무료방문견적 신청 및 상담, 결제 현황을 한눈에 관리하는 고객님의 개인 포털 공간입니다.
          </p>

          <div className={styles.ctaGrid}>
            <div className={styles.ctaCard}>
              <h2 className={styles.ctaTitle}>무료방문견적 신청</h2>
              <p className={styles.ctaDesc}>
                전문 매니저가 직접 레이저 레벨기와 샘플 컬러북을 지참하여 댁으로 찾아갑니다. (MVP-02 구현 예정)
              </p>
            </div>

            <div className={styles.ctaCard}>
              <h2 className={styles.ctaTitle}>내 견적 & 결제 내역</h2>
              <p className={styles.ctaDesc}>
                발급된 견적서를 확인하고 토스페이먼츠를 통해 신속하고 안전하게 결제를 진행할 수 있습니다. (MVP-04, 05 구현 예정)
              </p>
            </div>
          </div>
        </div>

        <div className={styles.statusPlaceholder}>
          <span className={styles.statusIcon}>📋</span>
          <p>현재 진행 중인 견적 신청 내역이 없습니다.</p>
        </div>
      </main>
    </div>
  )
}
