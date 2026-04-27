'use client'

import Image from 'next/image'
import { useState } from 'react'
import ScrollAnimationWrapper from './ScrollAnimationWrapper'
import ImageLightbox from './ImageLightbox'
import styles from './InstallationGallery.module.css'

interface Photo {
  image_url: string
  caption: string | null
  display_order: number
}

interface InstallationGalleryProps {
  photos: Photo[]
}

export default function InstallationGallery({ photos }: InstallationGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<Photo | null>(null)

  if (!photos || photos.length === 0) return null

  // 좌/우 열 분리 (홀수 index → 좌, 짝수 index → 우)
  const leftPhotos = photos.filter((_, i) => i % 2 === 0)
  const rightPhotos = photos.filter((_, i) => i % 2 === 1)

  const renderPhoto = (photo: Photo, index: number) => (
    <ScrollAnimationWrapper key={index} delay={index * 150}>
      <figure className={styles.figure}>
        <div className={styles.imageWrapper} onClick={() => setSelectedImage(photo)}>
          <Image
            src={photo.image_url}
            alt={photo.caption || `시공 사진 ${index + 1}`}
            fill
            className={styles.image}
            sizes="(max-width: 768px) 50vw, 400px"
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
          {rightPhotos.map((photo, idx) => renderPhoto(photo, idx * 2 + 1))}
        </div>
      </section>

      <ImageLightbox
        imageUrl={selectedImage?.image_url || ''}
        alt={selectedImage?.caption || '시공 사진 확대'}
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </>
  )
}
