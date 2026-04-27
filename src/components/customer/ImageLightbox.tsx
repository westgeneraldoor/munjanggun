'use client'

import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useCallback, useState } from 'react'
import styles from './ImageLightbox.module.css'

interface Photo {
  image_url: string
  caption: string | null
}

interface ImageLightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onIndexChange: (index: number) => void
}

export default function ImageLightbox({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const total = photos.length

  const goToPrev = useCallback(() => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true)
      onIndexChange(currentIndex - 1)
      setTimeout(() => setIsAnimating(false), 300)
    }
  }, [currentIndex, isAnimating, onIndexChange])

  const goToNext = useCallback(() => {
    if (currentIndex < total - 1 && !isAnimating) {
      setIsAnimating(true)
      onIndexChange(currentIndex + 1)
      setTimeout(() => setIsAnimating(false), 300)
    }
  }, [currentIndex, total, isAnimating, onIndexChange])

  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goToPrev()
      if (e.key === 'ArrowRight') goToNext()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, goToPrev, goToNext])

  // 스크롤 잠금
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // 터치 스와이프
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = e.touches[0].clientX
    setSwipeOffset(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
    const diff = touchEndX.current - touchStartX.current
    // 끝에서 더 가면 저항감 (offset을 줄임)
    const atStart = currentIndex === 0 && diff > 0
    const atEnd = currentIndex === total - 1 && diff < 0
    setSwipeOffset(atStart || atEnd ? diff * 0.3 : diff)
  }

  const handleTouchEnd = () => {
    const diff = touchEndX.current - touchStartX.current
    const threshold = 60

    if (diff > threshold) {
      goToPrev()
    } else if (diff < -threshold) {
      goToNext()
    }
    setSwipeOffset(0)
  }

  if (!isOpen || photos.length === 0) return null

  const currentPhoto = photos[currentIndex]
  if (!currentPhoto) return null

  return (
    <div
      className={styles.overlay}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 닫기 버튼 */}
      <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
        <X size={24} />
      </button>

      {/* 이미지 영역 */}
      <div
        className={styles.imageContainer}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? 'transform 0.3s ease' : 'none',
        }}
      >
        <Image
          src={currentPhoto.image_url}
          alt={currentPhoto.caption || `시공 사진 ${currentIndex + 1}`}
          fill
          quality={85}
          sizes="100vw"
          className={styles.image}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* 데스크톱 좌우 화살표 */}
      {currentIndex > 0 && (
        <button
          className={`${styles.navButton} ${styles.prevButton}`}
          onClick={(e) => {
            e.stopPropagation()
            goToPrev()
          }}
          aria-label="이전 사진"
        >
          <ChevronLeft size={28} />
        </button>
      )}
      {currentIndex < total - 1 && (
        <button
          className={`${styles.navButton} ${styles.nextButton}`}
          onClick={(e) => {
            e.stopPropagation()
            goToNext()
          }}
          aria-label="다음 사진"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* 하단 인디케이터 + 캡션 */}
      <div className={styles.bottomInfo}>
        {currentPhoto.caption && (
          <p className={styles.caption}>{currentPhoto.caption}</p>
        )}
        {total > 1 && (
          <span className={styles.counter}>
            {currentIndex + 1} / {total}
          </span>
        )}
      </div>
    </div>
  )
}
