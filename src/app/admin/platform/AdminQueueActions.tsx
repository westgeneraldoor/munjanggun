'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PlatformButton } from '@/components/platform/ui'
import styles from './platform-admin.module.css'

interface Props {
  requestId: string
  currentStatus: string
}

async function updateStatus(requestId: string, status: string, appsheetStatus: string) {
  const res = await fetch(`/api/platform/measure/${requestId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      appsheet_status: appsheetStatus,
      memo: status === 'cancelled'
        ? '어드민 접수 큐에서 취소 처리'
        : '어드민 접수 큐에서 접수 완료 처리',
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || '상태 변경에 실패했습니다.')
  }
}

export default function AdminQueueActions({ requestId, currentStatus }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleAccept = async () => {
    setErrorMessage(null)
    setBusy(true)
    try {
      await updateStatus(requestId, 'appsheet_registered', 'registered')
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '접수 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('이 신청 건을 취소 처리할까요?')) return
    setErrorMessage(null)
    setBusy(true)
    try {
      await updateStatus(requestId, 'cancelled', 'skipped')
      router.refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '취소 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const isAccepted = currentStatus === 'appsheet_registered'
  const isCancelled = currentStatus === 'cancelled'

  return (
    <div className={styles.queueActionStack}>
      <div className={styles.queueActions}>
        {!isAccepted && !isCancelled && (
          <PlatformButton type="button" onClick={handleAccept} isLoading={busy} loadingLabel="처리 중…">
            접수
          </PlatformButton>
        )}
        {!isCancelled && (
          <PlatformButton type="button" variant="danger" onClick={handleCancel} disabled={busy}>
            취소
          </PlatformButton>
        )}
      </div>
      {errorMessage ? <p className={styles.queueActionError} role="alert">{errorMessage}</p> : null}
    </div>
  )
}
