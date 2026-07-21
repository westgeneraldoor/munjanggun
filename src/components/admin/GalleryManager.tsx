'use client'

import React from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { PlatformField, PlatformIconButton } from '@/components/platform/ui'
import ImageUploader from './ImageUploader'
import styles from './GalleryManager.module.css'
import type { UploadStateChange } from './useUploadPendingTracker'

export interface GalleryPhoto {
  id?: string
  image_url: string
  caption: string | null
  display_order: number
}

interface GalleryManagerProps {
  photos: GalleryPhoto[]
  onPhotosChange: React.Dispatch<React.SetStateAction<GalleryPhoto[]>>
  nodeSlug: string
  onUploadStateChange?: UploadStateChange
  disabled?: boolean
}

export default function GalleryManager({ photos, onPhotosChange, nodeSlug, onUploadStateChange, disabled = false }: GalleryManagerProps) {
  const normalizeOrder = (items: GalleryPhoto[]) => items.map((photo, index) => ({ ...photo, display_order: index }))
  const handlePhotoUpload = (url: string) => {
    onPhotosChange(previous => [...previous, { image_url: url, caption: null, display_order: previous.length }])
  }
  const handleRemovePhoto = (index: number) => {
    onPhotosChange(previous => normalizeOrder(previous.filter((_, itemIndex) => itemIndex !== index)))
  }
  const handleMove = (index: number, direction: -1 | 1) => {
    onPhotosChange(previous => {
      const target = index + direction
      if (target < 0 || target >= previous.length) return previous
      const next = [...previous]
      ;[next[index], next[target]] = [next[target], next[index]]
      return normalizeOrder(next)
    })
  }
  const handleCaptionChange = (index: number, caption: string) => {
    onPhotosChange(previous => previous.map((photo, itemIndex) => itemIndex === index ? { ...photo, caption: caption || null } : photo))
  }

  return (
    <div className={styles.container}>
      <div className={styles.photosGrid}>
        {photos.map((photo, index) => (
          <article key={photo.id ?? `${photo.image_url}-${index}`} className={styles.photoItem}>
            <ImageUploader
              folderPath={`photos/${nodeSlug || 'temp'}`}
              onUploadComplete={url => {
                onPhotosChange(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, image_url: url } : item))
              }}
              currentImageUrl={photo.image_url}
              onDelete={() => handleRemovePhoto(index)}
              onUploadStateChange={onUploadStateChange}
              disabled={disabled}
            />
            <PlatformField
              label={`사진 ${index + 1} 설명 (선택)`}
              value={photo.caption || ''}
              placeholder="사진 설명"
              onChange={event => handleCaptionChange(index, event.target.value)}
            />
            <div className={styles.photoActions}>
              <div className={styles.orderActions}>
                <PlatformIconButton type="button" variant="secondary" onClick={() => handleMove(index, -1)} disabled={disabled || index === 0} aria-label={`사진 ${index + 1} 위로 이동`}>
                  <ArrowUp size={18} aria-hidden="true" />
                </PlatformIconButton>
                <PlatformIconButton type="button" variant="secondary" onClick={() => handleMove(index, 1)} disabled={disabled || index === photos.length - 1} aria-label={`사진 ${index + 1} 아래로 이동`}>
                  <ArrowDown size={18} aria-hidden="true" />
                </PlatformIconButton>
              </div>
              <PlatformIconButton type="button" variant="danger" onClick={() => handleRemovePhoto(index)} disabled={disabled} aria-label={`사진 ${index + 1} 삭제`}>
                <Trash2 size={18} aria-hidden="true" />
              </PlatformIconButton>
            </div>
          </article>
        ))}
        <div className={styles.addPhotoCard}>
          <ImageUploader
            folderPath={`photos/${nodeSlug || 'temp'}`}
            onUploadComplete={handlePhotoUpload}
            multiple
            compressionMaxDimension={1000}
            compressionQuality={0.7}
            onMultiUploadComplete={urls => {
              onPhotosChange(previous => [
                ...previous,
                ...urls.map((url, index) => ({ image_url: url, caption: null, display_order: previous.length + index })),
              ])
            }}
            onUploadReplace={(oldUrl, newUrl) => {
              onPhotosChange(previous => previous.map(photo => photo.image_url === oldUrl ? { ...photo, image_url: newUrl } : photo))
            }}
            onUploadStateChange={onUploadStateChange}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
