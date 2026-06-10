import styles from './AdminRouteLoading.module.css'

interface AdminRouteLoadingProps {
  title: string
  description?: string
}

export default function AdminRouteLoading({ title, description = '화면을 불러오는 중입니다.' }: AdminRouteLoadingProps) {
  return (
    <div className={styles.page} aria-busy="true">
      <div className={styles.header}>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span />
      </div>
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
  )
}
