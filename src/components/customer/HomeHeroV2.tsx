'use client'

import { ChevronDown } from 'lucide-react'
import styles from './HomeHeroV2.module.css'

interface HomeHeroV2Props {
  settings: {
    hero_title: string | null
    hero_subtitle: string | null
    hero_description: string | null
    hero_video_url: string | null
    hero_mobile_video_url: string | null
    hero_slide_interval?: number
    hero_slide_transition?: string | null
  }
}

export default function HomeHeroV2({ settings }: HomeHeroV2Props) {

  const handleScrollDown = () => {
    const heroEl = document.getElementById('home-hero')
    if (heroEl) {
      window.scrollTo({
        top: heroEl.offsetHeight - 40,
        behavior: 'smooth',
      })
    }
  }

  const hasText = !!(settings.hero_title || settings.hero_subtitle || settings.hero_description)

  if (!hasText) return null

  return (
    <section id="home-hero" className={styles.hero}>
      <div className={styles.content}>
          {/* 상단 골드 장식 세퍼레이터 */}
          <div className={styles.separator} aria-hidden="true">
            <span className={styles.separatorDiamond}>✦</span>
          </div>

          {settings.hero_subtitle && (
            <p className={styles.subtitle}>{settings.hero_subtitle}</p>
          )}
          <h1 className={styles.title}>{settings.hero_title || 'DIGITAL SHOWROOM'}</h1>

          {/* 제목-설명 사이 작은 장식 */}
          {settings.hero_description && (
            <div className={styles.separatorSmall} aria-hidden="true">
              <span className={styles.separatorDiamond}>✦</span>
            </div>
          )}

          {settings.hero_description && (
            <p className={styles.description}>
              {settings.hero_description}
            </p>
          )}
      </div>

      <button
          type="button"
          className={styles.scrollCue}
          onClick={handleScrollDown}
          aria-label="둘러보기"
        >
          <span className={styles.scrollText}>둘러보기</span>
          <ChevronDown size={20} />
      </button>
    </section>
  )
}
