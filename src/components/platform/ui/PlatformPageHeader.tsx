import React from 'react'
import styles from './PlatformPageHeader.module.css'

export interface PlatformPageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}

export function PlatformPageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PlatformPageHeaderProps) {
  const classes = [styles.header, className ?? ''].filter(Boolean).join(' ')

  return (
    <header {...props} className={classes}>
      <div className={styles.copy}>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  )
}
