'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import MunjanggunWordmark from '@/app/blog/BlogBrandWordmark'
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
        <MunjanggunWordmark label="MY" compact />
      </Link>
      <div className={styles.topActions}>
        <Link href={portalHref} className={styles.topLink}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          <span>마이페이지</span>
        </Link>
      </div>
    </header>
  )
}
