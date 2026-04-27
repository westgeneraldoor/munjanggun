'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styles from './CollectionCard.module.css'

interface CollectionCardProps {
  collection: {
    name: string
    slug: string
    description: string | null
    thumbnail_url: string | null
  }
}

/**
 * 이미지 하단 영역의 평균 밝기를 계산하여 'light' | 'dark' 반환
 * - 하단 35%만 샘플링 (텍스트가 위치하는 영역)
 * - luminance > 128 → 'light' (검정 글씨 필요)
 * - luminance <= 128 → 'dark' (흰 글씨 필요)
 */
function getImageBrightness(
  imgSrc: string,
  callback: (theme: 'light' | 'dark') => void
) {
  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const sampleWidth = 64
    const sampleHeight = Math.round(64 * (img.height / img.width))
    canvas.width = sampleWidth
    canvas.height = sampleHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      callback('dark')
      return
    }

    ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight)

    // 하단 35%만 샘플링
    const startY = Math.round(sampleHeight * 0.65)
    const regionHeight = sampleHeight - startY
    const imageData = ctx.getImageData(0, startY, sampleWidth, regionHeight)
    const data = imageData.data

    let totalLuminance = 0
    const pixelCount = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
      // 가중 평균 luminance (인간 시각 기준)
      totalLuminance += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    }

    const avgLuminance = totalLuminance / pixelCount
    callback(avgLuminance > 140 ? 'light' : 'dark')
  }
  img.onerror = () => callback('dark')
  img.src = imgSrc
}

export default function CollectionCard({ collection }: CollectionCardProps) {
  const [textTheme, setTextTheme] = useState<'light' | 'dark'>('dark')
  const [imgLoaded, setImgLoaded] = useState(false)
  const analyzed = useRef(false)

  const handleBrightness = useCallback((theme: 'light' | 'dark') => {
    setTextTheme(theme)
  }, [])

  useEffect(() => {
    if (collection.thumbnail_url && !analyzed.current) {
      analyzed.current = true
      getImageBrightness(collection.thumbnail_url, handleBrightness)
    }
  }, [collection.thumbnail_url, handleBrightness])

  const themeClass = textTheme === 'light' ? styles.textDark : styles.textLight

  return (
    <Link href={`/collection/${collection.slug}`} className={styles.card}>
      <div className={styles.imageWrapper}>
        {collection.thumbnail_url ? (
          <Image
            src={collection.thumbnail_url}
            alt={`${collection.name} 컬렉션`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className={`${styles.image} ${imgLoaded ? styles.imageLoaded : ''}`}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderText}>{collection.name}</span>
          </div>
        )}
        <div className={`${styles.overlay} ${themeClass}`} />
        <div className={`${styles.content} ${themeClass}`}>
          <h2 className={styles.name}>{collection.name}</h2>
          {collection.description && (
            <p className={styles.description}>{collection.description}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
