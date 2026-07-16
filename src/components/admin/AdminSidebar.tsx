'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut, Menu, X, FolderTree, ClipboardList, Sliders, Newspaper, Images } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PlatformIconButton } from '@/components/platform/ui'
import styles from './AdminSidebar.module.css'

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  const openSidebar = () => {
    setIsOpen(true)
  }

  const closeSidebar = () => {
    setIsOpen(false)
    requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  useEffect(() => {
    if (!isOpen) return

    let focusFrame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }))
    })
    const mobileViewport = window.matchMedia('(max-width: 1023px)')
    const mainContent = document.querySelector<HTMLElement>('main')
    const mainWasInert = mainContent?.inert ?? false
    if (mainContent) mainContent.inert = true

    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setIsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        requestAnimationFrame(() => menuButtonRef.current?.focus())
        return
      }

      if (event.key === 'Tab' && sidebarRef.current) {
        const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ))
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement

        if (event.shiftKey && (active === first || !sidebarRef.current.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (active === last || !sidebarRef.current.contains(active))) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    mobileViewport.addEventListener('change', handleViewportChange)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      mobileViewport.removeEventListener('change', handleViewportChange)
      document.removeEventListener('keydown', handleKeyDown)
      if (mainContent) mainContent.inert = mainWasInert
    }
  }, [isOpen])

  // Do not show sidebar on login page
  if (pathname === '/admin/login') {
    return null
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const navItems = [
    { name: '접수 큐', path: '/admin/platform', icon: ClipboardList },
    { name: '견적 설정', path: '/admin/platform/settings', icon: Sliders },
    { name: '블로그 콘텐츠', path: '/admin/platform/blog', icon: Newspaper },
    { name: '사진보관함', path: '/admin/platform/assets', icon: Images },
    { name: '노드 관리', path: '/admin/nodes', icon: FolderTree },
    { name: '사이트 설정', path: '/admin/settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile Top Bar */}
      <header className={styles.mobileHeader}>
        <div className={styles.mobileHeaderTitle}>문장군 관리자</div>
        <PlatformIconButton
          ref={menuButtonRef}
          variant="ghost"
          onClick={openSidebar}
          className={styles.menuButton}
          aria-label="메뉴 열기"
          aria-expanded={isOpen}
          aria-controls="admin-sidebar"
        >
          <Menu size={24} />
        </PlatformIconButton>
      </header>

      {/* Overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen || undefined}
        aria-label="관리자 메뉴"
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>문장군 관리자</div>
          <PlatformIconButton
            ref={closeButtonRef}
            variant="ghost"
            onClick={closeSidebar}
            className={styles.closeButton}
            aria-label="메뉴 닫기"
          >
            <X size={24} />
          </PlatformIconButton>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {navItems.map((item) => {
              const Icon = item.icon
              // 중복 매칭 버그 수정: /admin/platform/settings 가 /admin/platform 에 startsWith 매칭되지 않도록 함
              const isActive = item.path === '/admin/platform'
                ? pathname === '/admin/platform' || (pathname.startsWith('/admin/platform/') && !pathname.startsWith('/admin/platform/settings') && !pathname.startsWith('/admin/platform/blog') && !pathname.startsWith('/admin/platform/assets'))
                : pathname.startsWith(item.path)
              const isPending = pendingPath === item.path && !isActive

              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`${styles.navItem} ${isActive || isPending ? styles.active : ''} ${isPending ? styles.pending : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      setPendingPath(item.path)
                      setIsOpen(false)
                    }}
                  >
                    <Icon size={24} />
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutButton}>
            <LogOut size={24} />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  )
}
