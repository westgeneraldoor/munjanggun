'use client'

import React, { useState, useEffect } from 'react'
import { logError } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { Link2, Copy, Check } from 'lucide-react'
import { generateSlug } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import ImageUploader from './ImageUploader'
import styles from './ColorForm.module.css'

interface PhotoData {
  id?: string
  image_url: string
  caption?: string | null
  display_order: number
}

interface ColorFormProps {
  collectionId: string
  collectionSlug: string
  initialData?: {
    id: string
    name: string
    slug: string
    tagline: string | null
    description: string | null
    texture_image_url: string | null
    status: 'draft' | 'published'
    installation_photos?: PhotoData[]
  } | null
}

export default function ColorForm({ collectionId, collectionSlug, initialData }: ColorFormProps) {
  const isEdit = !!initialData
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState(initialData?.name || '')
  const [slug, setSlug] = useState(initialData?.slug || '')
  const [tagline, setTagline] = useState(initialData?.tagline || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [status, setStatus] = useState<'draft' | 'published'>(initialData?.status || 'draft')
  const [textureUrl, setTextureUrl] = useState<string | null>(initialData?.texture_image_url || null)
  
  // 시공사진 상태
  const [photos, setPhotos] = useState<PhotoData[]>(
    initialData?.installation_photos ? [...initialData.installation_photos].sort((a, b) => a.display_order - b.display_order) : []
  )
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSlug, setAutoSlug] = useState(!isEdit)

  // Preview state
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [isGeneratingToken, setIsGeneratingToken] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isEdit && initialData?.id) {
      const fetchToken = async () => {
        const { data } = await supabase
          .schema('colorbook')
          .from('preview_tokens')
          .select('token')
          .eq('color_id', initialData.id)
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
  }, [isEdit, initialData?.id, supabase])

  const handleGeneratePreview = async () => {
    if (!initialData?.id) return
    setIsGeneratingToken(true)
    try {
      const token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      
      const { error } = await supabase
        .schema('colorbook')
        .from('preview_tokens')
        .insert({
          token,
          color_id: initialData.id,
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
    const val = e.target.value
    const filtered = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlug(filtered)
  }

  const handleTextureUpload = (url: string) => {
    setTextureUrl(url)
  }

  const handlePhotoUpload = (url: string) => {
    setPhotos(prev => [
      ...prev,
      {
        image_url: url,
        display_order: prev.length
      }
    ])
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, display_order: i })))
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

    // 업로드 중인 사진 확인 (blob: URL이 남아있으면 아직 업로드 중)
    const pendingPhotos = photos.filter(p => p.image_url.startsWith('blob:'))
    if (pendingPhotos.length > 0) {
      setError(`사진 ${pendingPhotos.length}장이 아직 업로드 중입니다. 완료 후 다시 시도해주세요.`)
      setIsLoading(false)
      return
    }

    try {
      let colorId = initialData?.id

      if (isEdit && colorId) {
        // Update color
        const { error: updateError } = await supabase
          .schema('colorbook')
          .from('colors')
          .update({
            name,
            slug,
            tagline: tagline || null,
            description: description || null,
            texture_image_url: textureUrl,
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', colorId)
        
        if (updateError) throw updateError
      } else {
        // Insert color
        // display_order를 위한 최대값 조회
        const { data: maxOrderData } = await supabase
          .schema('colorbook')
          .from('colors')
          .select('display_order')
          .eq('collection_id', collectionId)
          .order('display_order', { ascending: false })
          .limit(1)
        
        const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].display_order + 1 : 0

        const { data: insertData, error: insertError } = await supabase
          .schema('colorbook')
          .from('colors')
          .insert({
            collection_id: collectionId,
            name,
            slug,
            tagline: tagline || null,
            description: description || null,
            texture_image_url: textureUrl,
            display_order: nextOrder,
            status
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        colorId = insertData.id
      }

      // 시공사진 처리
      if (colorId) {
        // 기존 사진 삭제 후 재삽입 (단순화를 위해. 실제론 diff 하는 것이 좋음)
        // 여기선 현재 폼의 상태를 진실로 간주하여 모두 다시 넣습니다.
        if (isEdit) {
           await supabase
             .schema('colorbook')
             .from('installation_photos')
             .delete()
             .eq('color_id', colorId)
        }
        
        if (photos.length > 0) {
          const photoInserts = photos.map((p, index) => ({
            color_id: colorId!,
            image_url: p.image_url,
            caption: p.caption || null,
            display_order: index
          }))
          
          const { error: photoError } = await supabase
             .schema('colorbook')
             .from('installation_photos')
             .insert(photoInserts)
             
          if (photoError) throw photoError
        }
      }

      router.push(`/admin/collections/${collectionId}/colors`)
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
        <h3 className={styles.sectionTitle}>기본 정보</h3>
        <div className={styles.inputGroup}>
          <label htmlFor="name" className={styles.label}>컬러 이름 *</label>
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
            placeholder="예: 내추럴 오크"
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="slug" className={styles.label}>Slug * (영문/숫자/하이픈)</label>
          <input
            id="slug"
            type="text"
            className={styles.input}
            value={slug}
            onChange={handleSlugChange}
            disabled={isLoading}
            placeholder="예: natural-oak"
          />
          <p className={styles.helpText}>URL에 사용될 주소입니다.</p>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="tagline" className={styles.label}>태그라인 (선택)</label>
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

        <div className={styles.inputGroup}>
          <label htmlFor="description" className={styles.label}>상세 설명 (선택)</label>
          <textarea
            id="description"
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            placeholder="컬러에 대한 상세 설명을 입력하세요."
            rows={4}
          />
        </div>

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
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>텍스처 이미지</h3>
        <p className={styles.sectionDesc}>컬러를 대표하는 텍스처(표면) 이미지를 업로드합니다. (권장 비율 3:4)</p>
        <ImageUploader
          folderPath={`textures/${collectionSlug}`}
          onUploadComplete={handleTextureUpload}
          currentImageUrl={textureUrl || undefined}
          onDelete={() => setTextureUrl(null)}
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>시공 사진</h3>
        <p className={styles.sectionDesc}>이 컬러가 실제 시공된 사진들을 업로드합니다.</p>
        
        <div className={styles.photosGrid}>
          {photos.map((photo, index) => (
            <div key={index} className={styles.photoItem}>
              <ImageUploader
                folderPath={`photos/${collectionSlug}/${slug || 'temp'}`}
                onUploadComplete={(url) => {
                  const newPhotos = [...photos]
                  newPhotos[index].image_url = url
                  setPhotos(newPhotos)
                }}
                currentImageUrl={photo.image_url}
                onDelete={() => handleRemovePhoto(index)}
              />
              <input 
                type="text" 
                className={`${styles.input} ${styles.captionInput}`} 
                placeholder="사진 설명 (선택)" 
                value={photo.caption || ''}
                onChange={(e) => {
                  const newPhotos = [...photos]
                  newPhotos[index].caption = e.target.value
                  setPhotos(newPhotos)
                }}
              />
            </div>
          ))}
          
          <div className={styles.addPhotoCard}>
            <ImageUploader
              folderPath={`photos/${collectionSlug}/${slug || 'temp'}`}
              onUploadComplete={handlePhotoUpload}
              multiple={true}
              compressionMaxDimension={1000}
              compressionQuality={0.7}
              onMultiUploadComplete={(urls) => {
                setPhotos(prev => [
                  ...prev,
                  ...urls.map((url, i) => ({
                    image_url: url,
                    display_order: prev.length + i
                  }))
                ])
              }}
              onUploadReplace={(oldUrl, newUrl) => {
                setPhotos(prev => prev.map(p =>
                  p.image_url === oldUrl ? { ...p, image_url: newUrl } : p
                ))
              }}
            />
          </div>
        </div>
      </div>

      {isEdit && (
        <div className={styles.previewSection}>
          <h3 className={styles.sectionTitle}>미리보기</h3>
          <p className={styles.sectionDesc}>
            저장하지 않은 초안 상태이더라도, 임시 링크를 통해 24시간 동안 확인할 수 있습니다.
          </p>
          
          {!previewToken ? (
            <button
              type="button"
              className={styles.previewBtn}
              onClick={handleGeneratePreview}
              disabled={isGeneratingToken}
            >
              <Link2 size={16} />
              {isGeneratingToken ? '생성 중...' : '미리보기 링크 생성'}
            </button>
          ) : (
            <div className={styles.previewResult}>
              <p className={styles.previewResultText}>임시 미리보기 링크 (24시간 유효)</p>
              <div className={styles.previewUrlWrapper}>
                <div className={styles.previewUrl}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/preview/${previewToken}` : `/preview/${previewToken}`}
                </div>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={handleCopyPreview}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '복사됨' : '복사'}
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
          onClick={() => router.push(`/admin/collections/${collectionId}/colors`)}
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
