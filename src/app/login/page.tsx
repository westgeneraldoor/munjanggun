'use client'

import React, { use, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { logError } from '@/lib/logger'
import styles from './login.module.css'

type Step = 'main' | 'email_input' | 'otp_input'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function getEmailOtpSendErrorMessage(error: { message?: string; status?: number }) {
  const message = error.message?.toLowerCase() ?? ''

  if (error.status === 429 || message.includes('rate limit') || message.includes('only request this after')) {
    return '인증 요청이 잠시 제한되었습니다. 조금 뒤 다시 시도해 주세요.'
  }

  if (message.includes('invalid') || message.includes('not allowed')) {
    return '사용 가능한 이메일 주소를 입력해 주세요.'
  }

  return '인증 코드 발송에 실패했습니다. 이메일 주소를 확인해 주세요.'
}

export default function LoginPage({ searchParams }: PageProps) {
  const resolvedParams = use(searchParams)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('main')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [authError, setAuthError] = useState<string | null>(
    resolvedParams.error === 'auth_failed' ? '인증에 실패했습니다. 다시 시도해 주세요.' : null
  )
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const requestedNext = typeof resolvedParams.next === 'string' ? resolvedParams.next : '/portal'
  const nextParam = requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/portal'

  const handleKakaoLogin = async () => {
    setLoading(true)
    setAuthError(null)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: 'platform' } }
      )
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`,
        },
      })
      if (error) {
        logError('Kakao Sign-in OAuth error', error)
        setAuthError('카카오 로그인 시도 중 오류가 발생했습니다.')
        setLoading(false)
      }
    } catch (err) {
      logError('Kakao Sign-in unexpected error', err)
      setAuthError('시스템 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setAuthError(null)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: 'platform' } }
      )
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`,
        },
      })
      if (error) {
        setAuthError(getEmailOtpSendErrorMessage(error))
      } else {
        setSuccessMsg(`${email}로 6자리 인증 코드를 보냈습니다.`)
        setStep('otp_input')
      }
    } catch (err) {
      logError('Email OTP unexpected error', err)
      setAuthError('시스템 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) return
    setLoading(true)
    setAuthError(null)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: 'platform' } }
      )
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      })
      if (error) {
        setAuthError('인증 코드가 올바르지 않습니다. 다시 확인해 주세요.')
      } else {
        window.location.href = nextParam
      }
    } catch (err) {
      logError('OTP verify unexpected error', err)
      setAuthError('시스템 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtp(val)
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>MUNJANGGUN</div>
        <div className={styles.brandSub}>고객 플랫폼</div>

        {step === 'main' && (
          <>
            <h1 className={styles.title}>문장군 고객 계정</h1>
            <p className={styles.description}>
              상담 신청, 견적서 확인, 결제, A/S 이력을 안전하게 관리합니다.
            </p>

            <div className={styles.buttonContainer}>
              <button
                id="btn-kakao-login"
                onClick={handleKakaoLogin}
                disabled={loading}
                className={styles.kakaoButton}
                aria-label="카카오톡으로 간편 로그인"
              >
                <svg className={styles.kakaoIcon} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.502 1.64 4.705 4.14 5.86-.188.67-.68 2.42-.777 2.782-.122.454.156.448.33.33 1.353-.913 3.136-2.146 3.917-2.68.455.064.918.098 1.39.098 4.97 0 9-3.186 9-7.115C21 6.185 16.97 3 12 3z" />
                </svg>
                {loading ? '연결 중...' : '카카오로 계속하기'}
              </button>

              <div className={styles.divider}>
                <span>또는</span>
              </div>

              <button
                id="btn-email-login"
                onClick={() => { setStep('email_input'); setAuthError(null) }}
                disabled={loading}
                className={styles.emailButton}
                aria-label="이메일로 로그인"
              >
                <svg className={styles.emailIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <polyline points="2,4 12,13 22,4" />
                </svg>
                이메일로 로그인
              </button>
            </div>
          </>
        )}

        {step === 'email_input' && (
          <>
            <h1 className={styles.title}>이메일 로그인</h1>
            <p className={styles.description}>
              이메일 주소를 입력하면 6자리 인증 코드를 보내드립니다.
            </p>
            <form onSubmit={handleEmailSubmit} className={styles.form}>
              <label htmlFor="email-input" className={styles.fieldLabel}>이메일 주소</label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className={styles.input}
                autoFocus
                autoComplete="email"
                required
              />
              <button
                id="btn-send-otp"
                type="submit"
                disabled={loading || !email.trim()}
                className={styles.primaryButton}
              >
                {loading ? '발송 중...' : '인증 코드 받기'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('main'); setAuthError(null) }}
                className={styles.backButton}
              >
                돌아가기
              </button>
            </form>
          </>
        )}

        {step === 'otp_input' && (
          <>
            <h1 className={styles.title}>인증 코드 입력</h1>
            <p className={styles.description}>
              이메일로 받은 6자리 숫자를 입력해 주세요.
            </p>
            <form onSubmit={handleOtpSubmit} className={styles.form}>
              {successMsg && <div className={styles.successMsg}>{successMsg}</div>}
              <label htmlFor="otp-input" className={styles.fieldLabel}>인증 코드</label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={handleOtpInput}
                placeholder="123456"
                className={`${styles.input} ${styles.otpInput}`}
                maxLength={6}
                autoFocus
                required
              />
              <button
                id="btn-verify-otp"
                type="submit"
                disabled={loading || otp.length !== 6}
                className={styles.primaryButton}
              >
                {loading ? '확인 중...' : '로그인'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('email_input')
                  setOtp('')
                  setSuccessMsg(null)
                  setAuthError(null)
                }}
                className={styles.backButton}
              >
                코드 다시 받기
              </button>
            </form>
          </>
        )}

        {authError && <div className={styles.error} role="alert">{authError}</div>}

        <p className={styles.footer}>
          문장군은 고객님의 개인정보를 안전하게 보호하며, 동의 없이 외부로 유출하지 않습니다.
        </p>
      </div>
    </div>
  )
}
