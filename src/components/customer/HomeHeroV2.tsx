'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'
import { shouldBypassNextImageOptimization } from '@/lib/image'
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
  desktopMedia: { image_url: string; display_order: number }[]
  mobileMedia: { image_url: string; display_order: number }[]
}

export default function HomeHeroV2({ settings, desktopMedia, mobileMedia }: HomeHeroV2Props) {
  const [currentDesktopSlide, setCurrentDesktopSlide] = useState(0)
  const [prevDesktopSlide, setPrevDesktopSlide] = useState(0)

  const [currentMobileSlide, setCurrentMobileSlide] = useState(0)
  const [prevMobileSlide, setPrevMobileSlide] = useState(0)

  const handleScrollDown = () => {
    const heroEl = document.getElementById('home-hero')
    if (heroEl) {
      window.scrollTo({
        top: heroEl.offsetHeight - 40,
        behavior: 'smooth',
      })
    }
  }

  const videoUrl = settings.hero_video_url
  const mobileVideoUrl = settings.hero_mobile_video_url
  const slideInterval = settings.hero_slide_interval || 5
  const slideTransition = settings.hero_slide_transition || 'fade'

  const hasDesktop = desktopMedia.length > 0 || !!videoUrl
  const hasMobile = mobileMedia.length > 0 || !!mobileVideoUrl
  const hasText = !!(settings.hero_title || settings.hero_subtitle || settings.hero_description)

  useEffect(() => {
    if (desktopMedia.length <= 1 || videoUrl) return
    const interval = setInterval(() => {
      setCurrentDesktopSlide((prev) => {
        setPrevDesktopSlide(prev)
        return (prev + 1) % desktopMedia.length
      })
    }, slideInterval * 1000)
    return () => clearInterval(interval)
  }, [desktopMedia.length, slideInterval, videoUrl])

  useEffect(() => {
    if (mobileMedia.length <= 1 || mobileVideoUrl) return
    const interval = setInterval(() => {
      setCurrentMobileSlide((prev) => {
        setPrevMobileSlide(prev)
        return (prev + 1) % mobileMedia.length
      })
    }, slideInterval * 1000)
    return () => clearInterval(interval)
  }, [mobileMedia.length, slideInterval, mobileVideoUrl])

  const renderMedia = (
    mediaArray: { image_url: string; display_order: number }[],
    currentIndex: number,
    prevIndex: number
  ) => {
    if (mediaArray.length === 0) return null

    return mediaArray.map((item, idx) => {
      const isActive = idx === currentIndex
      const isPrev = idx === prevIndex && currentIndex !== prevIndex

      return (
        <div
          key={item.display_order || idx}
          style={{
            position: 'absolute',
            inset: 0,
            ...(slideTransition === 'slide' 
              ? {
                  transform: isActive ? 'translateX(0%)' : isPrev ? 'translateX(-100%)' : 'translateX(100%)',
                  transition: (isActive || isPrev) ? 'transform 0.5s ease-in-out' : 'none',
                  zIndex: isActive ? 1 : 0
                }
              : {
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 1s ease-in-out',
                  zIndex: isActive ? 1 : 0
                }
            )
          }}
        >
          <Image
            src={item.image_url}
            alt="Home Hero Background"
            fill
            priority={idx === 0}
            quality={85}
            sizes="100vw"
            className={styles.image}
            style={{ objectFit: 'cover' }}
            unoptimized={shouldBypassNextImageOptimization(item.image_url)}
          />
        </div>
      )
    })
  }

  if (!hasDesktop && !hasMobile && !hasText) return null

  return (
    <section id="home-hero" className={styles.hero}>
      {/* Desktop Media */}
      <div className={hasMobile ? styles.desktopOnly : ''} style={{ position: 'absolute', inset: 0 }}>
        {videoUrl ? (
          <video
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className={styles.image}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          renderMedia(desktopMedia, currentDesktopSlide, prevDesktopSlide)
        )}
      </div>

      {/* Mobile Media */}
      <div className={hasDesktop ? styles.mobileOnly : ''} style={{ position: 'absolute', inset: 0 }}>
        {mobileVideoUrl ? (
          <video
            src={mobileVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className={styles.image}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          renderMedia(mobileMedia, currentMobileSlide, prevMobileSlide)
        )}
      </div>

      {/* Dark overlay for text readability */}
      {hasText && <div className={styles.gradient} />}

      {hasText && (
        <div className={styles.content}>
          {/* 상단 골드 장식 세퍼레이터 */}
          <div className={styles.separator} aria-hidden="true">
            <span className={styles.separatorDiamond}>✦</span>
          </div>

          {settings.hero_subtitle && (
            <p className={styles.subtitle}>{settings.hero_subtitle}</p>
          )}
          <h1 className={styles.title}>
            {settings.hero_title || 'MUNJANGGUN'}
          </h1>

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
      )}

      {hasText && (
        <button
          type="button"
          className={styles.scrollCue}
          onClick={handleScrollDown}
          aria-label="둘러보기"
        >
          <span className={styles.scrollText}>둘러보기</span>
          <ChevronDown size={20} />
        </button>
      )}
    </section>
  )
}
