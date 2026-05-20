'use client'

import React, { useState } from 'react'
import { ArrowUp, ArrowDown, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import ImageUploader from './ImageUploader'
import styles from './HeroConfigurator.module.css'

export interface HeroMedia {
  id?: string
  image_url: string
  device_type: 'desktop' | 'mobile'
  media_type: 'image' | 'video'
  display_order: number
}

interface HeroConfiguratorProps {
  heroMedia: HeroMedia[]
  onHeroMediaChange: (media: HeroMedia[]) => void
  nodeSlug: string
  videoUrl?: string
  mobileVideoUrl?: string
  onVideoUrlChange?: (url: string) => void
  onMobileVideoUrlChange?: (url: string) => void
}

export default function HeroConfigurator({ 
  heroMedia, 
  onHeroMediaChange, 
  nodeSlug,
  videoUrl,
  mobileVideoUrl,
  onVideoUrlChange,
  onMobileVideoUrlChange
}: HeroConfiguratorProps) {
  const [openSections, setOpenSections] = useState({
    desktopImage: true,
    mobileImage: true,
    desktopVideo: true,
    mobileVideo: true
  })

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const desktopImages = heroMedia.filter(m => m.device_type === 'desktop' && m.media_type === 'image').sort((a, b) => a.display_order - b.display_order)
  const mobileImages = heroMedia.filter(m => m.device_type === 'mobile' && m.media_type === 'image').sort((a, b) => a.display_order - b.display_order)

  const updateMedia = (newDesktop: HeroMedia[], newMobile: HeroMedia[]) => {
    // Re-assign display_order
    const updatedDesktop = newDesktop.map((m, i) => ({ ...m, display_order: i }))
    const updatedMobile = newMobile.map((m, i) => ({ ...m, display_order: i }))
    onHeroMediaChange([...updatedDesktop, ...updatedMobile])
  }

  // Desktop Image Handlers
  const handleRemoveDesktop = (index: number) => {
    const newDesktop = desktopImages.filter((_, i) => i !== index)
    updateMedia(newDesktop, mobileImages)
  }

  const handleMoveUpDesktop = (index: number) => {
    if (index === 0) return
    const newDesktop = [...desktopImages]
    const temp = newDesktop[index - 1]
    newDesktop[index - 1] = newDesktop[index]
    newDesktop[index] = temp
    updateMedia(newDesktop, mobileImages)
  }

  const handleMoveDownDesktop = (index: number) => {
    if (index === desktopImages.length - 1) return
    const newDesktop = [...desktopImages]
    const temp = newDesktop[index + 1]
    newDesktop[index + 1] = newDesktop[index]
    newDesktop[index] = temp
    updateMedia(newDesktop, mobileImages)
  }

  // Mobile Image Handlers
  const handleRemoveMobile = (index: number) => {
    const newMobile = mobileImages.filter((_, i) => i !== index)
    updateMedia(desktopImages, newMobile)
  }

  const handleMoveUpMobile = (index: number) => {
    if (index === 0) return
    const newMobile = [...mobileImages]
    const temp = newMobile[index - 1]
    newMobile[index - 1] = newMobile[index]
    newMobile[index] = temp
    updateMedia(desktopImages, newMobile)
  }

  const handleMoveDownMobile = (index: number) => {
    if (index === mobileImages.length - 1) return
    const newMobile = [...mobileImages]
    const temp = newMobile[index + 1]
    newMobile[index + 1] = newMobile[index]
    newMobile[index] = temp
    updateMedia(desktopImages, newMobile)
  }

  return (
    <div className={styles.container}>
      {/* Desktop Image Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('desktopImage')}>
          <h3 className={styles.sectionTitle}>🖥️ 데스크탑 이미지</h3>
          {openSections.desktopImage ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        
        {openSections.desktopImage && (
          <div className={styles.sectionContent}>
            <div className={styles.photosList}>
              {desktopImages.map((media, index) => (
                <div key={`desktop-${index}`} className={styles.slideCard}>
                  <div className={styles.slideHeader}>
                    <h4 className={styles.slideTitle}>슬라이드 {index + 1}</h4>
                    <div className={styles.slideActions}>
                      <div className={styles.orderActions}>
                        <button type="button" className={styles.actionBtn} onClick={() => handleMoveUpDesktop(index)} disabled={index === 0} title="위로 이동">
                          <ArrowUp size={16} />
                        </button>
                        <button type="button" className={styles.actionBtn} onClick={() => handleMoveDownDesktop(index)} disabled={index === desktopImages.length - 1} title="아래로 이동">
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      <button type="button" className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleRemoveDesktop(index)} title="삭제">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.mediaBox}>
                    <p className={styles.mediaHint}>권장 1920×800</p>
                    <ImageUploader
                      folderPath={`hero/${nodeSlug || 'temp'}/desktop`}
                      onUploadComplete={(url) => {
                        const newDesktop = [...desktopImages]
                        newDesktop[index].image_url = url
                        updateMedia(newDesktop, mobileImages)
                      }}
                      currentImageUrl={media.image_url}
                      onDelete={() => {
                        const newDesktop = [...desktopImages]
                        newDesktop[index].image_url = ''
                        updateMedia(newDesktop, mobileImages)
                      }}
                      compressionMaxDimension={1920}
                      compressionQuality={0.8}
                    />
                  </div>
                </div>
              ))}
              
              <div className={styles.addPhotoSection}>
                <p className={styles.addHint}>여러 장의 데스크탑 이미지를 한 번에 추가할 수 있습니다.</p>
                <ImageUploader
                  folderPath={`hero/${nodeSlug || 'temp'}/desktop`}
                  onUploadComplete={(url) => {
                    updateMedia([...desktopImages, { image_url: url, device_type: 'desktop', media_type: 'image', display_order: desktopImages.length }], mobileImages)
                  }}
                  multiple={true}
                  compressionMaxDimension={1920}
                  compressionQuality={0.8}
                  onMultiUploadComplete={(urls) => {
                    const newItems: HeroMedia[] = urls.map((url, i) => ({
                      image_url: url,
                      device_type: 'desktop',
                      media_type: 'image',
                      display_order: desktopImages.length + i
                    }))
                    updateMedia([...desktopImages, ...newItems], mobileImages)
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Image Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('mobileImage')}>
          <h3 className={styles.sectionTitle}>📱 모바일 이미지</h3>
          {openSections.mobileImage ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        
        {openSections.mobileImage && (
          <div className={styles.sectionContent}>
            <div className={styles.photosList}>
              {mobileImages.map((media, index) => (
                <div key={`mobile-${index}`} className={styles.slideCard}>
                  <div className={styles.slideHeader}>
                    <h4 className={styles.slideTitle}>슬라이드 {index + 1}</h4>
                    <div className={styles.slideActions}>
                      <div className={styles.orderActions}>
                        <button type="button" className={styles.actionBtn} onClick={() => handleMoveUpMobile(index)} disabled={index === 0} title="위로 이동">
                          <ArrowUp size={16} />
                        </button>
                        <button type="button" className={styles.actionBtn} onClick={() => handleMoveDownMobile(index)} disabled={index === mobileImages.length - 1} title="아래로 이동">
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      <button type="button" className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleRemoveMobile(index)} title="삭제">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className={styles.mediaBox}>
                    <p className={styles.mediaHint}>권장 750×1000</p>
                    <ImageUploader
                      folderPath={`hero/${nodeSlug || 'temp'}/mobile`}
                      onUploadComplete={(url) => {
                        const newMobile = [...mobileImages]
                        newMobile[index].image_url = url
                        updateMedia(desktopImages, newMobile)
                      }}
                      currentImageUrl={media.image_url}
                      onDelete={() => {
                        const newMobile = [...mobileImages]
                        newMobile[index].image_url = ''
                        updateMedia(desktopImages, newMobile)
                      }}
                      compressionMaxDimension={1200}
                      compressionQuality={0.8}
                    />
                  </div>
                </div>
              ))}
              
              <div className={styles.addPhotoSection}>
                <p className={styles.addHint}>여러 장의 모바일 이미지를 한 번에 추가할 수 있습니다.</p>
                <ImageUploader
                  folderPath={`hero/${nodeSlug || 'temp'}/mobile`}
                  onUploadComplete={(url) => {
                    updateMedia(desktopImages, [...mobileImages, { image_url: url, device_type: 'mobile', media_type: 'image', display_order: mobileImages.length }])
                  }}
                  multiple={true}
                  compressionMaxDimension={1200}
                  compressionQuality={0.8}
                  onMultiUploadComplete={(urls) => {
                    const newItems: HeroMedia[] = urls.map((url, i) => ({
                      image_url: url,
                      device_type: 'mobile',
                      media_type: 'image',
                      display_order: mobileImages.length + i
                    }))
                    updateMedia(desktopImages, [...mobileImages, ...newItems])
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Video Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('desktopVideo')}>
          <h3 className={styles.sectionTitle}>🎬 데스크탑 영상</h3>
          {openSections.desktopVideo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        
        {openSections.desktopVideo && (
          <div className={styles.sectionContent}>
            <div className={styles.videoBox}>
              <p className={styles.mediaHint}>권장 1920×1080 (비메오, 유튜브 등 스트리밍 URL 또는 MP4 URL 직접 입력)</p>
              <input
                type="text"
                className={styles.videoInput}
                placeholder="https://... (.mp4 또는 유튜브/비메오 URL)"
                value={videoUrl || ''}
                onChange={(e) => onVideoUrlChange?.(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Video Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader} onClick={() => toggleSection('mobileVideo')}>
          <h3 className={styles.sectionTitle}>📱 모바일 영상</h3>
          {openSections.mobileVideo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        
        {openSections.mobileVideo && (
          <div className={styles.sectionContent}>
            <div className={styles.videoBox}>
              <p className={styles.mediaHint}>권장 1080×1920 (비메오, 유튜브 등 스트리밍 URL 또는 MP4 URL 직접 입력)</p>
              <input
                type="text"
                className={styles.videoInput}
                placeholder="https://... (.mp4 또는 유튜브/비메오 URL)"
                value={mobileVideoUrl || ''}
                onChange={(e) => onMobileVideoUrlChange?.(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
