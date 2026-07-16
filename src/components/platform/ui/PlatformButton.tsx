import React from 'react'
import styles from './PlatformButton.module.css'

type PlatformButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type PlatformButtonSize = 'md' | 'sm'

export interface PlatformButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PlatformButtonVariant
  size?: PlatformButtonSize
  fullWidth?: boolean
  isLoading?: boolean
  loadingLabel?: string
}

export function PlatformButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  loadingLabel = '처리 중…',
  className,
  disabled,
  children,
  ...props
}: PlatformButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button
      {...props}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      <span className={styles.content} aria-live="polite">
        {isLoading ? loadingLabel : children}
      </span>
    </button>
  )
}
