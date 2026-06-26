import styles from './portal.module.css'

export default function PortalLoading() {
  return (
    <div className={`${styles.container} ${styles.loading}`}>
      <div className={styles.spinner} aria-label="마이페이지를 불러오는 중" />
    </div>
  )
}
