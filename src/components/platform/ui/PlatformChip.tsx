import React from 'react'
import styles from './PlatformChip.module.css'

export type PlatformChipTone = 'neutral' | 'accent' | 'selected'

export interface PlatformChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PlatformChipTone
}

export function PlatformChip({ tone = 'neutral', className, children, ...props }: PlatformChipProps) {
  const classes = [styles.chip, styles[tone], className ?? ''].filter(Boolean).join(' ')

  return (
    <span {...props} className={classes} data-platform-chip>
      {children}
    </span>
  )
}
