'use client'

import React, { use, useState } from 'react'
import { createPlatformClient } from '@/lib/supabase/platform-client'
import { logError } from '@/lib/logger'
import styles from './login.module.css'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default function LoginPage({ searchParams }: PageProps) {
  // searchParams가 Promise 타입인 Next.js 15+ 대응을 위해 React.use() 사용
  const resolvedParams = use(searchParams)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(
    resolvedParams.error === 'auth_failed' ? '카카오 인증에 실패했습니다. 다시 시도해주세요.' : null
  )

  const handleKakaoLogin = async () => {
    setLoading(true)
    setAuthError(null)

    try {
      const supabase = createPlatformClient()
      const nextParam = typeof resolvedParams.next === 'string' ? resolvedParams.next : '/portal'
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`,
        },
      })

      if (error) {
        logError('Kakao Sign-in OAuth error', error)
        setAuthError('카카오 로그인 시도 중 에러가 발생했습니다.')
        setLoading(false)
      }
    } catch (err) {
      logError('Kakao Sign-in unexpected error', err)
      setAuthError('예기치 않은 시스템 에러가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>MUNJANGGUN</div>
        <div className={styles.brandSub}>DIGITAL SHOWROOM</div>

        <h1 className={styles.title}>무료방문견적 신청 계속하기</h1>
        <p className={styles.description}>
          안전하고 빠른 카카오 간편로그인으로<br />
          견적 신청부터 계약, 결제까지 한 번에 진행하세요.
        </p>

        <div className={styles.buttonContainer}>
          <button
            onClick={handleKakaoLogin}
            disabled={loading}
            className={styles.kakaoButton}
            aria-label="카카오톡으로 간편 로그인"
          >
            <svg
              className={styles.kakaoIcon}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.502 1.64 4.705 4.14 5.86-.188.67-.68 2.42-.777 2.782-.122.454.156.448.33.33 1.353-.913 3.136-2.146 3.917-2.68.455.064.918.098 1.39.098 4.97 0 9-3.186 9-7.115C21 6.185 16.97 3 12 3z" />
            </svg>
            {loading ? '연결 중...' : '카카오로 계속하기'}
          </button>
        </div>

        {authError && <div className={styles.error}>{authError}</div>}

        <p className={styles.footer}>
          문장군은 고객님의 개인정보를 안전하게 보호하며,<br />
          동의 없이 외부로 유출하지 않습니다.
        </p>
      </div>
    </div>
  )
}
