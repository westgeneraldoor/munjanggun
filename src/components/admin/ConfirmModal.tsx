'use client'

import React from 'react'
import { PlatformButton, PlatformModal } from '@/components/platform/ui'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isDestructive?: boolean
  isLoading?: boolean
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  isDestructive = false,
  isLoading = false
}: ConfirmModalProps) {
  return (
    <PlatformModal
      isOpen={isOpen}
      title={title}
      description={message}
      onClose={onCancel}
      closeDisabled={isLoading}
      footer={(
        <>
          <PlatformButton
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            data-modal-initial-focus={isLoading ? undefined : true}
          >
            {cancelText}
          </PlatformButton>
          <PlatformButton
            type="button"
            variant={isDestructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            loadingLabel="처리 중"
          >
            {confirmText}
          </PlatformButton>
        </>
      )}
    />
  )
}
