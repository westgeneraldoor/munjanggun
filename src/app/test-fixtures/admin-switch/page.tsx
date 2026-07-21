import { notFound } from 'next/navigation'
import { AdminSwitchFixtureClient } from './AdminSwitchFixtureClient'
import styles from './switch-fixture.module.css'

export const dynamic = 'force-dynamic'

export default function AdminSwitchFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className={styles.page} data-mg-theme="admin">
      <AdminSwitchFixtureClient />
    </main>
  )
}
