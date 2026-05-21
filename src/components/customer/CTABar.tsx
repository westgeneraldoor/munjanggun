'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Share2, Check, Home, MessageCircle, Link as LinkIcon, Copy } from 'lucide-react'
import { logError } from '@/lib/logger'
import { buildKakaoFeedTemplate, buildNativeShareData, type KakaoFeedTemplate } from '@/lib/share'
import styles from './CTABar.module.css'

interface CTABarProps {
  reservationUrl: string | null
  storeUrl: string | null
  hideUntilScroll?: boolean
  shareTitle?: string | null
  shareDescription?: string | null
  shareImageUrl?: string | null
}

type KakaoWindow = Window & {
  Kakao?: {
    init: (key: string) => void
    isInitialized: () => boolean
    Share?: {
      sendDefault: (options: KakaoFeedTemplate) => void
    }
  }
}

const KAKAO_SDK_ID = 'kakao-js-sdk'
const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js'
const KAKAO_JAVASCRIPT_KEY = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY

function canUseNativeShare(shareData: ShareData) {
  if (typeof navigator.share !== 'function') {
    return false
  }

  return typeof navigator.canShare !== 'function' || navigator.canShare(shareData)
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function loadKakaoSdk() {
  return new Promise<void>((resolve, reject) => {
    if ((window as KakaoWindow).Kakao?.Share) {
      resolve()
      return
    }

    const existingScript = document.getElementById(KAKAO_SDK_ID)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Kakao SDK load failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = KAKAO_SDK_ID
    script.src = KAKAO_SDK_URL
    script.async = true
    script.crossOrigin = 'anonymous'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Kakao SDK load failed')), { once: true })
    document.head.appendChild(script)
  })
}

export default function CTABar({
  reservationUrl,
  storeUrl,
  hideUntilScroll = false,
  shareTitle,
  shareDescription,
  shareImageUrl,
}: CTABarProps) {
  const [isVisible, setIsVisible] = useState(!hideUntilScroll)
  const [shared, setShared] = useState(false)
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
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

  const showSharedState = () => {
    if (sharedTimerRef.current) {
      clearTimeout(sharedTimerRef.current)
    }

    setShared(true)
    sharedTimerRef.current = setTimeout(() => {
      setShared(false)
      sharedTimerRef.current = null
    }, 1500)
  }

  const handleShare = async () => {
    const url = window.location.href
    const title = shareTitle || document.title
    const shareData = buildNativeShareData({ title, url })

    try {
      if (canUseNativeShare(shareData)) {
        await navigator.share(shareData)
        setIsShareMenuOpen(false)
        showSharedState()
        return
      }

      await copyToClipboard(url)
      setIsShareMenuOpen(false)
      showSharedState()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        logError('공유하기 실패', err)
      }
    }
  }

  const handleKakaoShare = async () => {
    const url = window.location.href
    const title = shareTitle || document.title

    if (!KAKAO_JAVASCRIPT_KEY || !shareImageUrl) {
      await handleShare()
      return
    }

    try {
      await loadKakaoSdk()
      const kakao = (window as KakaoWindow).Kakao

      if (kakao && !kakao.isInitialized()) {
        kakao.init(KAKAO_JAVASCRIPT_KEY)
      }

      kakao?.Share?.sendDefault(
        buildKakaoFeedTemplate({
          title,
          description: shareDescription,
          imageUrl: shareImageUrl,
          pageUrl: url,
          reservationUrl,
          storeUrl,
        })
      )

      setIsShareMenuOpen(false)
      showSharedState()
    } catch (err) {
      logError('카카오톡 공유 실패', err)
      await handleShare()
    }
  }

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(window.location.href)
      setIsShareMenuOpen(false)
      showSharedState()
    } catch (err) {
      logError('링크 복사 실패', err)
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
        onClick={() => setIsShareMenuOpen(open => !open)}
        aria-label="공유하기"
        aria-expanded={isShareMenuOpen}
        aria-haspopup="menu"
      >
        {shared ? <Check size={20} /> : <Share2 size={20} />}
      </button>
      {isShareMenuOpen && (
        <div className={styles.shareMenu} role="menu" aria-label="공유 방법 선택">
          {KAKAO_JAVASCRIPT_KEY && shareImageUrl && (
            <button type="button" className={styles.shareMenuItem} onClick={handleKakaoShare} role="menuitem">
              <MessageCircle size={18} />
              <span>카카오톡</span>
            </button>
          )}
          <button type="button" className={styles.shareMenuItem} onClick={handleShare} role="menuitem">
            <LinkIcon size={18} />
            <span>기본 공유</span>
          </button>
          <button type="button" className={styles.shareMenuItem} onClick={handleCopyLink} role="menuitem">
            <Copy size={18} />
            <span>링크 복사</span>
          </button>
        </div>
      )}
    </div>
  )
}
