import styles from './as-form.module.css'

export default function AsRequestLoading() {
  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <span className={styles.logoLink}>MUNJANGGUN</span>
      </header>
      <main className={styles.doneShell}>
        <div className={styles.donePanel}>
          <p className={styles.doneKicker}>A/S 접수</p>
          <h1>접수 화면을 불러오고 있어요.</h1>
          <p>잠시만 기다려주세요.</p>
        </div>
      </main>
    </div>
  )
}
