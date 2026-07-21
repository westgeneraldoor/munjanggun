'use client'

import React, { useState } from 'react'
import { logError } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ImageUploader from './ImageUploader'
import HeroConfigurator from './HeroConfigurator'
import {
  PlatformButton,
  PlatformField,
  PlatformPanel,
  PlatformSelect,
  PlatformStatePanel,
  PlatformSwitch,
} from '@/components/platform/ui'
import styles from './SiteSettingsForm.module.css'
import { useUploadPendingTracker } from './useUploadPendingTracker'

type SiteSettingsRpcClient = {
  rpc(
    name: 'save_site_settings',
    args: { p_settings: Record<string, unknown>; p_media: Array<Record<string, unknown>> },
  ): PromiseLike<{ error: { message: string } | null }>
}

const CARD_POSITION_OPTIONS = [
  { value: 'overlay', label: '이미지 위 (오버레이)' },
  { value: 'below', label: '이미지 아래' },
] as const

const HERO_TRANSITION_OPTIONS = [
  { value: 'fade', label: 'fade (페이드)' },
  { value: 'slide', label: 'slide (슬라이드)' },
] as const

interface SiteSettingsData {
  id?: string
  site_title: string | null
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
  const { hasPendingUploads, onUploadStateChange } = useUploadPendingTracker()

  const updateField = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setSuccess(false)
    setter(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasPendingUploads) {
      setError('이미지가 아직 업로드 중입니다. 완료 후 다시 시도해 주세요.')
      return
    }
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
      const showroomDb = supabase.schema('showroom') as unknown as SiteSettingsRpcClient
      const { error: saveError } = await showroomDb.rpc('save_site_settings', {
        p_settings: {
          site_title: title || null,
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
        },
        p_media: heroMedia.map((media) => ({
          image_url: media.image_url,
          device_type: media.device_type,
          media_type: media.media_type,
        })),
      })

      if (saveError) throw new Error(saveError.message)

      setSuccess(true)
      router.refresh()
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
      {error ? <PlatformStatePanel tone="error" title="설정을 저장하지 못했습니다" description={error} /> : null}
      {success ? <PlatformStatePanel tone="success" title="설정을 저장했습니다" description="변경한 쇼룸 설정이 반영되었습니다." /> : null}

      <fieldset className={styles.fieldset} disabled={isLoading || hasPendingUploads}>
        <div className={styles.sections}>
          <PlatformPanel as="section" className={styles.section}>
            <div className={styles.sectionCopy}>
              <h2>기본 정보</h2>
              <p>검색 결과와 외부 공유에 사용되는 쇼룸 정보를 설정합니다.</p>
            </div>

            <PlatformField
              id="title"
              label="사이트 제목"
              required
              value={title}
              onChange={(event) => updateField(setTitle, event.target.value)}
              placeholder="예: 문장군 디지털 컬러북"
              maxLength={160}
            />

