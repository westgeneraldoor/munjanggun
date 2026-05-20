'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Share2, Check, Home } from 'lucide-react'
import { logError } from '@/lib/logger'
import styles from './CTABar.module.css'

interface CTABarProps {
  reservationUrl: string | null
  storeUrl: string | null
  hideUntilScroll?: boolean
}

export default function CTABar({ reservationUrl, storeUrl, hideUntilScroll = false }: CTABarProps) {
  const [isVisible, setIsVisible] = useState(!hideUntilScroll)
  const [shared, setShared] = useState(false)

  useEffect(() => {
    if (!hideUntilScroll) {
      return
    }

    const heroEl = document.getElementById('hero-section') || document.getElementById('home-hero')
    if (!heroEl) {
      requestAnimationFrame(() => setIsVisible(true))
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting)
      },
      {
        threshold: 0,
        rootMargin: '-50px 0px 0px 0px'
      }
    )

    observer.observe(heroEl)
    return () => observer.disconnect()
  }, [hideUntilScroll])

  const handleShare = async () => {
    const shareData = {
      title: document.title,
      url: window.location.href
    }

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
        setShared(true)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShared(true)
      }
      setTimeout(() => setShared(false), 1500)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        logError('공유하기 실패', err)
      }
    }
  }

  return (
    <div className={`${styles.container} ${!isVisible ? styles.hidden : ''}`}>
      <Link href="/" className={styles.homeButton} aria-label="홈으로 이동">
        <Home size={20} />
      </Link>
      {reservationUrl && (
        <a
          href={reservationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.button} ${styles.primary}`}
        >
          무료방문견적
        </a>
      )}
      {storeUrl && (
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.button} ${styles.secondary}`}
        >
          브랜드스토어
        </a>
      )}
      <button
        type="button"
        className={`${styles.shareButton} ${shared ? styles.shared : ''}`}
        onClick={handleShare}
        aria-label="공유하기"
      >
        {shared ? <Check size={20} /> : <Share2 size={20} />}
      </button>
    </div>
  )
}
