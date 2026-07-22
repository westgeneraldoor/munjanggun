'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PlatformButton } from '@/components/platform/ui/PlatformButton'
import { PlatformField } from '@/components/platform/ui/PlatformField'
import { PlatformStatePanel } from '@/components/platform/ui/PlatformStatePanel'
import { logError } from '@/lib/logger'
import styles from './login.module.css'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다')
        return
      }

      router.push('/admin/platform')
      router.refresh()
    } catch (unexpectedError) {
      logError('Admin login unexpected error', unexpectedError)
      setError('관리자 로그인을 시작할 수 없습니다. 환경 설정을 확인해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>문장군 관리자</h1>
        <p className={styles.subtitle}>계정 정보를 입력해주세요.</p>
        
        <form onSubmit={handleLogin} className={styles.form}>
          <PlatformField
            id="email"
            label="이메일"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={loading}
            autoComplete="email"
            placeholder="admin@example.com"
          />

          <PlatformField
            id="password"
            label="비밀번호"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={loading}
            autoComplete="current-password"
            placeholder="비밀번호를 입력하세요"
          />

          {error ? <PlatformStatePanel className={styles.errorPanel} tone="error" title={error} /> : null}

          <PlatformButton
            type="submit"
            className={styles.submitButton}
            fullWidth
            isLoading={loading}
            loadingLabel="로그인 중…"
          >
            로그인
          </PlatformButton>
        </form>
      </div>
    </div>
  )
}
