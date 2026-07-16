import React from 'react'
import styles from './PlatformStatusBadge.module.css'

export type PlatformStatusBadgeTone = 'neutral' | 'review' | 'warning' | 'success' | 'info' | 'danger'

export interface PlatformStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PlatformStatusBadgeTone
}

export function PlatformStatusBadge({
  tone = 'neutral',
  className,
  children,
  ...props
}: PlatformStatusBadgeProps) {
  const classes = [styles.badge, styles[tone], className ?? ''].filter(Boolean).join(' ')

  return (
    <span {...props} className={classes}>
      {children}
    </span>
  )
}
