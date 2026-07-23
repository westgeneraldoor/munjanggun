'use client'

import React, { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, MessageCircle } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import MunjanggunWordmark from '@/app/blog/BlogBrandWordmark'
import { logError } from '@/lib/logger'
import { getSafeInternalPath } from '@/lib/safe-internal-path'
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
    resolvedParams.error === 'auth_failed' ? '로그인이 완료되지 않았습니다. 다시 시도해 주세요.' : null
  )
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const requestedNext = typeof resolvedParams.next === 'string' ? resolvedParams.next : '/portal'
  const nextParam = getSafeInternalPath(requestedNext)
  const parsedNext = new URL(nextParam, 'https://munjanggun.local')
  const isMeasurePath = parsedNext.pathname === '/portal/measure/new'
  const isBlogQuestionReturn = isMeasurePath && parsedNext.searchParams.get('source') === 'blog-question'
  const requestedPost = parsedNext.searchParams.get('post')
  const safePost = requestedPost && /^[a-z0-9][a-z0-9-]{0,119}$/i.test(requestedPost) ? requestedPost : null
  const isMeasureReturn = isMeasurePath && !isBlogQuestionReturn
  const isBlogReturn = isBlogQuestionReturn || parsedNext.pathname === '/blog' || parsedNext.pathname.startsWith('/blog/')
  const returnContext = isMeasureReturn
    ? { href: '/measure', label: '실측견적 안내로 돌아가기' }
    : isBlogReturn
      ? { href: isBlogQuestionReturn && safePost ? `/blog/${encodeURIComponent(safePost)}` : '/blog', label: isBlogQuestionReturn ? '블로그 글로 돌아가기' : '문장군 블로그로 돌아가기' }
      : { href: '/', label: '문장군 홈으로 돌아가기' }

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
        setAuthError('카카오 로그인을 여는 중 문제가 생겼습니다. 이메일로 시작하거나 잠시 뒤 다시 시도해 주세요.')
        setLoading(false)
      }
    } catch (err) {
      logError('Kakao Sign-in unexpected error', err)
      setAuthError('로그인을 시작하지 못했습니다. 네트워크 상태를 확인해 주세요.')
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
      setAuthError('인증 코드 발송 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.')
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
      setAuthError('로그인 확인 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtp(val)
  }

  return (
    <div className={styles.container} data-mg-theme="portal">
      <div className={styles.card}>
        <Link href={returnContext.href} prefetch={false} className={styles.contextLink}>
          <ArrowLeft size={18} aria-hidden="true" />
          {returnContext.label}
        </Link>
        <MunjanggunWordmark label="MY" className={styles.wordmark} />

        {step === 'main' && (
          <>
            <h1 className={styles.title}>{isMeasureReturn ? '무료방문 실측견적 신청을 이어갈게요' : '문장군에 오신 것을 환영합니다'}</h1>
            <p className={styles.description}>
              로그인하시면 무료방문 실측견적 신청, 견적 확인, A/S 접수 등 모든 서비스를 이용할 수 있습니다.
            </p>

            <div className={styles.reassurance}>
              별도 회원가입 없이 카카오 또는 이메일로 간편하게 시작할 수 있습니다.
            </div>

            <div className={styles.buttonContainer}>
              <button
                id="btn-kakao-login"
                onClick={handleKakaoLogin}
                disabled={loading}
                className={styles.kakaoButton}
                aria-label="카카오로 로그인"
              >
                <MessageCircle className={styles.kakaoIcon} size={20} aria-hidden="true" />
                {loading ? '카카오 연결 중...' : '카카오로 간편하게 시작'}
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
                <Mail className={styles.emailIcon} size={18} aria-hidden="true" />
                이메일로 시작
              </button>
            </div>
          </>
        )}

        {step === 'email_input' && (
          <>
            <h1 className={styles.title}>이메일로 신청을 이어갈게요</h1>
            <p className={styles.description}>
              이메일 주소로 6자리 인증 코드를 보내드립니다.
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
                다른 방법으로 시작
              </button>
            </form>
          </>
        )}

        {step === 'otp_input' && (
          <>
            <h1 className={styles.title}>인증 코드를 입력해 주세요</h1>
            <p className={styles.description}>
              이메일로 받은 6자리 숫자를 입력하면 바로 이어집니다.
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
                {loading ? '확인 중...' : '신청 이어가기'}
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
                코드를 다시 받을게요
              </button>
            </form>
          </>
        )}

        {authError && <div className={styles.error} role="alert">{authError}</div>}

        <p className={styles.footer}>
          입력한 정보는 서비스 이용과 안내를 위해서만 사용됩니다.
        </p>
      </div>
    </div>
  )
}
