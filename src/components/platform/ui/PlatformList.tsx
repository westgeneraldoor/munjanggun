import React from 'react'
import styles from './PlatformList.module.css'

export type PlatformListProps = React.HTMLAttributes<HTMLUListElement>

export function PlatformList({ className, children, ...props }: PlatformListProps) {
  const classes = [styles.list, className ?? ''].filter(Boolean).join(' ')

  return (
    <ul {...props} className={classes} data-platform-list>
      {children}
    </ul>
  )
}
