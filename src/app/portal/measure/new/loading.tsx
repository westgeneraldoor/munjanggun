import styles from './measure-form.module.css'

export default function MeasureRequestLoading() {
  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <span className={styles.logoLink}>MUNJANGGUN</span>
      </header>
      <main className={styles.doneShell}>
        <div className={styles.donePanel}>
          <p className={styles.doneKicker}>무료방문 실측견적 상담</p>
          <h1>신청 화면을 불러오고 있어요.</h1>
          <p>잠시만 기다려주세요.</p>
        </div>
      </main>
    </div>
  )
}
