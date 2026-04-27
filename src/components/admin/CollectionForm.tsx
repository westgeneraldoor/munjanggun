'use client'

import React, { useState } from 'react'
import { logError } from '@/lib/logger'
import { generateSlug } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import ImageUploader from './ImageUploader'
import styles from './CollectionForm.module.css'

interface CollectionFormProps {
  initialData?: {
    id: string
    name: string
    slug: string
    description: string | null
    thumbnail_url: string | null
    status: 'draft' | 'published'
  } | null
  displayOrder?: number
  onSuccess: () => void
  onCancel: () => void
}

export default function CollectionForm({
  initialData,
  displayOrder = 0,
  onSuccess,
  onCancel
}: CollectionFormProps) {
  const isEdit = !!initialData
  const [name, setName] = useState(initialData?.name || '')
  const [slug, setSlug] = useState(initialData?.slug || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialData?.thumbnail_url || null)
  const [status, setStatus] = useState<'draft' | 'published'>(initialData?.status || 'draft')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSlug, setAutoSlug] = useState(!isEdit)

  const supabase = createClient()

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoSlug(false)
    const val = e.target.value
    // 영소문자, 숫자, 하이픈만 허용
    const filtered = val.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlug(filtered)
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

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .schema('colorbook')
          .from('collections')
          .update({
            name,
            slug,
            description: description || null,
            thumbnail_url: thumbnailUrl,
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', initialData.id)
        
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .schema('colorbook')
          .from('collections')
          .insert({
            name,
            slug,
            description: description || null,
            thumbnail_url: thumbnailUrl,
            display_order: displayOrder,
            status
          })

        if (insertError) throw insertError
      }
      
      onSuccess()
    } catch (err: unknown) {
      logError('Save error:', err)
      const message = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.title}>{isEdit ? '컬렉션 수정' : '새 컬렉션 추가'}</h2>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="name" className={styles.label}>이름 *</label>
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
              placeholder="예: 프리미엄 우드"
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
              placeholder="예: premium-wood"
            />
            <p className={styles.helpText}>URL에 사용될 주소입니다.</p>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="description" className={styles.label}>설명 (선택)</label>
            <textarea
              id="description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              placeholder="컬렉션에 대한 간단한 설명을 입력하세요."
              rows={3}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>대표 이미지 (선택)</label>
            <p className={styles.helpText}>컬렉션을 대표하는 이미지를 업로드하세요. (권장 비율 16:9 또는 1:1)</p>
            <ImageUploader
              folderPath={`collections/${slug || 'temp'}`}
              onUploadComplete={(url) => setThumbnailUrl(url)}
              currentImageUrl={thumbnailUrl || undefined}
              onDelete={() => setThumbnailUrl(null)}
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

          <div className={styles.actions}>
            <button 
              type="button" 
              className={styles.cancelBtn} 
              onClick={onCancel}
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
      </div>
    </div>
  )
}
