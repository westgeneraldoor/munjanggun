'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react'
import { logError } from '@/lib/logger'
import { generateSlug, validateSlug } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type {
  ShowroomImageSource,
  ShowroomImageSourceMap,
} from '@/lib/showroom/image-sources'
import {
  PlatformButton,
  PlatformField,
  PlatformPanel,
  PlatformSelect,
  PlatformStatePanel,
  PlatformSwitch,
} from '@/components/platform/ui'
import ImageUploader from './ImageUploader'
import HeroConfigurator, { type HeroMedia } from './HeroConfigurator'
import GalleryManager, { type GalleryPhoto } from './GalleryManager'
import styles from './NodeForm.module.css'
import { useUploadPendingTracker } from './useUploadPendingTracker'

type NodeRow = Database['showroom']['Tables']['nodes']['Row']
type HeroMediaRow = Database['showroom']['Tables']['hero_media']['Row']
type GalleryPhotoRow = Database['showroom']['Tables']['gallery_photos']['Row']

type NodeRpcClient = {
  rpc(
    name: 'save_node',
    args: {
      p_node_id: string
      p_node: Record<string, unknown>
      p_hero_media: Array<Record<string, unknown>>
      p_gallery_photos: Array<Record<string, unknown>>
    },
  ): PromiseLike<{ error: { message: string } | null }>
}

interface NodeFormProps {
  node: NodeRow
  heroMedia: HeroMediaRow[]
  galleryPhotos: GalleryPhotoRow[]
  childCount: number
  initialImageSources: ShowroomImageSourceMap
}

const CARD_POSITION_OPTIONS = [
  { value: 'overlay', label: '이미지 위 (오버레이)' },
  { value: 'below', label: '이미지 아래' },
] as const

const STATUS_OPTIONS = [
  { value: 'draft', label: '초안 (숨김)' },
  { value: 'published', label: '공개' },
] as const

const TRANSITION_OPTIONS = [
  { value: 'fade', label: 'fade (페이드)' },
  { value: 'slide', label: 'slide (슬라이드)' },
] as const

