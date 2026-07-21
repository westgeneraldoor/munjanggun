import { PlatformPageHeader } from '@/components/platform/ui'
import styles from './AdminRouteLoading.module.css'

interface AdminRouteLoadingProps {
  title: string
  description?: string
}

export default function AdminRouteLoading({ title, description = '화면을 불러오는 중입니다.' }: AdminRouteLoadingProps) {
  return (
    <div className={styles.page} aria-busy="true">
      <span className={styles.srOnly} role="status" aria-live="polite">{description}</span>
      <PlatformPageHeader
        title={title}
        description={description}
        actions={<span className={styles.headerAction} aria-hidden="true" />}
      />
      <div className={styles.skeleton} aria-hidden="true">
        <div className={styles.toolbar}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.rows}>
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
