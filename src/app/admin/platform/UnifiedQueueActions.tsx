'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { QueueSourceType, QueueWorkStatus } from '@/types/database'
import { PlatformButton, PlatformStatusBadge } from '@/components/platform/ui'
import styles from './platform-admin.module.css'

interface Props {
  sourceType: QueueSourceType
  requestId: string
  queueStatus: QueueWorkStatus
  onCompleted?: (next: { customerStatus: string; queueStatus: QueueWorkStatus }) => void
}

const ACTION_BY_STATUS: Partial<Record<QueueWorkStatus, {
  action: 'complete_new' | 'complete_change' | 'complete_cancel'
  label: string
  memo: string
}>> = {
  new_received: {
    action: 'complete_new',
    label: '접수완료',
    memo: '통합 접수큐에서 신규 접수 처리 완료',
  },
  change_received: {
    action: 'complete_change',
    label: '수정완료',
    memo: '통합 접수큐에서 수정 요청 처리 완료',
  },
  cancel_received: {
    action: 'complete_cancel',
    label: '취소완료',
    memo: '통합 접수큐에서 취소 요청 처리 완료',
  },
}

export default function UnifiedQueueActions({ sourceType, requestId, queueStatus, onCompleted }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const action = ACTION_BY_STATUS[queueStatus]

  if (!action) {
    return <PlatformStatusBadge tone="success">처리완료</PlatformStatusBadge>
  }

  const handleClick = async () => {
    setErrorMessage(null)
    setBusy(true)
    try {
      const res = await fetch('/api/platform/admin-queue-action', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          requestId,
          action: action.action,
          memo: action.memo,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || '처리 상태를 저장하지 못했습니다.')
      }

      const data = await res.json() as { customerStatus: string; queueStatus: QueueWorkStatus }
      if (onCompleted) {
        onCompleted(data)
      } else {
        router.refresh()
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '처리 상태를 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.queueActionStack}>
      <PlatformButton type="button" onClick={handleClick} isLoading={busy} loadingLabel="처리 중…">
        <CheckCircle2 size={15} aria-hidden="true" />
        {action.label}
      </PlatformButton>
      {errorMessage ? <p className={styles.queueActionError} role="alert">{errorMessage}</p> : null}
    </div>
  )
}
