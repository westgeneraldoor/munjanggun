'use client'

import { useCallback, useRef, useState } from 'react'

export type UploadStateChange = (uploaderId: string, isUploading: boolean) => void

export function useUploadPendingTracker() {
  const pendingIds = useRef(new Set<string>())
  const [pendingCount, setPendingCount] = useState(0)

  const onUploadStateChange = useCallback<UploadStateChange>((uploaderId, isUploading) => {
    if (isUploading) {
      pendingIds.current.add(uploaderId)
    } else {
      pendingIds.current.delete(uploaderId)
    }
    setPendingCount(pendingIds.current.size)
  }, [])

  return {
    hasPendingUploads: pendingCount > 0,
    onUploadStateChange,
  }
}
