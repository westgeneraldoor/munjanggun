'use client'

import Link from 'next/link'
import styles from './Breadcrumb.module.css'

interface BreadcrumbProps {
  items: { name: string; href: string }[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (!items || items.length === 0) return null

  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      {/* Desktop view: Full path */}
      <ol className={styles.desktopList}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.href} className={styles.desktopItem}>
              {isLast ? (
                <span className={styles.current} aria-current="page">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.href} className={styles.link}>
                    {item.name}
                  </Link>
                  <span className={styles.separator} aria-hidden="true">›</span>
                </>
              )}
            </li>
          )
        })}
      </ol>

      {/* Mobile view: Full path condensed */}
      <div className={styles.mobileList}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <span key={item.href} className={styles.mobileItem}>
              {isLast ? (
                <span className={styles.mobileCurrent}>{item.name}</span>
              ) : (
                <>
                  <Link href={item.href} className={styles.mobileLink}>{item.name}</Link>
                  <span className={styles.mobileSeparator}>›</span>
                </>
              )}
            </span>
          )
        })}
      </div>
    </nav>
  )
}
