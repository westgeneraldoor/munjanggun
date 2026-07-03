'use client'

import Link from 'next/link'
import { ArrowLeft, Home } from 'lucide-react'
import styles from './CustomerIntakeTopNav.module.css'

export interface CustomerIntakeTopNavProps {
  brandId?: string
  homeHref?: string
  portalHref?: string
}

export function CustomerIntakeTopNav({
  brandId,
  homeHref = '/blog',
  portalHref = '/portal',
}: CustomerIntakeTopNavProps) {
  return (
    <header className={styles.topbar}>
      <Link href={homeHref} className={styles.brand} id={brandId} aria-label="문장군 홈으로 이동">
        <span className={styles.brandKo}>문장군</span>
        <span className={styles.brandEn}>MUNJANGGUN</span>
      </Link>
      <div className={styles.topActions}>
        <Link href={portalHref} className={styles.topLink}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          <span>마이페이지</span>
        </Link>
        <Link href={homeHref} className={styles.iconLink} aria-label="홈으로 이동">
          <Home size={17} strokeWidth={1.9} aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}
