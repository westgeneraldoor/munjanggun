'use client'

import Link from 'next/link'
import { Home } from 'lucide-react'
import { CustomerAccountMenu, type CustomerAccountMenuProps } from './CustomerAccountMenu'
import styles from './CustomerTopNav.module.css'

export interface CustomerTopNavProps {
  account: CustomerAccountMenuProps
  homeHref?: string
}

export function CustomerTopNav({
  account,
  homeHref = '/',
}: CustomerTopNavProps) {
  return (
    <header className={styles.header}>
      <Link href={homeHref} className={styles.homeLink} aria-label="문장군 홈으로 이동">
        <Home size={16} aria-hidden="true" />
        <span>홈</span>
      </Link>
      <Link href={homeHref} className={styles.brand} aria-label="문장군 홈으로 이동">
        <span className={styles.brandKo}>문장군</span>
        <span className={styles.brandEn}>MUNJANGGUN</span>
      </Link>
      <CustomerAccountMenu {...account} />
    </header>
  )
}
