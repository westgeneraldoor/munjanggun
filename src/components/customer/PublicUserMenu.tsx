'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpenText, ChevronDown, ClipboardList, LogIn, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { createPlatformClient } from '@/lib/supabase/platform-client'
import { logError } from '@/lib/logger'
import styles from './PublicUserMenu.module.css'

type ProfileRole = 'customer' | 'sales_manager' | 'administrator'

interface MenuProfile {
  email: string | null
  displayName: string
  role: ProfileRole
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

export default function PublicUserMenu() {
  const pathname = usePathname()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<MenuProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const isHidden = HIDDEN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  const isBlogArticle = /^\/blog\/[^/]+$/.test(pathname || '')
  const isLaunchSurface = pathname === '/measure' || pathname === '/blog' || (pathname?.startsWith('/blog/') ?? false)
  const loginHref = `/login?next=${encodeURIComponent(pathname || '/')}`
  const containerClassName = `${styles.container} ${isLaunchSurface ? styles.launchContainer : ''} ${isBlogArticle ? styles.blogArticleContainer : ''}`

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
              role
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

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  if (isHidden || loading || !hasSupabasePublicEnv) {
    return null
  }

  const handleLogout = async () => {
    if (!hasSupabasePublicEnv) return

    try {
      const supabase = createPlatformClient()
      const { error } = await supabase.auth.signOut()
      if (error) logError('Public user menu signout error', error)
      setProfile(null)
      setOpen(false)
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

  return (
    <div className={containerClassName} ref={menuRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        id="public-user-menu-trigger"
      >
        <UserRound size={18} aria-hidden="true" />
        <span>{name}</span>
        <ChevronDown size={15} aria-hidden="true" className={open ? styles.chevronOpen : ''} />
      </button>

      {open && (
        <div className={styles.menu} role="menu" id="public-user-menu">
          <div className={styles.identity}>
            <span className={styles.identityName}>{profile.displayName}</span>
            {profile.email && <span className={styles.identityEmail}>{profile.email}</span>}
          </div>
          <Link href="/blog" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
            <BookOpenText size={16} aria-hidden="true" />
            <span>블로그 홈</span>
          </Link>
          <Link href="/portal" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
            <UserRound size={16} aria-hidden="true" />
            <span>마이페이지</span>
          </Link>
          <Link href="/measure" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
            <ClipboardList size={16} aria-hidden="true" />
            <span>무료방문견적 안내</span>
          </Link>
          {isAdministrator && (
            <Link href="/admin/platform" className={styles.menuItem} role="menuitem" onClick={() => setOpen(false)}>
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
