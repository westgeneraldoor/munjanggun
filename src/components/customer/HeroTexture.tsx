'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import { ChevronDown } from 'lucide-react'
import styles from './HeroTexture.module.css'

interface HeroTextureProps {
  imageUrl: string | null
  colorName: string
  collectionName?: string
  tagline?: string | null
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

export default function HeroTexture({
  imageUrl,
  colorName,
  collectionName,
  tagline,
}: HeroTextureProps) {
  const [textTheme, setTextTheme] = useState<'light' | 'dark'>('dark')
  const analyzed = useRef(false)

  const handleBrightness = useCallback((theme: 'light' | 'dark') => {
    setTextTheme(theme)
  }, [])

  useEffect(() => {
    if (imageUrl && !analyzed.current) {
      analyzed.current = true
      detectBrightness(imageUrl, handleBrightness)
    }
  }, [imageUrl, handleBrightness])

  const handleScrollDown = () => {
    window.scrollTo({
      top: window.innerHeight * 0.8,
      behavior: 'smooth',
    })
  }

  const themeClass = textTheme === 'light' ? styles.textDark : styles.textLight

  return (
    <section id="hero-section" className={styles.hero}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${colorName} 텍스처`}
          fill
          priority
          quality={85}
          sizes="100vw"
          className={styles.image}
        />
      ) : (
        <div className={styles.placeholder}>{colorName}</div>
      )}

      {/* 하단 그라데이션 */}
      <div className={`${styles.gradient} ${themeClass}`} />

      {/* 컬러 정보 오버레이 */}
      <div className={`${styles.info} ${themeClass}`}>
        {collectionName && (
          <span className={styles.collectionTag}>{collectionName}</span>
        )}
        <h1 className={styles.colorName}>{colorName}</h1>
        {tagline && <p className={styles.tagline}>{tagline}</p>}
      </div>

      {/* 스크롤 유도 화살표 */}
      <button
        type="button"
        className={`${styles.scrollCue} ${themeClass}`}
        onClick={handleScrollDown}
        aria-label="아래로 스크롤"
      >
        <ChevronDown size={24} />
      </button>
    </section>
  )
}
