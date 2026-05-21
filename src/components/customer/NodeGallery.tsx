'use client'

import Image from 'next/image'
import { useState } from 'react'
import { shouldBypassNextImageOptimization } from '@/lib/image'
import ScrollAnimationWrapper from './ScrollAnimationWrapper'
import ImageLightbox from './ImageLightbox'
import styles from './NodeGallery.module.css'

interface Photo {
  id: string
  image_url: string
  caption: string | null
}

interface NodeGalleryProps {
  photos: Photo[]
  nodeName: string
}

export default function NodeGallery({ photos, nodeName }: NodeGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [loadedSet, setLoadedSet] = useState<Set<number>>(new Set())

  const handleImageLoad = (index: number) => {
    setLoadedSet(prev => {
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }

  if (!photos || photos.length === 0) return null

  // 좌/우 열 분리 (홀수 index → 좌, 짝수 index → 우)
  const leftPhotos = photos.filter((_, i) => i % 2 === 0)
  const rightPhotos = photos.filter((_, i) => i % 2 === 1)

  const renderPhoto = (photo: Photo, index: number, extraDelay: number = 0) => (
    <ScrollAnimationWrapper key={photo.id} delay={index * 150 + extraDelay}>
      <figure className={styles.figure}>
        <div className={styles.imageWrapper} onClick={() => setSelectedIndex(index)}>
          <Image
            src={photo.image_url}
            alt={photo.caption || `${nodeName} 갤러리 사진 ${index + 1}`}
            fill
            className={`${styles.image} ${loadedSet.has(index) ? styles.imageLoaded : ''}`}
            sizes="(max-width: 768px) 50vw, 400px"
            unoptimized={shouldBypassNextImageOptimization(photo.image_url)}
            onLoad={() => handleImageLoad(index)}
          />
        </div>
        {photo.caption && (
          <figcaption className={styles.caption}>{photo.caption}</figcaption>
        )}
      </figure>
    </ScrollAnimationWrapper>
  )

  return (
    <>
      <section className={styles.gallery}>
        <div className={styles.column}>
          {leftPhotos.map((photo, idx) => renderPhoto(photo, idx * 2))}
        </div>
        <div className={`${styles.column} ${styles.columnRight}`}>
          {rightPhotos.map((photo, idx) => renderPhoto(photo, idx * 2 + 1, 100))}
        </div>
      </section>

      <ImageLightbox
        photos={photos.map(p => ({ image_url: p.image_url, caption: p.caption }))}
        currentIndex={selectedIndex}
        isOpen={selectedIndex >= 0}
        onClose={() => setSelectedIndex(-1)}
        onIndexChange={setSelectedIndex}
      />
    </>
  )
}
