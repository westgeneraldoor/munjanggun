import React from 'react'
import styles from './PlatformBadge.module.css'

type PlatformBadgeTone = 'neutral' | 'action' | 'success' | 'danger' | 'proof'

export interface PlatformBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PlatformBadgeTone
}

export function PlatformBadge({
  tone = 'neutral',
  className,
  children,
  ...props
}: PlatformBadgeProps) {
  const classes = [styles.badge, styles[tone], className ?? ''].filter(Boolean).join(' ')

  return (
    <span {...props} className={classes}>
      {children}
    </span>
  )
}
