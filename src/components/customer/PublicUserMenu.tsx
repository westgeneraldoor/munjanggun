'use client'

import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, ClipboardList, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { createPlatformClient } from '@/lib/supabase/platform-client'
import { logError } from '@/lib/logger'
import styles from './PublicUserMenu.module.css'

type ProfileRole = 'customer' | 'sales_manager' | 'administrator'

interface MenuProfile {
  email: string | null
  displayName: string
  role: ProfileRole
}

type PublicUserMenuProps = {
  variant?: 'floating' | 'blog'
  tone?: 'dark' | 'light' | 'hero'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const HIDDEN_PATH_PREFIXES = [
  '/admin',
  '/api',
  '/auth',
  '/login',
  '/manager',
  '/portal',
]

const hasSupabasePublicEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

function normalizeDisplayName(value: string | null | undefined, role: ProfileRole) {
  const trimmed = value?.trim()
  if (!trimmed || /^[?\s]+$/.test(trimmed) || trimmed.includes('�')) {
    return role === 'administrator' ? '문장군 관리자' : '문장군 고객'
  }
  return trimmed
}

export default function PublicUserMenu({
  variant = 'floating',
  tone = 'dark',
  open: controlledOpen,
  onOpenChange,
}: PublicUserMenuProps) {
  const pathname = usePathname()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const [profile, setProfile] = useState<MenuProfile | null>(null)
  const [loading, setLoading] = useState(hasSupabasePublicEnv)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const isOpenControlled = controlledOpen !== undefined

  const setMenuOpen = useCallback((nextOpen: boolean) => {
    if (!isOpenControlled) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [isOpenControlled, onOpenChange])

  const isBlogPath = pathname === '/blog' || pathname.startsWith('/blog/')
  const isEmbedded = variant === 'blog'
  const isHidden = HIDDEN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || (isBlogPath && !isEmbedded)
  const loginHref = `/login?next=${encodeURIComponent(pathname || '/')}`
  const containerClassName = [
    styles.container,
    isEmbedded ? styles.blogEmbedded : '',
    tone === 'hero' ? styles.blogHero : tone === 'light' ? styles.blogLight : styles.blogDark,
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (isHidden) {
      return
    }

    if (!hasSupabasePublicEnv) {
      return
    }

    let mounted = true
    const supabase = createPlatformClient()

    const loadProfile = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          if (mounted) setProfile(null)
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('display_name, email, role')
          .eq('id', user.id)
          .maybeSingle()

        if (error) {
          logError('Fetch public user menu profile error', error)
        }

        const dbProfile = data as {
          display_name: string | null
          email: string | null
          role: ProfileRole
        } | null

        if (mounted) {
          const role = dbProfile?.role || 'customer'
          setProfile({
            email: dbProfile?.email || user.email || null,
            displayName: normalizeDisplayName(
              dbProfile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name,
              role,
            ),
            role,
          })
        }
      } catch (err) {
        logError('Fetch public user menu unexpected error', err)
        if (mounted) setProfile(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadProfile()

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadProfile()
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [isHidden])

  useEffect(() => {
    if (!open) return

    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    })

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        window.requestAnimationFrame(() => menuToggleRef.current?.focus())
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, setMenuOpen])

  if (isHidden || loading) {
    return null
  }

  const handleLogout = async () => {
    if (!hasSupabasePublicEnv) return

    try {
      const supabase = createPlatformClient()
      const { error } = await supabase.auth.signOut()
      if (error) logError('Public user menu signout error', error)
      setProfile(null)
      setMenuOpen(false)
      router.refresh()
    } catch (err) {
      logError('Public user menu signout unexpected error', err)
    }
  }

  if (!profile) {
    return (
      <div className={containerClassName}>
        <Link href={loginHref} className={styles.loginLink} id="public-login-link">
          <LogIn size={17} aria-hidden="true" />
          <span>로그인</span>
        </Link>
      </div>
    )
  }

  const isAdministrator = profile.role === 'administrator'
  const name = profile.displayName.length > 12
    ? `${profile.displayName.slice(0, 12)}...`
    : profile.displayName

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    if (items.length === 0) return

    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowUp'
          ? (currentIndex <= 0 ? items.length - 1 : currentIndex - 1)
          : (currentIndex + 1) % items.length
    items[nextIndex]?.focus()
  }

  const handleContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setMenuOpen(false)
    }
  }

  if (isEmbedded) {
    return (
      <div className={containerClassName} ref={menuRef} onBlur={handleContainerBlur}>
        <button
          ref={menuToggleRef}
          type="button"
          className={styles.embeddedTrigger}
          onClick={() => setMenuOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="public-user-menu"
          aria-label="계정 메뉴 열기"
          id="public-user-menu-toggle"
        >
          <UserRound size={18} aria-hidden="true" />
          <span>{name}</span>
          <ChevronDown size={15} aria-hidden="true" className={open ? styles.chevronOpen : ''} />
        </button>
        {open && (
          <div className={styles.menu} role="menu" id="public-user-menu" onKeyDown={handleMenuKeyDown}>
            <div className={styles.identity}>
              <span className={styles.identityName}>{profile.displayName}</span>
              {profile.email && <span className={styles.identityEmail}>{profile.email}</span>}
            </div>
            <Link href="/portal" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
              <UserRound size={16} aria-hidden="true" />
              <span>마이페이지</span>
            </Link>
            <Link href="/portal/measure/new" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
              <ClipboardList size={16} aria-hidden="true" />
              <span>무료방문견적 신청</span>
            </Link>
            {isAdministrator && (
              <Link href="/admin/platform" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
                <ShieldCheck size={16} aria-hidden="true" />
                <span>플랫폼 어드민</span>
              </Link>
            )}
            <button type="button" className={styles.menuItem} role="menuitem" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" />
              <span>로그아웃</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={containerClassName} ref={menuRef} onBlur={handleContainerBlur}>
      <button
        ref={menuToggleRef}
        type="button"
        className={styles.trigger}
        onClick={() => setMenuOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="public-user-menu"
        id="public-user-menu-trigger"
      >
        <UserRound size={18} aria-hidden="true" />
        <span>{name}</span>
        <ChevronDown size={15} aria-hidden="true" className={open ? styles.chevronOpen : ''} />
      </button>

      {open && (
        <div className={styles.menu} role="menu" id="public-user-menu" onKeyDown={handleMenuKeyDown}>
          <div className={styles.identity}>
            <span className={styles.identityName}>{profile.displayName}</span>
            {profile.email && <span className={styles.identityEmail}>{profile.email}</span>}
          </div>
          <Link href="/portal" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
            <UserRound size={16} aria-hidden="true" />
            <span>마이페이지</span>
          </Link>
          <Link href="/portal/measure/new" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
            <ClipboardList size={16} aria-hidden="true" />
            <span>무료방문견적 신청</span>
          </Link>
          {isAdministrator && (
            <Link href="/admin/platform" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
              <ShieldCheck size={16} aria-hidden="true" />
              <span>플랫폼 어드민</span>
            </Link>
          )}
          <button type="button" className={styles.menuItem} role="menuitem" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            <span>로그아웃</span>
          </button>
        </div>
      )}
    </div>
  )
}
