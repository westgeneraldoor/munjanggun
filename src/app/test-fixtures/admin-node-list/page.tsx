import { notFound } from 'next/navigation'
import NodeList from '@/components/admin/NodeList'
import styles from './node-list-fixture.module.css'

export const dynamic = 'force-dynamic'

export default function AdminNodeListFixturePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main className={styles.page} data-mg-theme="admin">
      <NodeList />
    </main>
  )
}
