'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logError } from '@/lib/logger'
import { generateSlug, validateSlug } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import { Link2, Copy, Check } from 'lucide-react'
import { PlatformSwitch } from '@/components/platform/ui'
import ImageUploader from './ImageUploader'
import HeroConfigurator from './HeroConfigurator'
import GalleryManager from './GalleryManager'
import styles from './NodeForm.module.css'

type NodeRow = Database['showroom']['Tables']['nodes']['Row']
type HeroMediaRow = Database['showroom']['Tables']['hero_media']['Row']
type GalleryPhotoRow = Database['showroom']['Tables']['gallery_photos']['Row']

interface NodeFormProps {
  node: NodeRow
  heroMedia: HeroMediaRow[]
  galleryPhotos: GalleryPhotoRow[]
  childCount: number
}

export default function NodeForm({ node, heroMedia: initialHeroMedia, galleryPhotos: initialGalleryPhotos, childCount }: NodeFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Base fields
  const [name, setName] = useState(node.name)
  const [slug, setSlug] = useState(node.slug)
  const [cardSubtitle, setCardSubtitle] = useState(node.card_subtitle || '')
  const [cardTextPosition, setCardTextPosition] = useState<'overlay' | 'below'>(
    (node.card_text_position as 'overlay' | 'below') || 'overlay'
  )
  const [status, setStatus] = useState<'draft' | 'published'>(node.status as 'draft' | 'published')
  const [type, setType] = useState<'listing' | 'detail'>(node.type as 'listing' | 'detail')
  const [imageUrl, setImageUrl] = useState<string | null>(node.image_url)
  
  // Listing specific
  const [heroEnabled, setHeroEnabled] = useState(node.hero_enabled)
  const [heroVideoUrl, setHeroVideoUrl] = useState(node.hero_video_url || '')
  const [heroMobileVideoUrl, setHeroMobileVideoUrl] = useState(node.hero_mobile_video_url || '')
  const [heroTitle, setHeroTitle] = useState(node.hero_title || '')
  const [heroSubtitle, setHeroSubtitle] = useState(node.hero_subtitle || '')
  const [heroDescription, setHeroDescription] = useState(node.hero_description || '')
  const [heroSlideInterval, setHeroSlideInterval] = useState(node.hero_slide_interval ?? 5)
  const [heroSlideTransition, setHeroSlideTransition] = useState<'fade' | 'slide'>(
    (node.hero_slide_transition as 'fade' | 'slide') || 'fade'
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

  // Detail specific
  const [tagline, setTagline] = useState(node.tagline || '')
  const [description, setDescription] = useState(node.description || '')
  const [galleryPhotos, setGalleryPhotos] = useState<{ id?: string; image_url: string; caption: string | null; display_order: number }[]>(
    [...initialGalleryPhotos].map(p => ({
      id: p.id,
      image_url: p.image_url,
      caption: p.caption,
      display_order: p.display_order
    })).sort((a, b) => a.display_order - b.display_order)
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSlug, setAutoSlug] = useState(false)

  // Preview state
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [isGeneratingToken, setIsGeneratingToken] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load existing preview token
  React.useEffect(() => {
    if (node.id) {
      const fetchToken = async () => {
        const { data } = await supabase
          .schema('showroom')
          .from('preview_tokens')
          .select('token')
          .eq('node_id', node.id)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
          
        if (data) {
          setPreviewToken(data.token)
        }
      }
      fetchToken()
    }
  }, [node.id, supabase])

  const handleGeneratePreview = async () => {
    if (!node.id) return
    setIsGeneratingToken(true)
    try {
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 72) // V2 72 hours
      
      const showroomDb = supabase.schema('showroom')
      const { error } = await showroomDb
        .from('preview_tokens')
        .insert({
          token,
          node_id: node.id,
          expires_at: expiresAt.toISOString()
        })
        
      if (error) throw error
      setPreviewToken(token)
    } catch (err) {
      logError('Failed to generate preview token', err)
      alert('미리보기 링크 생성에 실패했습니다.')
    } finally {
      setIsGeneratingToken(false)
    }
  }

  const handleCopyPreview = () => {
    if (!previewToken) return
    const url = `${window.location.origin}/preview/${previewToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoSlug(false)
    setSlug(e.target.value)
  }

  const handleTypeSwitch = () => {
    if (type === 'listing') {
      if (childCount > 0) {
        setError(`하위 ${childCount}개 항목이 있어 변경할 수 없습니다.`)
        return
      }
      setType('detail')
    } else {
      setType('listing')
      setHeroEnabled(false)
      if (tagline || description) {
        if (!confirm('타입 전환 시 기존 태그라인과 상세 설명은 표시되지 않습니다. 계속하시겠습니까?')) {
          setType('detail')
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!name.trim()) {
      setError('이름을 입력해주세요.')
      setIsLoading(false)
      return
    }

    if (!slug.trim()) {
      setError('Slug를 입력해주세요.')
      setIsLoading(false)
      return
    }

    const slugValidation = validateSlug(slug)
    if (!slugValidation.valid) {
      setError(slugValidation.message || '유효하지 않은 슬러그입니다.')
      setIsLoading(false)
      return
    }

    // Check pending uploads
    const pendingHero = heroMedia.filter(p => p.image_url.startsWith('blob:'))
    const pendingGallery = galleryPhotos.filter(p => p.image_url.startsWith('blob:'))
    if (pendingHero.length > 0 || pendingGallery.length > 0 || imageUrl?.startsWith('blob:')) {
      setError('이미지가 아직 업로드 중입니다. 완료 후 다시 시도해주세요.')
      setIsLoading(false)
      return
    }

    try {
      const showroomDb = supabase.schema('showroom')

      // Update node
      const { error: updateError } = await showroomDb
        .from('nodes')
        .update({
          name,
          slug,
          card_subtitle: cardSubtitle || null,
          card_text_position: cardTextPosition,
          status,
          type,
          image_url: imageUrl,
          hero_enabled: type === 'listing' ? heroEnabled : false,
          hero_video_url: type === 'listing' ? (heroVideoUrl || null) : null,
          hero_mobile_video_url: type === 'listing' ? (heroMobileVideoUrl || null) : null,
          hero_title: type === 'listing' ? (heroTitle || null) : null,
          hero_subtitle: type === 'listing' ? (heroSubtitle || null) : null,
          hero_description: type === 'listing' ? (heroDescription || null) : null,
          hero_slide_interval: type === 'listing' ? heroSlideInterval : 5,
          hero_slide_transition: type === 'listing' ? heroSlideTransition : 'fade',
          tagline: type === 'detail' ? (tagline || null) : null,
          description: type === 'detail' ? (description || null) : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', node.id)
      
      if (updateError) throw updateError

      // Update hero media if listing
      if (type === 'listing') {
        await showroomDb
          .from('hero_media')
          .delete()
          .eq('node_id', node.id)
        
        if (heroMedia.length > 0) {
          const { error: heroError } = await showroomDb
            .from('hero_media')
            .insert(
              heroMedia.map((m, index) => ({
                node_id: node.id,
                image_url: m.image_url,
                device_type: m.device_type,
                media_type: m.media_type,
                display_order: index
              }))
            )
          if (heroError) throw heroError
        }
      }

      // Update gallery photos if detail
      if (type === 'detail') {
        await showroomDb
          .from('gallery_photos')
          .delete()
          .eq('node_id', node.id)
        
        if (galleryPhotos.length > 0) {
          const { error: galleryError } = await showroomDb
            .from('gallery_photos')
            .insert(
              galleryPhotos.map((p, index) => ({
                node_id: node.id,
                image_url: p.image_url,
                caption: p.caption || null,
                display_order: index
              }))
            )
          if (galleryError) throw galleryError
        }
      }

      alert('저장되었습니다.')
      router.back()
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
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className={styles.sectionTitle}>기본 정보</h3>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--admin-text-sub)' }}>
            타입: {type === 'listing' ? '리스트' : '상세'}
          </span>
        </div>
        
        <div className={styles.inputGroup}>
          <label htmlFor="name" className={styles.label}>노드 이름 *</label>
          <input
            id="name"
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => {
              const newName = e.target.value
              setName(newName)
              if (autoSlug) {
                setSlug(generateSlug(newName))
              }
            }}
            disabled={isLoading}
            placeholder="예: 실크벽지"
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="slug" className={styles.label}>URL 경로 * (영문 소문자, 숫자, - 만 가능)</label>
          <input
            id="slug"
            type="text"
            className={`${styles.input} ${slug && !validateSlug(slug).valid ? styles.inputError : ''}`}
            value={slug}
            onChange={handleSlugChange}
            disabled={isLoading}
            placeholder="예: silk-wallpaper"
          />
          {slug && !validateSlug(slug).valid && (
            <p className={styles.slugWarning}>{validateSlug(slug).message || '유효하지 않은 형식입니다.'}</p>
          )}
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="cardSubtitle" className={styles.label}>카드 부제 (선택)</label>
          <input
            id="cardSubtitle"
            type="text"
            className={styles.input}
            value={cardSubtitle}
            onChange={(e) => setCardSubtitle(e.target.value)}
            disabled={isLoading}
            placeholder="예: 고급스러운 실내 공간을 위한"
          />
        </div>

        {type === 'listing' && (
          <div className={styles.inputGroup}>
            <label htmlFor="cardTextPosition" className={styles.label}>하위 카드 표시 방식</label>
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
        )}

        <div className={styles.inputGroup}>
          <label htmlFor="status" className={styles.label}>상태</label>
          <select
            id="status"
            className={styles.select}
            value={status}
            onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
            disabled={isLoading}
          >
            <option value="draft">초안 (숨김)</option>
            <option value="published">공개</option>
          </select>
        </div>
        
        <button 
          type="button" 
          onClick={handleTypeSwitch}
          className={styles.typeSwitchBtn}
          disabled={isLoading}
        >
          {type === 'listing' ? '상세(detail) 노드로 전환' : '리스트(listing) 노드로 전환'}
        </button>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>대표 이미지</h3>
        <p className={styles.sectionDesc}>목록 카드에 표시될 대표 이미지입니다. (권장 비율 3:4)</p>
        <ImageUploader
          folderPath={`nodes/${slug || 'temp'}`}
          onUploadComplete={setImageUrl}
          currentImageUrl={imageUrl || undefined}
          onDelete={() => setImageUrl(null)}
          compressionMaxDimension={1600}
          compressionQuality={0.8}
        />
      </div>

      {type === 'listing' && (
        <div className={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <div>
              <h3 className={styles.sectionTitle}>히어로 설정</h3>
              <p className={styles.sectionDesc} style={{ marginBottom: 0 }}>목록 페이지 상단에 표시될 히어로 영역입니다.</p>
            </div>
            <PlatformSwitch
              checked={heroEnabled}
              onCheckedChange={setHeroEnabled}
              label="히어로 사용"
              disabled={isLoading}
            />
          </div>

          {heroEnabled && (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.label}>히어로 이미지/비디오 슬라이드</label>
                <HeroConfigurator
                  heroMedia={heroMedia}
                  onHeroMediaChange={setHeroMedia}
                  nodeSlug={slug}
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
                  placeholder="히어로 메인 제목"
                />
                {hasVideo && <p className={styles.mediaHint}>영상이 등록되면 히어로 문구는 표시되지 않습니다.</p>}
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
                  placeholder="히어로 서브 제목"
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
                  placeholder="히어로 상세 설명"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>
      )}

      {type === 'detail' && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>상세 콘텐츠</h3>
          <p className={styles.sectionDesc}>상세 페이지에 표시될 정보와 갤러리입니다.</p>
          
          <div className={styles.inputGroup} style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="tagline" className={styles.label}>태그라인</label>
            <input
              id="tagline"
              type="text"
              className={styles.input}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              disabled={isLoading}
              placeholder="예: 따뜻하고 자연스러운 무드"
            />
          </div>

          <div className={styles.inputGroup} style={{ marginBottom: 'var(--space-5)' }}>
            <label htmlFor="description" className={styles.label}>상세 설명</label>
            <textarea
              id="description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              placeholder="제품에 대한 상세 설명을 입력하세요."
              rows={4}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>갤러리 사진</label>
            <GalleryManager
              photos={galleryPhotos}
              onPhotosChange={setGalleryPhotos}
              nodeSlug={slug}
            />
          </div>
        </div>
      )}

      {node.id && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>미리보기</h3>
          <p className={styles.sectionDesc}>
            저장하지 않은 초안 상태이더라도, 임시 링크를 통해 72시간 동안 확인할 수 있습니다.
          </p>
          
          {!previewToken ? (
            <button
              type="button"
              className={styles.typeSwitchBtn}
              onClick={handleGeneratePreview}
              disabled={isGeneratingToken}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
            >
              <Link2 size={16} />
              {isGeneratingToken ? '생성 중...' : '미리보기 링크 생성'}
            </button>
          ) : (
            <div style={{ background: 'var(--admin-bg-hover)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--admin-text-sub)', marginBottom: 'var(--space-2)' }}>임시 미리보기 링크 (72시간 유효)</p>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <div style={{ flex: 1, padding: 'var(--space-2)', background: 'var(--admin-bg)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/preview/${previewToken}` : `/preview/${previewToken}`}
                </div>
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 'var(--space-2) var(--space-3)', background: 'var(--admin-border)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--admin-text)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '복사됨' : '복사'}
                </button>
                <button
                  type="button"
                  onClick={() => window.open(`/preview/${previewToken}`, '_blank')}
                  style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--admin-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
                >
                  새 창 열기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button 
          type="button" 
          className={styles.cancelBtn} 
          onClick={() => router.back()}
          disabled={isLoading}
        >
          취소
        </button>
        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={isLoading}
        >
          {isLoading ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
