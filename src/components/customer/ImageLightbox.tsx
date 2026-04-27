'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import { useEffect } from 'react'
import styles from './ImageLightbox.module.css'

interface ImageLightboxProps {
  imageUrl: string
  alt: string
  isOpen: boolean
  onClose: () => void
}

export default function ImageLightbox({ imageUrl, alt, isOpen, onClose }: ImageLightboxProps) {
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

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
        <X size={24} />
      </button>
      <Image
        src={imageUrl}
        alt={alt}
        fill
        quality={85}
        sizes="100vw"
        className={styles.image}
      />
    </div>
  )
}