            <PlatformField
              id="description"
              label="사이트 설명 (SEO)"
              multiline
              value={description}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateField(setDescription, event.target.value)}
              placeholder="검색 결과에 표시될 사이트 설명을 입력하세요."
              rows={3}
              maxLength={5000}
            />

            <PlatformSelect
              id="cardTextPosition"
              label="메인 페이지 카드 표시 방식"
              options={CARD_POSITION_OPTIONS}
              value={cardTextPosition}
              onChange={(event) => updateField(setCardTextPosition, event.target.value as 'overlay' | 'below')}
            />

            <div className={styles.mediaField}>
              <div className={styles.mediaLabel}>대표 이미지 (OG Image)</div>
              <p>카카오톡 공유 등 링크 전송 시 표시될 이미지입니다. 권장 비율은 1200:630입니다.</p>
              <ImageUploader
                folderPath="og"
                onUploadComplete={(url) => updateField<string | null>(setOgImageUrl, url)}
                currentImageUrl={ogImageUrl || undefined}
                onDelete={() => updateField<string | null>(setOgImageUrl, null)}
                onUploadStateChange={onUploadStateChange}
                disabled={isLoading || hasPendingUploads}
              />
            </div>

            <PlatformField
              id="reservationUrl"
              type="url"
              label="예약 상담 URL"
              value={reservationUrl}
              onChange={(event) => updateField(setReservationUrl, event.target.value)}
              placeholder="예: https://booking.naver.com/..."
              maxLength={2048}
            />

            <PlatformField
              id="storeUrl"
              type="url"
              label="스토어 URL"
              value={storeUrl}
              onChange={(event) => updateField(setStoreUrl, event.target.value)}
              placeholder="예: https://smartstore.naver.com/..."
              maxLength={2048}
            />
          </PlatformPanel>

          <PlatformPanel as="section" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionCopy}>
                <h2>메인 히어로 설정</h2>
                <p>메인 페이지 상단에 표시될 히어로 영역입니다.</p>
              </div>
              <PlatformSwitch
                checked={heroEnabled}
                onCheckedChange={(checked) => updateField(setHeroEnabled, checked)}
                label="히어로 사용"
                disabled={isLoading || hasPendingUploads}
              />
            </div>

            {heroEnabled ? (
              <>
                <div className={styles.mediaField}>
                  <div className={styles.mediaLabel}>히어로 이미지/비디오 슬라이드</div>
                  <HeroConfigurator
                    heroMedia={heroMedia}
                    onHeroMediaChange={(media) => updateField(setHeroMedia, media)}
                    nodeSlug="site_main"
                    videoUrl={heroVideoUrl}
                    mobileVideoUrl={heroMobileVideoUrl}
                    onVideoUrlChange={(url) => updateField(setHeroVideoUrl, url)}
                    onMobileVideoUrlChange={(url) => updateField(setHeroMobileVideoUrl, url)}
                    onUploadStateChange={onUploadStateChange}
                    disabled={isLoading || hasPendingUploads}
                  />
                </div>

                <PlatformField
                  id="heroSlideInterval"
                  type="number"
                  min={1}
                  max={60}
                  label="슬라이드 전환 시간 (초)"
                  value={heroSlideInterval}
                  onChange={(event) => updateField(setHeroSlideInterval, Number.parseInt(event.target.value, 10) || 5)}
                />

                <PlatformSelect
                  id="heroSlideTransition"
                  label="슬라이드 전환 효과"
                  options={HERO_TRANSITION_OPTIONS}
                  value={heroSlideTransition}
                  onChange={(event) => updateField(setHeroSlideTransition, event.target.value as 'fade' | 'slide')}
                />

                <PlatformField
                  id="heroTitle"
                  label="히어로 제목"
                  value={heroTitle}
                  onChange={(event) => updateField(setHeroTitle, event.target.value)}
                  disabled={!!hasVideo}
                  hint={hasVideo ? '영상이 등록되면 히어로 문구는 표시되지 않습니다.' : undefined}
                  placeholder="메인 히어로 제목"
                  maxLength={300}
                />

                <PlatformField
                  id="heroSubtitle"
                  label="히어로 부제"
                  value={heroSubtitle}
                  onChange={(event) => updateField(setHeroSubtitle, event.target.value)}
                  disabled={!!hasVideo}
                  placeholder="메인 히어로 서브 제목"
                  maxLength={500}
                />

                <PlatformField
                  id="heroDescription"
                  label="히어로 설명"
                  multiline
                  value={heroDescription}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateField(setHeroDescription, event.target.value)}
                  disabled={!!hasVideo}
                  placeholder="메인 히어로 상세 설명"
                  rows={3}
                  maxLength={5000}
                />
              </>
            ) : null}
          </PlatformPanel>
        </div>

        <div className={styles.actions}>
          <PlatformButton type="submit" isLoading={isLoading} loadingLabel="저장 중…" disabled={isLoading || hasPendingUploads}>
            설정 저장
          </PlatformButton>
        </div>
      </fieldset>
    </form>
  )
}
