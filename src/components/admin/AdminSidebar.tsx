'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Package, Settings, LogOut, Menu, X, FolderTree } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './AdminSidebar.module.css'

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const toggleSidebar = () => setIsOpen(!isOpen)

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
    { name: '노드 관리', path: '/admin/nodes', icon: FolderTree },
    { name: '사이트 설정', path: '/admin/settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile Top Bar */}
      <header className={styles.mobileHeader}>
        <div className={styles.mobileHeaderTitle}>문장군 관리자</div>
        <button onClick={toggleSidebar} className={styles.menuButton} aria-label="메뉴 열기">
          <Menu size={24} />
        </button>
      </header>

      {/* Overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>문장군 관리자</div>
          <button onClick={() => setIsOpen(false)} className={styles.closeButton} aria-label="메뉴 닫기">
            <X size={24} />
          </button>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.path)
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                    onClick={() => setIsOpen(false)}
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
