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
  shareTitle?: string | null
  shareDescription?: string | null
  shareImageUrl?: string | null
}

type KakaoWindow = Window & {
  Kakao?: {
    init: (key: string) => void
    isInitialized: () => boolean
    Share?: {
      sendDefault: (options: {
        objectType: 'feed'
        content: {
          title: string
          description?: string
          imageUrl: string
          link: { mobileWebUrl: string; webUrl: string }
        }
        buttons?: Array<{
          title: string
          link: { mobileWebUrl: string; webUrl: string }
        }>
      }) => void
    }
  }
}

const KAKAO_SDK_ID = 'kakao-js-sdk'
const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js'
const KAKAO_JAVASCRIPT_KEY = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY

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
    const url = window.location.href
    const title = shareTitle || document.title
    const description = shareDescription || '문장군 디지털 쇼룸'

    if (KAKAO_JAVASCRIPT_KEY && shareImageUrl) {
      try {
        await loadKakaoSdk()
        const kakao = (window as KakaoWindow).Kakao

        if (kakao && !kakao.isInitialized()) {
          kakao.init(KAKAO_JAVASCRIPT_KEY)
        }

        const buttons = [
          reservationUrl
            ? {
                title: '무료방문견적',
                link: { mobileWebUrl: reservationUrl, webUrl: reservationUrl },
              }
            : null,
          storeUrl
            ? {
                title: '브랜드스토어',
                link: { mobileWebUrl: storeUrl, webUrl: storeUrl },
              }
            : null,
        ].filter((button): button is NonNullable<typeof button> => Boolean(button))

        kakao?.Share?.sendDefault({
          objectType: 'feed',
          content: {
            title,
            description,
            imageUrl: shareImageUrl,
            link: { mobileWebUrl: url, webUrl: url },
          },
          buttons: buttons.length > 0 ? buttons.slice(0, 2) : [
            {
              title: '자세히 보기',
              link: { mobileWebUrl: url, webUrl: url },
            },
          ],
        })

        setShared(true)
        setTimeout(() => setShared(false), 1500)
        return
      } catch (err) {
        logError('카카오톡 공유 실패', err)
      }
    }

    const shareData = {
      title,
      text: description,
      url,
    }

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
        setShared(true)
      } else {
        await navigator.clipboard.writeText(url)
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
