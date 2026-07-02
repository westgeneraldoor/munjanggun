'use client'

import Link from 'next/link'
import { LogIn, LogOut, UserRound } from 'lucide-react'
import { PlatformButton } from '@/components/platform/ui'
import styles from './CustomerAccountMenu.module.css'

export interface CustomerAccountMenuProps {
  displayName?: string
  email?: string
  isAuthenticated: boolean
  portalHref?: string
  onLogout?: () => void
}

export function CustomerAccountMenu({
  displayName,
  email,
  isAuthenticated,
  portalHref = '/portal',
  onLogout,
}: CustomerAccountMenuProps) {
  if (!isAuthenticated) {
    return (
      <Link href={`/login?next=${encodeURIComponent(portalHref)}`} className={styles.loginLink}>
        <LogIn size={16} aria-hidden="true" />
        <span>로그인</span>
      </Link>
    )
  }

  return (
    <div className={styles.menu} aria-label="고객 계정 메뉴">
      <Link href={portalHref} className={styles.profileLink}>
        <span className={styles.avatar} aria-hidden="true">
          <UserRound size={17} />
        </span>
        <span className={styles.identity}>
          <strong>{displayName || '고객'}</strong>
          {email ? <small>{email}</small> : null}
        </span>
      </Link>
      {onLogout ? (
        <PlatformButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={onLogout}
          id="btn-logout"
          aria-label="로그아웃"
          className={styles.logoutButton}
        >
          <LogOut size={15} aria-hidden="true" />
          <span>로그아웃</span>
        </PlatformButton>
      ) : null}
    </div>
  )
}