export default function NodeForm({
  node,
  heroMedia: initialHeroMedia,
  galleryPhotos: initialGalleryPhotos,
  childCount,
  initialImageSources,
}: NodeFormProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [name, setName] = useState(node.name)
  const [slug, setSlug] = useState(node.slug)
  const [cardSubtitle, setCardSubtitle] = useState(node.card_subtitle || '')
  const [cardTextPosition, setCardTextPosition] = useState<'overlay' | 'below'>((node.card_text_position as 'overlay' | 'below') || 'overlay')
  const [status, setStatus] = useState<'draft' | 'published'>(node.status as 'draft' | 'published')
  const [type, setType] = useState<'listing' | 'detail'>(node.type as 'listing' | 'detail')
  const [imageUrl, setImageUrl] = useState<string | null>(node.image_url)
  const [imageSources, setImageSources] = useState(initialImageSources)
  const [heroEnabled, setHeroEnabled] = useState(node.hero_enabled)
  const [heroVideoUrl, setHeroVideoUrl] = useState(node.hero_video_url || '')
  const [heroMobileVideoUrl, setHeroMobileVideoUrl] = useState(node.hero_mobile_video_url || '')
  const [heroTitle, setHeroTitle] = useState(node.hero_title || '')
  const [heroSubtitle, setHeroSubtitle] = useState(node.hero_subtitle || '')
  const [heroDescription, setHeroDescription] = useState(node.hero_description || '')
  const [heroSlideInterval, setHeroSlideInterval] = useState(node.hero_slide_interval ?? 5)
  const [heroSlideTransition, setHeroSlideTransition] = useState<'fade' | 'slide'>((node.hero_slide_transition as 'fade' | 'slide') || 'fade')
  const [heroMedia, setHeroMedia] = useState<HeroMedia[]>(
    [...initialHeroMedia]
      .map(media => ({
        id: media.id,
        image_url: media.image_url,
        device_type: media.device_type as 'desktop' | 'mobile',
        media_type: media.media_type as 'image' | 'video',
        display_order: media.display_order,
      }))
      .sort((a, b) => a.display_order - b.display_order),
  )
  const [tagline, setTagline] = useState(node.tagline || '')
  const [description, setDescription] = useState(node.description || '')
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>(
    [...initialGalleryPhotos]
      .map(photo => ({
        id: photo.id,
        image_url: photo.image_url,
        caption: photo.caption,
        display_order: photo.display_order,
      }))
      .sort((a, b) => a.display_order - b.display_order),
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [autoSlug, setAutoSlug] = useState(false)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null)
  const [previewActionError, setPreviewActionError] = useState<string | null>(null)
  const [isGeneratingToken, setIsGeneratingToken] = useState(false)
  const [copied, setCopied] = useState(false)
  const { hasPendingUploads, onUploadStateChange } = useUploadPendingTracker()
  const slugValidation = validateSlug(slug)
  const hasVideo = Boolean(heroVideoUrl || heroMobileVideoUrl)

  const clearSaveFeedback = useCallback(() => {
    setSuccess(false)
    setError(null)
  }, [])

  const handleHeroMediaChange = useCallback((media: HeroMedia[]) => {
    clearSaveFeedback()
    setHeroMedia(media)
  }, [clearSaveFeedback])

  const handleGalleryPhotosChange = useCallback<React.Dispatch<React.SetStateAction<GalleryPhoto[]>>>((update) => {
    clearSaveFeedback()
    setGalleryPhotos(previous => typeof update === 'function' ? update(previous) : update)
  }, [clearSaveFeedback])

  const handleImageSourceReady = useCallback((source: ShowroomImageSource) => {
    setImageSources(previous => ({ ...previous, [source.originalUrl]: source }))
  }, [])

  useEffect(() => {
    let active = true
    const fetchToken = async () => {
      const { data, error: tokenError } = await supabase
        .schema('showroom')
        .from('preview_tokens')
        .select('token')
        .eq('node_id', node.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return
      if (tokenError) {
        logError('Failed to load preview token', tokenError)
        setPreviewLoadError('기존 미리보기 링크를 확인하지 못했습니다. 노드 저장은 계속할 수 있습니다.')
        return
      }
      setPreviewToken(data?.token ?? null)
    }

    void fetchToken()
    return () => { active = false }
  }, [node.id, supabase])

  const handleGeneratePreview = async () => {
    setIsGeneratingToken(true)
    setPreviewActionError(null)
    try {
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 72)
      const { error: tokenError } = await supabase
        .schema('showroom')
        .from('preview_tokens')
        .insert({ token, node_id: node.id, expires_at: expiresAt.toISOString() })

      if (tokenError) throw new Error(tokenError.message)
      setPreviewToken(token)
    } catch (err) {
      logError('Failed to generate preview token', err)
      setPreviewActionError('미리보기 링크를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsGeneratingToken(false)
    }
  }

  const handleCopyPreview = async () => {
    if (!previewToken) return
    setPreviewActionError(null)
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/preview/${previewToken}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logError('Failed to copy preview URL', err)
      setPreviewActionError('미리보기 주소를 복사하지 못했습니다.')
    }
  }

  const handleTypeSwitch = () => {
    clearSaveFeedback()
    if (type === 'listing') {
      if (childCount > 0) {
        setError(`하위 ${childCount}개 항목이 있어 변경할 수 없습니다.`)
        return
      }
      setType('detail')
      return
    }

    if ((tagline || description) && !window.confirm('타입 전환 시 기존 태그라인과 상세 설명은 표시되지 않습니다. 계속하시겠습니까?')) {
      return
    }
    setType('listing')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (hasPendingUploads) {
      setError('이미지가 아직 업로드 중입니다. 완료 후 다시 시도해 주세요.')
      return
    }
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    if (!name.trim()) {
      setError('이름을 입력해 주세요.')
      setIsLoading(false)
      return
    }
    if (!slugValidation.valid) {
      setError(slugValidation.message || '유효하지 않은 슬러그입니다.')
      setIsLoading(false)
      return
    }
    if (heroMedia.length > 20 || galleryPhotos.length > 50) {
      setError('히어로는 20개, 갤러리는 50개까지 저장할 수 있습니다.')
      setIsLoading(false)
      return
    }

    const hasPendingUpload = imageUrl?.startsWith('blob:')
      || heroMedia.some(media => media.image_url.startsWith('blob:'))
      || galleryPhotos.some(photo => photo.image_url.startsWith('blob:'))
    if (hasPendingUpload) {
      setError('이미지가 아직 업로드 중입니다. 완료 후 다시 시도해 주세요.')
      setIsLoading(false)
      return
    }

    try {
      const showroomDb = supabase.schema('showroom') as unknown as NodeRpcClient
      const { error: saveError } = await showroomDb.rpc('save_node', {
        p_node_id: node.id,
        p_node: {
          name: name.trim(),
          slug: slug.trim(),
          card_subtitle: cardSubtitle || null,
          card_text_position: cardTextPosition,
          status,
          type,
          image_url: imageUrl,
          hero_enabled: heroEnabled,
          hero_video_url: heroVideoUrl || null,
          hero_mobile_video_url: heroMobileVideoUrl || null,
          hero_title: heroTitle || null,
          hero_subtitle: heroSubtitle || null,
          hero_description: heroDescription || null,
          hero_slide_interval: heroSlideInterval,
          hero_slide_transition: heroSlideTransition,
          tagline: tagline || null,
          description: description || null,
        },
        p_hero_media: heroMedia.map((media, index) => ({
          image_url: media.image_url,
          device_type: media.device_type,
          media_type: media.media_type,
          display_order: index,
        })),
        p_gallery_photos: galleryPhotos.map((photo, index) => ({
          image_url: photo.image_url,
          caption: photo.caption || null,
          display_order: index,
        })),
      })

      if (saveError) throw new Error(saveError.message)
      setSuccess(true)
      router.refresh()
    } catch (err: unknown) {
      logError('Save error:', err)
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error ? <PlatformStatePanel tone="error" title={error} /> : null}
      {success ? <PlatformStatePanel tone="success" title="저장되었습니다" description="노드와 연결 미디어를 한 트랜잭션으로 저장했습니다." /> : null}

      <PlatformPanel as="section" className={styles.section} aria-labelledby="node-base-heading">
        <div className={styles.sectionHeading}>
          <h2 id="node-base-heading">기본 정보</h2>
          <span>타입: {type === 'listing' ? '리스트' : '상세'}</span>
        </div>
        <PlatformField
          id="name"
          label="노드 이름 *"
          value={name}
          onChange={event => {
            const nextName = event.target.value
            clearSaveFeedback()
            setName(nextName)
            if (autoSlug) setSlug(generateSlug(nextName))
          }}
          disabled={isLoading}
          placeholder="예: 실크벽지"
        />
        <PlatformField
          id="slug"
          label="URL 경로 *"
          hint="영문 소문자, 숫자, 하이픈만 사용할 수 있습니다."
          error={slug && !slugValidation.valid ? slugValidation.message : undefined}
          value={slug}
          onChange={event => {
            clearSaveFeedback()
            setAutoSlug(false)
            setSlug(event.target.value)
          }}
          disabled={isLoading}
          placeholder="예: silk-wallpaper"
        />
        <PlatformField
          id="cardSubtitle"
          label="카드 부제 (선택)"
          value={cardSubtitle}
          onChange={event => { clearSaveFeedback(); setCardSubtitle(event.target.value) }}
          disabled={isLoading}
          placeholder="예: 고급스러운 실내 공간을 위한"
        />
        {type === 'listing' ? (
          <PlatformSelect
            id="cardTextPosition"
            label="하위 카드 표시 방식"
            options={CARD_POSITION_OPTIONS}
            value={cardTextPosition}
            onChange={event => { clearSaveFeedback(); setCardTextPosition(event.target.value as 'overlay' | 'below') }}
            disabled={isLoading}
          />
        ) : null}
        <PlatformSelect
          id="status"
          label="상태"
          options={STATUS_OPTIONS}
          value={status}
          onChange={event => { clearSaveFeedback(); setStatus(event.target.value as 'draft' | 'published') }}
          disabled={isLoading}
        />
        <div>
          <PlatformButton type="button" variant="secondary" onClick={handleTypeSwitch} disabled={isLoading || hasPendingUploads}>
            {type === 'listing' ? '상세(detail) 노드로 전환' : '리스트(listing) 노드로 전환'}
          </PlatformButton>
        </div>
      </PlatformPanel>

      <PlatformPanel as="section" className={styles.section} aria-labelledby="node-image-heading">
        <div className={styles.sectionCopy}>
          <h2 id="node-image-heading">대표 이미지</h2>
          <p>목록 카드에 표시될 대표 이미지입니다. 권장 비율은 3:4입니다.</p>
        </div>
        <ImageUploader
          folderPath={`nodes/${slug || 'temp'}`}
          onUploadComplete={url => { clearSaveFeedback(); setImageUrl(url) }}
          currentImageUrl={imageUrl || undefined}
          currentImageSource={imageUrl ? imageSources[imageUrl] : undefined}
          onImageSourceReady={handleImageSourceReady}
          onDelete={() => { clearSaveFeedback(); setImageUrl(null) }}
          compressionMaxDimension={1600}
          compressionQuality={0.8}
          onUploadStateChange={onUploadStateChange}
          disabled={isLoading || hasPendingUploads}
        />
      </PlatformPanel>

      {type === 'listing' ? (
        <PlatformPanel as="section" className={styles.section} aria-labelledby="node-hero-heading">
          <div className={styles.sectionHeading}>
            <div className={styles.sectionCopy}>
              <h2 id="node-hero-heading">히어로 설정</h2>
              <p>목록 페이지 상단에 표시될 히어로 영역입니다.</p>
            </div>
            <PlatformSwitch
              checked={heroEnabled}
              onCheckedChange={checked => { clearSaveFeedback(); setHeroEnabled(checked) }}
              label="히어로 사용"
              disabled={isLoading || hasPendingUploads}
            />
          </div>
          {heroEnabled ? (
            <>
              <HeroConfigurator
                heroMedia={heroMedia}
                onHeroMediaChange={handleHeroMediaChange}
                nodeSlug={slug}
                videoUrl={heroVideoUrl}
                mobileVideoUrl={heroMobileVideoUrl}
                onVideoUrlChange={value => { clearSaveFeedback(); setHeroVideoUrl(value) }}
                onMobileVideoUrlChange={value => { clearSaveFeedback(); setHeroMobileVideoUrl(value) }}
                onUploadStateChange={onUploadStateChange}
                imageSources={imageSources}
                onImageSourceReady={handleImageSourceReady}
                disabled={isLoading || hasPendingUploads}
              />
              <PlatformField
                id="heroSlideInterval"
                label="슬라이드 전환 시간 (초)"
                type="number"
                min={1}
                max={60}
                value={heroSlideInterval}
                onChange={event => { clearSaveFeedback(); setHeroSlideInterval(Number.parseInt(event.target.value, 10) || 5) }}
                disabled={isLoading}
              />
              <PlatformSelect
                id="heroSlideTransition"
                label="슬라이드 전환 효과"
                options={TRANSITION_OPTIONS}
                value={heroSlideTransition}
                onChange={event => { clearSaveFeedback(); setHeroSlideTransition(event.target.value as 'fade' | 'slide') }}
                disabled={isLoading}
              />
              <PlatformField
                id="heroTitle"
                label="히어로 제목"
                hint={hasVideo ? '영상이 등록되면 히어로 문구는 표시되지 않습니다.' : undefined}
                value={heroTitle}
                onChange={event => { clearSaveFeedback(); setHeroTitle(event.target.value) }}
                disabled={isLoading || hasVideo}
                placeholder="히어로 메인 제목"
              />
              <PlatformField
                id="heroSubtitle"
                label="히어로 부제"
                value={heroSubtitle}
                onChange={event => { clearSaveFeedback(); setHeroSubtitle(event.target.value) }}
                disabled={isLoading || hasVideo}
                placeholder="히어로 서브 제목"
              />
              <PlatformField
                id="heroDescription"
                label="히어로 설명"
                multiline
                value={heroDescription}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => { clearSaveFeedback(); setHeroDescription(event.target.value) }}
                disabled={isLoading || hasVideo}
                placeholder="히어로 상세 설명"
                rows={3}
              />
            </>
          ) : null}
        </PlatformPanel>
      ) : null}

      {type === 'detail' ? (
        <PlatformPanel as="section" className={styles.section} aria-labelledby="node-detail-heading">
          <div className={styles.sectionCopy}>
            <h2 id="node-detail-heading">상세 콘텐츠</h2>
            <p>상세 페이지에 표시될 정보와 갤러리입니다.</p>
          </div>
          <PlatformField
            id="tagline"
            label="태그라인"
            value={tagline}
            onChange={event => { clearSaveFeedback(); setTagline(event.target.value) }}
            disabled={isLoading}
            placeholder="예: 따뜻하고 자연스러운 무드"
          />
          <PlatformField
            id="description"
            label="상세 설명"
            multiline
            value={description}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => { clearSaveFeedback(); setDescription(event.target.value) }}
            disabled={isLoading}
            placeholder="제품에 대한 상세 설명을 입력하세요."
            rows={4}
          />
          <div className={styles.galleryGroup}>
            <h3>갤러리 사진</h3>
            <GalleryManager
              photos={galleryPhotos}
              onPhotosChange={handleGalleryPhotosChange}
              nodeSlug={slug}
              onUploadStateChange={onUploadStateChange}
              imageSources={imageSources}
              onImageSourceReady={handleImageSourceReady}
              disabled={isLoading || hasPendingUploads}
            />
          </div>
        </PlatformPanel>
      ) : null}

      <PlatformPanel as="section" className={styles.section} aria-labelledby="node-preview-heading">
        <div className={styles.sectionCopy}>
          <h2 id="node-preview-heading">미리보기</h2>
          <p>저장하지 않은 초안도 임시 링크로 72시간 동안 확인할 수 있습니다.</p>
        </div>
        {previewLoadError ? <PlatformStatePanel tone="error" title="미리보기 링크 확인 실패" description={previewLoadError} /> : null}
        {previewActionError ? <PlatformStatePanel tone="error" title={previewActionError} /> : null}
        {!previewToken ? (
          <div>
            <PlatformButton
              type="button"
              variant="secondary"
              onClick={handleGeneratePreview}
              isLoading={isGeneratingToken}
              loadingLabel="생성 중…"
            >
              <Link2 size={16} aria-hidden="true" /> 미리보기 링크 생성
            </PlatformButton>
          </div>
        ) : (
          <div className={styles.previewBox}>
            <p>임시 미리보기 링크 (72시간 유효)</p>
            <code className={styles.previewUrl}>{`${typeof window !== 'undefined' ? window.location.origin : ''}/preview/${previewToken}`}</code>
            <div className={styles.previewActions}>
              <PlatformButton type="button" variant="secondary" onClick={handleCopyPreview}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copied ? '복사됨' : '복사'}
              </PlatformButton>
              <PlatformButton type="button" variant="secondary" onClick={() => window.open(`/preview/${previewToken}`, '_blank', 'noopener,noreferrer')}>
                <ExternalLink size={16} aria-hidden="true" /> 새 창 열기
              </PlatformButton>
            </div>
          </div>
        )}
      </PlatformPanel>

      <div className={styles.actions}>
        <PlatformButton type="button" variant="secondary" onClick={() => router.back()} disabled={isLoading}>취소</PlatformButton>
        <PlatformButton type="submit" isLoading={isLoading} loadingLabel="저장 중…" disabled={isLoading || hasPendingUploads}>저장</PlatformButton>
      </div>
    </form>
  )
}
