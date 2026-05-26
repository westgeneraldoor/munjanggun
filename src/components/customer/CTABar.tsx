'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Share2, Check, Home } from 'lucide-react'
import { logError } from '@/lib/logger'
import { buildClipboardFallbackText, buildNativeShareData } from '@/lib/share'
import styles from './CTABar.module.css'

interface CTABarProps {
  reservationUrl: string | null
  storeUrl: string | null
  hideUntilScroll?: boolean
  shareTitle?: string | null
}

function canUseNativeShare(shareData: ShareData) {
  if (typeof navigator.share !== 'function') {
    return false
  }

  return typeof navigator.canShare !== 'function' || navigator.canShare(shareData)
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Clipboard fallback failed')
  }
}

export default function CTABar({
  reservationUrl,
  storeUrl,
  hideUntilScroll = false,
  shareTitle,
}: CTABarProps) {
  const [isVisible, setIsVisible] = useState(!hideUntilScroll)
  const [shared, setShared] = useState(false)
  const [shareNotice, setShareNotice] = useState<string | null>(null)
  const sharedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        rootMargin: '-50px 0px 0px 0px',
      }
    )

    observer.observe(heroEl)
    return () => observer.disconnect()
  }, [hideUntilScroll])

  useEffect(() => {
    return () => {
      if (sharedTimerRef.current) {
        clearTimeout(sharedTimerRef.current)
      }
    }
  }, [])

  const showSharedState = (notice: string | null = null) => {
    if (sharedTimerRef.current) {
      clearTimeout(sharedTimerRef.current)
    }

    setShared(true)
    setShareNotice(notice)
    sharedTimerRef.current = setTimeout(() => {
      setShared(false)
      setShareNotice(null)
      sharedTimerRef.current = null
    }, 1500)
  }

  const copyShareLink = async (url: string) => {
    await copyTextToClipboard(buildClipboardFallbackText({ url }))
    showSharedState('링크가 복사됐어요')
  }

  const handleShare = async () => {
    const url = window.location.href
    const title = shareTitle || document.title
    const shareData = buildNativeShareData({ title, url })

    try {
      if (canUseNativeShare(shareData)) {
        await navigator.share(shareData)
        showSharedState()
        return
      }

      await copyShareLink(url)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return
      }

      try {
        await copyShareLink(url)
      } catch (copyErr) {
        logError('공유하기 실패', err)
        logError('공유 링크 복사 실패', copyErr)
        showSharedState('공유를 지원하지 않는 브라우저예요')
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
      {shareNotice && (
        <span className={styles.shareNotice} role="status">
          {shareNotice}
        </span>
      )}
    </div>
  )
}
