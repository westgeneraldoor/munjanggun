'use client'

import Link from 'next/link'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestShowroomScrollReset } from '@/components/customer/ScrollRestorer'
import ShowroomImage from '@/components/showroom/ShowroomImage'
import {
  resolveShowroomImageUrl,
  type ShowroomImageSource,
} from '@/lib/showroom/image-sources'
import styles from './ImageLightbox.module.css'

interface Photo {
  id?: string
  image_url: string
  image_source?: ShowroomImageSource
  caption: string | null
  option_name?: string
  option_href?: string
  option_breadcrumb?: string[]
}

interface ImageLightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onIndexChange: (index: number) => void
}

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => !element.hasAttribute('disabled'))
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
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const scrollPositionRef = useRef(0)
  const isNavigatingToOptionRef = useRef(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null)
  const [loadedPhotoKey, setLoadedPhotoKey] = useState<string | null>(null)

  const total = photos.length
  const currentPhotoKey = photos[currentIndex]?.id ?? String(currentIndex)
  const imgLoaded = loadedPhotoKey === currentPhotoKey

  useEffect(() => {
    if (!slideDirection) return
    const timer = setTimeout(() => setSlideDirection(null), 250)
    return () => clearTimeout(timer)
  }, [slideDirection])

  useEffect(() => {
    if (!isOpen) return
    const links: HTMLLinkElement[] = []

    const preload = (photo: Photo) => {
      const src = resolveShowroomImageUrl(photo.image_source ?? photo.image_url, 'large')
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'image'
      link.href = src
      document.head.appendChild(link)
      links.push(link)
    }

    if (currentIndex > 0) preload(photos[currentIndex - 1])
    if (currentIndex < total - 1) preload(photos[currentIndex + 1])

    return () => links.forEach(link => link.remove())
  }, [isOpen, currentIndex, photos, total])

  const goToPrev = useCallback(() => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true)
      setSlideDirection('right')
      onIndexChange(currentIndex - 1)
      setTimeout(() => setIsAnimating(false), 250)
    }
  }, [currentIndex, isAnimating, onIndexChange])

  const goToNext = useCallback(() => {
    if (currentIndex < total - 1 && !isAnimating) {
      setIsAnimating(true)
      setSlideDirection('left')
      onIndexChange(currentIndex + 1)
      setTimeout(() => setIsAnimating(false), 250)
    }
  }, [currentIndex, total, isAnimating, onIndexChange])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    scrollPositionRef.current = window.scrollY
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      if (!isNavigatingToOptionRef.current) {
        window.scrollTo(0, scrollPositionRef.current)
        window.requestAnimationFrame(() => previouslyFocusedRef.current?.focus({ preventScroll: true }))
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPrev()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNext()
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = focusableElements(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, goToPrev, goToNext])

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX
    touchEndX.current = event.touches[0].clientX
    setSwipeOffset(0)
  }

  const handleTouchMove = (event: React.TouchEvent) => {
    touchEndX.current = event.touches[0].clientX
    const difference = touchEndX.current - touchStartX.current
    const atStart = currentIndex === 0 && difference > 0
    const atEnd = currentIndex === total - 1 && difference < 0
    setSwipeOffset(atStart || atEnd ? difference * 0.3 : difference)
  }

  const handleTouchEnd = () => {
    const difference = touchEndX.current - touchStartX.current
    if (difference > 60) goToPrev()
    if (difference < -60) goToNext()
    setSwipeOffset(0)
  }

  if (!isOpen || photos.length === 0) return null

  const currentPhoto = photos[currentIndex]
  if (!currentPhoto) return null

  const slideClass = slideDirection === 'left'
    ? styles.slideFromRight
    : slideDirection === 'right'
      ? styles.slideFromLeft
      : ''
  const photoLabel = currentPhoto.option_name ?? currentPhoto.caption ?? `시공사진 ${currentIndex + 1}`
  const optionBreadcrumb = currentPhoto.option_breadcrumb?.filter(Boolean).join(' › ')

  return (
    <div
      className={styles.overlay}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${photoLabel} 크게 보기`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className={styles.closeButton}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          ref={closeButtonRef}
        >
          <X size={24} />
        </button>

        <div
          className={`${styles.imageContainer} ${slideClass}`}
          style={{
            transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
            transition: swipeOffset === 0 ? undefined : 'none',
          }}
        >
          <ShowroomImage
            key={currentPhotoKey}
            source={currentPhoto.image_source ?? currentPhoto.image_url}
            purpose="large"
            alt={photoLabel}
            fill
            sizes="100vw"
            className={`${styles.image} ${imgLoaded ? styles.imageLoaded : ''}`}
            onLoad={() => setLoadedPhotoKey(currentPhotoKey)}
          />
        </div>

        {currentIndex > 0 && (
          <button
            className={`${styles.navButton} ${styles.prevButton}`}
            type="button"
            onClick={goToPrev}
            aria-label="이전 사진"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {currentIndex < total - 1 && (
          <button
            className={`${styles.navButton} ${styles.nextButton}`}
            type="button"
            onClick={goToNext}
            aria-label="다음 사진"
          >
            <ChevronRight size={24} />
          </button>
        )}

        <div className={styles.bottomInfo}>
          <p className={styles.caption}>{photoLabel}</p>
          {optionBreadcrumb && (
            <p className={styles.optionBreadcrumb} title={optionBreadcrumb}>
              {optionBreadcrumb}
            </p>
          )}
          {currentPhoto.option_href && (
            <Link
              className={styles.optionLink}
              href={currentPhoto.option_href}
              scroll={false}
              onClick={event => {
                if (
                  event.button !== 0
                  || event.metaKey
                  || event.ctrlKey
                  || event.shiftKey
                  || event.altKey
                ) return

                isNavigatingToOptionRef.current = true
                requestShowroomScrollReset(currentPhoto.option_href!)
              }}
            >
              이 옵션 보기
            </Link>
          )}
          {total > 1 && (
            <span className={styles.counter}>
              {currentIndex + 1} / {total}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
