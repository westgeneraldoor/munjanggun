import Link from 'next/link'
import { ChevronLeft, Home } from 'lucide-react'
import styles from './IntakeRouteLoading.module.css'

interface IntakeRouteLoadingProps {
  title: string
  description: string
}

export default function IntakeRouteLoading({ title, description }: IntakeRouteLoadingProps) {
  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>MUNJANGGUN</Link>
        <div className={styles.topActions}>
          <Link href="/portal" className={styles.topLink}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            <span>마이페이지</span>
          </Link>
          <Link href="/" className={styles.iconLink} aria-label="홈으로 이동">
            <Home size={17} strokeWidth={1.9} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className={styles.shell} aria-busy="true" aria-label={title}>
        <aside className={styles.rail}>
          <div className={styles.railLineShort} />
          <div className={styles.railTitle} />
          <div className={styles.railText} />
          <div className={styles.progressTrack}>
            <span />
          </div>
          <div className={styles.stepStack}>
            <i />
            <i />
            <i />
          </div>
        </aside>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <p>{title}</p>
            <h1>{description}</h1>
          </div>
          <div className={styles.skeletonGrid}>
            <span />
            <span />
            <span />
          </div>
        </section>
      </main>
    </div>
  )
}
