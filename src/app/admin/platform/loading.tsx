import styles from './platform-admin.module.css'

export default function AdminPlatformLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleRow}>
          <div>
            <h1 className={styles.pageTitle}>통합 접수 큐</h1>
            <p className={styles.pageDesc}>접수 목록을 불러오는 중입니다.</p>
          </div>
        </div>
      </div>
      <div className={styles.loadingRows}>
        {Array.from({ length: 7 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  )
}
