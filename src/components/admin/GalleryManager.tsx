'use client'

import React from 'react'
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import ImageUploader from './ImageUploader'
import styles from './GalleryManager.module.css'

interface GalleryPhoto {
  id?: string
  image_url: string
  caption: string | null
  display_order: number
}

interface GalleryManagerProps {
  photos: GalleryPhoto[]
  onPhotosChange: (photos: GalleryPhoto[]) => void
  nodeSlug: string
}

export default function GalleryManager({ photos, onPhotosChange, nodeSlug }: GalleryManagerProps) {
  // 최신 photos 상태를 ref로 추적하여 onUploadReplace 비동기 콜백에서 Stale Closure 문제 방지
  const photosRef = React.useRef(photos)
  React.useEffect(() => {
    photosRef.current = photos
  }, [photos])

  const handlePhotoUpload = (url: string) => {
    onPhotosChange([
      ...photos,
      {
        image_url: url,
        caption: null,
        display_order: photos.length
      }
    ])
  }

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index).map((p, i) => ({ ...p, display_order: i }))
    onPhotosChange(newPhotos)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newPhotos = [...photos]
    const temp = newPhotos[index - 1]
    newPhotos[index - 1] = { ...newPhotos[index], display_order: index - 1 }
    newPhotos[index] = { ...temp, display_order: index }
    onPhotosChange(newPhotos)
  }

  const handleMoveDown = (index: number) => {
    if (index === photos.length - 1) return
    const newPhotos = [...photos]
    const temp = newPhotos[index + 1]
    newPhotos[index + 1] = { ...newPhotos[index], display_order: index + 1 }
    newPhotos[index] = { ...temp, display_order: index }
    onPhotosChange(newPhotos)
  }

  const handleCaptionChange = (index: number, caption: string) => {
    const newPhotos = [...photos]
    newPhotos[index].caption = caption || null
    onPhotosChange(newPhotos)
  }

  return (
    <div className={styles.container}>
      <div className={styles.photosGrid}>
        {photos.map((photo, index) => (
          <div key={index} className={styles.photoItem}>
            <ImageUploader
              folderPath={`photos/${nodeSlug || 'temp'}`}
              onUploadComplete={(url) => {
                const newPhotos = [...photos]
                newPhotos[index].image_url = url
                onPhotosChange(newPhotos)
              }}
              currentImageUrl={photo.image_url}
              onDelete={() => handleRemovePhoto(index)}
            />
            <input 
              type="text" 
              className={styles.input} 
              placeholder="사진 설명 (선택)" 
              value={photo.caption || ''}
              onChange={(e) => handleCaptionChange(index, e.target.value)}
            />
            <div className={styles.photoActions}>
              <div className={styles.orderActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  title="위로 이동"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => handleMoveDown(index)}
                  disabled={index === photos.length - 1}
                  title="아래로 이동"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.deleteBtn}`}
                onClick={() => handleRemovePhoto(index)}
                title="삭제"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        
        <div className={styles.addPhotoCard}>
          <ImageUploader
            folderPath={`photos/${nodeSlug || 'temp'}`}
            onUploadComplete={handlePhotoUpload}
            multiple={true}
            compressionMaxDimension={1000}
            compressionQuality={0.7}
            onMultiUploadComplete={(urls) => {
              onPhotosChange([
                ...photos,
                ...urls.map((url, i) => ({
                  image_url: url,
                  caption: null,
                  display_order: photos.length + i
                }))
              ])
            }}
            onUploadReplace={(oldUrl, newUrl) => {
              onPhotosChange(photosRef.current.map(p =>
                p.image_url === oldUrl ? { ...p, image_url: newUrl } : p
              ))
            }}
          />
        </div>
      </div>
    </div>
  )
}
