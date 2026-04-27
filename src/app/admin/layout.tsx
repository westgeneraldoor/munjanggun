import { ReactNode } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import styles from './layout.module.css'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <AdminSidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
