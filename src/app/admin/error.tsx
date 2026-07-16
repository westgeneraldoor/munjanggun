'use client'

import { useEffect } from 'react'
import { CircleAlert } from 'lucide-react'
import { PlatformButton, PlatformStatePanel } from '@/components/platform/ui'
import styles from './error.module.css'

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('Admin route error:', {
      name: error.name,
      digest: error.digest,
    })
  }, [error])

  return (
    <section className={styles.container} aria-label="관리자 화면 오류">
      <PlatformStatePanel
        tone="error"
        title="관리자 화면을 불러오지 못했습니다."
        description="일시적인 문제일 수 있습니다. 다시 시도해 주세요."
        icon={<CircleAlert size={24} />}
        action={(
          <PlatformButton type="button" variant="secondary" onClick={unstable_retry}>
            다시 시도
          </PlatformButton>
        )}
      />
    </section>
  )
}
