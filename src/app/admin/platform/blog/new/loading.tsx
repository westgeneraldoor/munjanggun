import styles from './approved-manuscript-intake.module.css'

export default function ApprovedManuscriptIntakeLoading() {
  return (
    <div className={styles.loadingPage} role="status" aria-live="polite">
      <h1>승인 원고 등록</h1>
      <p>등록 화면을 준비하고 있습니다.</p>
    </div>
  )
}
