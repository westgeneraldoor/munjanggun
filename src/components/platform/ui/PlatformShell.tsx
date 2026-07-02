import React from 'react'
import styles from './PlatformShell.module.css'

type PlatformTheme = 'portal' | 'showroom-dark' | 'admin'

export interface PlatformShellProps {
  theme?: PlatformTheme
  topBar?: React.ReactNode
  hero?: React.ReactNode
  children: React.ReactNode
  className?: string
  mainClassName?: string
}

export function PlatformShell({
  theme = 'portal',
  topBar,
  hero,
  children,
  className,
  mainClassName,
}: PlatformShellProps) {
  const shellClassName = [styles.shell, className ?? ''].filter(Boolean).join(' ')
  const mainClasses = [styles.main, mainClassName ?? ''].filter(Boolean).join(' ')

  return (
    <div className={shellClassName} data-mg-theme={theme}>
      {topBar ? <div className={styles.topBar}>{topBar}</div> : null}
      {hero ? <div className={styles.hero}>{hero}</div> : null}
      <main className={mainClasses}>{children}</main>
    </div>
  )
}
