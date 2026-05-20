'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import styles from './NodeHero.module.css'

interface NodeHeroProps {
  desktopMedia: { image_url: string; display_order: number }[]
  mobileMedia: { image_url: string; display_order: number }[]
  title?: string | null
  subtitle?: string | null
  description?: string | null
  videoUrl?: string | null
  mobileVideoUrl?: string | null
  slideInterval?: number
  slideTransition?: 'fade' | 'slide'
}

/**
 * 이미지 하단 영역의 밝기를 감지하여 텍스트 색상 결정
 */
function detectBrightness(
  imgSrc: string,
  callback: (theme: 'light' | 'dark') => void
) {
  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const w = 64
    const h = Math.round(64 * (img.height / img.width))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { callback('dark'); return }
    ctx.drawImage(img, 0, 0, w, h)
    // 하단 40% 샘플링
    const startY = Math.round(h * 0.6)
    const data = ctx.getImageData(0, startY, w, h - startY).data
    let lum = 0
    const count = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      lum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    }
    callback((lum / count) > 140 ? 'light' : 'dark')
  }
  img.onerror = () => callback('dark')
  img.src = imgSrc
}

export default function NodeHero({
  desktopMedia,
  mobileMedia,
  title,
  subtitle,
  description,
  videoUrl,
  mobileVideoUrl,
  slideInterval = 5,
  slideTransition = 'fade'
}: NodeHeroProps) {
  const [textTheme, setTextTheme] = useState<'light' | 'dark'>('dark')
  
  const [currentDesktopSlide, setCurrentDesktopSlide] = useState(0)
  const [prevDesktopSlide, setPrevDesktopSlide] = useState(0)
  
  const [currentMobileSlide, setCurrentMobileSlide] = useState(0)
  const [prevMobileSlide, setPrevMobileSlide] = useState(0)

  const analyzed = useRef(false)

  const hasDesktop = desktopMedia.length > 0 || !!videoUrl
  const hasMobile = mobileMedia.length > 0 || !!mobileVideoUrl
  const hasMedia = hasDesktop || hasMobile

  const currentImage = (desktopMedia.length > 0 ? desktopMedia[currentDesktopSlide].image_url : null) || 
                       (mobileMedia.length > 0 ? mobileMedia[currentMobileSlide].image_url : null)

  const handleBrightness = useCallback((theme: 'light' | 'dark') => {
    setTextTheme(theme)
  }, [])

  useEffect(() => {
    if (currentImage && !analyzed.current) {
      analyzed.current = true
      detectBrightness(currentImage, handleBrightness)
    }
  }, [currentImage, handleBrightness])

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

  const handleScrollDown = () => {
    window.scrollTo({
      top: window.innerHeight * 0.8,
      behavior: 'smooth',
    })
  }

  const themeClass = textTheme === 'light' ? styles.textDark : styles.textLight
  const hasText = !!(title || subtitle || description)

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
            alt={title || '히어로 이미지'}
            fill
            priority={idx === 0}
            quality={85}
            sizes="100vw"
            className={styles.image}
          />
        </div>
      )
    })
  }

  if (!hasDesktop && !hasMobile && !hasText) return null

  return (
    <section id="node-hero-section" className={`${styles.hero} ${!hasMedia ? styles.textOnly : ''}`}>
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



      {hasText && hasMedia && <div className={`${styles.gradient} ${themeClass}`} />}

      {hasText && (
        <div className={`${styles.info} ${themeClass}`}>
          {/* 골드 악센트 라인 */}
          <div className={styles.accentLine} aria-hidden="true" />
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {description && <p className={styles.description}>{description}</p>}
        </div>
      )}

      {hasText && (
        <button
          type="button"
          className={`${styles.scrollCue} ${themeClass}`}
          onClick={handleScrollDown}
          aria-label="아래로 스크롤"
        >
          <ChevronDown size={24} />
        </button>
      )}
    </section>
  )
}

