'use client'

import React, { useState } from 'react'
import { logError } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ImageUploader from './ImageUploader'
import HeroConfigurator from './HeroConfigurator'
import styles from './SiteSettingsForm.module.css'

interface SiteSettingsData {
  id?: string
  site_title: string
  site_description: string | null
  og_image_url: string | null
  reservation_url: string | null
  store_url: string | null
  hero_enabled: boolean
  hero_video_url: string | null
  hero_mobile_video_url: string | null
  hero_title: string | null
  hero_subtitle: string | null
  hero_description: string | null
  hero_slide_interval: number
  hero_slide_transition?: string | null
  card_text_position?: string | null
}

interface HeroMediaData {
  id?: string
  image_url: string
  device_type: string
  media_type: string
  display_order: number
}

interface SiteSettingsFormProps {
  initialData: SiteSettingsData | null
  heroMedia: HeroMediaData[]
}

export default function SiteSettingsForm({ initialData, heroMedia: initialHeroMedia }: SiteSettingsFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [title, setTitle] = useState(initialData?.site_title || '')
  const [description, setDescription] = useState(initialData?.site_description || '')
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(initialData?.og_image_url || null)
  const [reservationUrl, setReservationUrl] = useState(initialData?.reservation_url || '')
  const [storeUrl, setStoreUrl] = useState(initialData?.store_url || '')
  const [cardTextPosition, setCardTextPosition] = useState<'overlay' | 'below'>(
    (initialData?.card_text_position as 'overlay' | 'below') || 'overlay'
  )
  
  // Hero settings
  const [heroEnabled, setHeroEnabled] = useState(initialData?.hero_enabled ?? false)
  const [heroVideoUrl, setHeroVideoUrl] = useState(initialData?.hero_video_url || '')
  const [heroMobileVideoUrl, setHeroMobileVideoUrl] = useState(initialData?.hero_mobile_video_url || '')
  const [heroTitle, setHeroTitle] = useState(initialData?.hero_title || '')
  const [heroSubtitle, setHeroSubtitle] = useState(initialData?.hero_subtitle || '')
  const [heroDescription, setHeroDescription] = useState(initialData?.hero_description || '')
  const [heroSlideInterval, setHeroSlideInterval] = useState(initialData?.hero_slide_interval ?? 5)
  const [heroSlideTransition, setHeroSlideTransition] = useState<'fade' | 'slide'>(
    (initialData?.hero_slide_transition as 'fade' | 'slide') || 'fade'
  )
  
  const [heroMedia, setHeroMedia] = useState<{ id?: string; image_url: string; device_type: 'desktop' | 'mobile'; media_type: 'image' | 'video'; display_order: number }[]>(
    [...initialHeroMedia].map(m => ({
      id: m.id,
      image_url: m.image_url,
      device_type: m.device_type as 'desktop' | 'mobile',
      media_type: m.media_type as 'image' | 'video',
      display_order: m.display_order
    })).sort((a, b) => a.display_order - b.display_order)
  )

  const hasVideo = heroVideoUrl || heroMobileVideoUrl

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    
    // Check pending uploads
    const pendingHero = heroMedia.filter(p => p.image_url.startsWith('blob:'))
    if (pendingHero.length > 0) {
      setError('이미지가 아직 업로드 중입니다. 완료 후 다시 시도해주세요.')
      setIsLoading(false)
      return
    }

    try {
      const showroomDb = supabase.schema('showroom')
      const siteTitle = title.trim() || '문장군 디지털 쇼룸'

      const { error: upsertError } = await showroomDb
        .from('site_settings')
        .upsert({
          id: 'singleton',
          site_title: siteTitle,
          site_description: description || null,
          og_image_url: ogImageUrl,
          reservation_url: reservationUrl || null,
          store_url: storeUrl || null,
          hero_enabled: heroEnabled,
          hero_video_url: heroVideoUrl || null,
          hero_mobile_video_url: heroMobileVideoUrl || null,
          hero_title: heroTitle || null,
          hero_subtitle: heroSubtitle || null,
          hero_description: heroDescription || null,
          hero_slide_interval: heroSlideInterval,
          hero_slide_transition: heroSlideTransition,
          card_text_position: cardTextPosition,
          updated_at: new Date().toISOString()
        })
        
      if (upsertError) throw upsertError
      
      // Update site_hero_media
      await showroomDb
        .from('site_hero_media')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // delete all hack (assuming id is valid UUID) - actually, .neq on uuid requires a valid uuid string or just true. A better way to delete all is .neq('id', '00000000-0000-0000-0000-000000000000') but let's just delete by looking for display_order >= 0
        // Wait, .gte('display_order', 0) is safer.
      await showroomDb
        .from('site_hero_media')
        .delete()
        .gte('display_order', 0)
      
      if (heroMedia.length > 0) {
        const { error: heroError } = await showroomDb
          .from('site_hero_media')
          .insert(
            heroMedia.map((m, index) => ({
              image_url: m.image_url,
              device_type: m.device_type,
              media_type: m.media_type,
              display_order: index
            }))
          )
        if (heroError) throw heroError
      }

      setSuccess(true)
      router.refresh()
      
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      logError('Save error:', err)
      const message = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>설정이 성공적으로 저장되었습니다.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ padding: 'var(--space-5)', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', marginBottom: 'var(--space-4)' }}>기본 정보</h2>
          
          <div className={styles.inputGroup}>
            <label htmlFor="title" className={styles.label}>사이트 제목</label>
            <input
              id="title"
              type="text"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              placeholder="예: 문장군 디지털 컬러북"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="description" className={styles.label}>사이트 설명 (SEO)</label>
            <textarea
              id="description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              placeholder="검색 결과에 표시될 사이트 설명을 입력하세요."
              rows={3}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="cardTextPosition" className={styles.label}>메인 페이지 카드 표시 방식</label>
            <select
              id="cardTextPosition"
              className={styles.select}
              value={cardTextPosition}
              onChange={(e) => setCardTextPosition(e.target.value as 'overlay' | 'below')}
              disabled={isLoading}
            >
              <option value="overlay">이미지 위 (오버레이)</option>
              <option value="below">이미지 아래</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>대표 이미지 (OG Image)</label>
            <p className={styles.helpText}>링크 공유 시 표시될 대표 이미지입니다. (권장 비율 1200x630)</p>
            <div style={{ marginTop: '8px' }}>
              <ImageUploader
                folderPath="og"
                onUploadComplete={(url) => setOgImageUrl(url)}
                currentImageUrl={ogImageUrl || undefined}
                onDelete={() => setOgImageUrl(null)}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="reservationUrl" className={styles.label}>예약 상담 URL</label>
            <input
              id="reservationUrl"
              type="url"
              className={styles.input}
              value={reservationUrl}
              onChange={(e) => setReservationUrl(e.target.value)}
              disabled={isLoading}
              placeholder="예: https://booking.naver.com/..."
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="storeUrl" className={styles.label}>스토어 URL</label>
            <input
              id="storeUrl"
              type="url"
              className={styles.input}
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              disabled={isLoading}
              placeholder="예: https://smartstore.naver.com/..."
            />
          </div>
        </div>

        <div style={{ padding: 'var(--space-5)', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold' }}>메인 히어로 설정</h2>
              <p style={{ color: 'var(--admin-text-sub)', fontSize: 'var(--text-sm)' }}>메인 페이지 상단에 표시될 히어로 영역입니다.</p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', color: 'var(--admin-text)' }}>사용</span>
              <div 
                style={{ 
                  width: '44px', height: '24px', background: heroEnabled ? 'var(--admin-primary)' : 'var(--admin-border)', 
                  borderRadius: '12px', position: 'relative', transition: 'background-color 0.2s'
                }}
                onClick={() => {
                  setHeroEnabled(!heroEnabled)
                }}
              >
                <div style={{ 
                  position: 'absolute', top: '2px', left: heroEnabled ? '22px' : '2px', 
                  width: '20px', height: '20px', background: 'white', borderRadius: '50%', 
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }} />
              </div>
            </label>
          </div>

          {heroEnabled && (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.label}>히어로 이미지/비디오 슬라이드</label>
                <HeroConfigurator
                  heroMedia={heroMedia}
                  onHeroMediaChange={setHeroMedia}
                  nodeSlug="site_main"
                  videoUrl={heroVideoUrl}
                  mobileVideoUrl={heroMobileVideoUrl}
                  onVideoUrlChange={setHeroVideoUrl}
                  onMobileVideoUrlChange={setHeroMobileVideoUrl}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="heroSlideInterval" className={styles.label}>슬라이드 전환 시간 (초)</label>
                <input
                  id="heroSlideInterval"
                  type="number"
                  min="1"
                  max="60"
                  className={styles.input}
                  value={heroSlideInterval}
                  onChange={(e) => setHeroSlideInterval(parseInt(e.target.value) || 5)}
                  disabled={isLoading}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="heroSlideTransition" className={styles.label}>슬라이드 전환 효과</label>
                <select
                  id="heroSlideTransition"
                  className={styles.select}
                  value={heroSlideTransition}
                  onChange={(e) => setHeroSlideTransition(e.target.value as 'fade' | 'slide')}
                  disabled={isLoading}
                >
                  <option value="fade">fade (페이드)</option>
                  <option value="slide">slide (슬라이드)</option>
                </select>
              </div>

              {/* Video inputs moved to HeroConfigurator */}

              <div className={styles.inputGroup}>
                <label htmlFor="heroTitle" className={styles.label}>히어로 제목</label>
                <input
                  id="heroTitle"
                  type="text"
                  className={styles.input}
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  disabled={isLoading || !!hasVideo}
                  placeholder="메인 히어로 제목"
                />
                {hasVideo && <p className={styles.helpText} style={{ color: 'var(--admin-text-sub)', fontSize: 'var(--text-xs)', marginTop: '4px' }}>영상이 등록되면 히어로 문구는 표시되지 않습니다.</p>}
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="heroSubtitle" className={styles.label}>히어로 부제</label>
                <input
                  id="heroSubtitle"
                  type="text"
                  className={styles.input}
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  disabled={isLoading || !!hasVideo}
                  placeholder="메인 히어로 서브 제목"
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="heroDescription" className={styles.label}>히어로 설명</label>
                <textarea
                  id="heroDescription"
                  className={styles.textarea}
                  value={heroDescription}
                  onChange={(e) => setHeroDescription(e.target.value)}
                  disabled={isLoading || !!hasVideo}
                  placeholder="메인 히어로 상세 설명"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={isLoading}
        >
          {isLoading ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </form>
  )
}
