import React from 'react'
import styles from './PlatformTable.module.css'

export interface PlatformTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  containerClassName?: string
  layout?: 'auto' | 'fixed'
}

export function PlatformTable({
  containerClassName,
  className,
  layout = 'auto',
  children,
  ...props
}: PlatformTableProps) {
  const containerClasses = [styles.container, containerClassName ?? ''].filter(Boolean).join(' ')
  const tableClasses = [styles.table, styles[layout], className ?? ''].filter(Boolean).join(' ')

  return (
    <div className={containerClasses} data-platform-table-container>
      <table {...props} className={tableClasses} data-platform-table>
        {children}
      </table>
    </div>
  )
}
