import React from 'react'
import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  status: 'draft' | 'published'
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
}

export default function StatusBadge({ status, onClick, disabled }: StatusBadgeProps) {
  const isPublished = status === 'published'
  
  if (onClick) {
    return (
      <button 
        type="button"
        className={`${styles.badge} ${styles.badgeButton} ${isPublished ? styles.published : styles.draft}`}
        onClick={(e) => {
          e.stopPropagation()
          onClick(e)
        }}
        disabled={disabled}
        title={isPublished ? '초안으로 변경' : '공개로 변경'}
      >
        {isPublished ? '공개' : '초안'}
      </button>
    )
  }
  
  return (
    <span className={`${styles.badge} ${isPublished ? styles.published : styles.draft}`}>
      {isPublished ? '공개' : '초안'}
    </span>
  )
}
