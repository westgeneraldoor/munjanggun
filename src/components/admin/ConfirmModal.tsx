'use client'

import React from 'react'
import styles from './ConfirmModal.module.css'

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
  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        
        <div className={styles.actions}>
          <button 
            type="button" 
            className={styles.cancelBtn} 
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className={`${styles.confirmBtn} ${isDestructive ? styles.destructive : ''}`} 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? '처리 중...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
