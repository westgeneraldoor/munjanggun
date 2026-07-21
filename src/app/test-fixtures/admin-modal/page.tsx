import { notFound } from 'next/navigation'
import { AdminModalFixtureClient } from './AdminModalFixtureClient'
import styles from './modal-fixture.module.css'

export const dynamic = 'force-dynamic'

export default function AdminModalFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className={styles.page} data-mg-theme="admin">
      <AdminModalFixtureClient />
    </main>
  )
}
