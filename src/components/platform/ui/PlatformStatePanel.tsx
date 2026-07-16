import React from 'react'
import styles from './PlatformStatePanel.module.css'

export type PlatformStatePanelTone = 'empty' | 'error' | 'success' | 'loading'

export interface PlatformStatePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: PlatformStatePanelTone
  title: string
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function PlatformStatePanel({
  tone = 'empty',
  title,
  description,
  icon,
  action,
  className,
  ...props
}: PlatformStatePanelProps) {
  const classes = [styles.panel, styles[tone], className ?? ''].filter(Boolean).join(' ')
  const role = tone === 'error' ? 'alert' : 'status'

  return (
    <div {...props} className={classes} role={role} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      {icon ? <div className={styles.icon} aria-hidden="true">{icon}</div> : null}
      <div className={styles.copy}>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
