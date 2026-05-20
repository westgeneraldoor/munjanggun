import styles from './RouteLoading.module.css'

export default function RouteLoading() {
  return (
    <main className={styles.main} aria-label="페이지를 불러오는 중">
      <div className={styles.content}>
        <div className={styles.breadcrumb} />
        <div className={styles.title} />
        <div className={styles.subtitle} />
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={styles.card}>
              <div className={styles.image} />
              <div className={styles.line} />
              <div className={styles.shortLine} />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
