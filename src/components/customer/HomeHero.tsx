'use client'

import { ChevronDown } from 'lucide-react'
import styles from './HomeHero.module.css'

export default function HomeHero() {
  const handleScrollDown = () => {
    const heroEl = document.getElementById('home-hero')
    if (heroEl) {
      window.scrollTo({
        top: heroEl.offsetHeight - 40,
        behavior: 'smooth',
      })
    }
  }

  return (
    <section id="home-hero" className={styles.hero}>
      <div className={styles.content}>
        <p className={styles.subtitle}>PREMIUM FILM COLOR SHOWROOM</p>
        <h1 className={styles.title}>MUNJANGGUN</h1>
        <p className={styles.description}>
          중문 필름의 모든 컬러를<br />
          디지털로 만나보세요
        </p>
      </div>

      <button
        type="button"
        className={styles.scrollCue}
        onClick={handleScrollDown}
        aria-label="컬렉션 보기"
      >
        <span className={styles.scrollText}>컬렉션 둘러보기</span>
        <ChevronDown size={20} />
      </button>
    </section>
  )
}
