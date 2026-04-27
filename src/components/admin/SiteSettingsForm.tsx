'use client'

import React, { useState } from 'react'
import { logError } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ImageUploader from './ImageUploader'
import styles from './SiteSettingsForm.module.css'

interface SiteSettingsData {
  id?: string
  site_title: string | null
  site_description: string | null
  og_image_url: string | null
  reservation_url: string | null
  store_url: string | null
}

interface SiteSettingsFormProps {
  initialData: SiteSettingsData | null
}

export default function SiteSettingsForm({ initialData }: SiteSettingsFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [title, setTitle] = useState(initialData?.site_title || '')
  const [description, setDescription] = useState(initialData?.site_description || '')
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(initialData?.og_image_url || null)
  const [reservationUrl, setReservationUrl] = useState(initialData?.reservation_url || '')
  const [storeUrl, setStoreUrl] = useState(initialData?.store_url || '')
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)
    
    try {
      const { error: upsertError } = await supabase
        .schema('colorbook')
        .from('site_settings')
        .upsert({
          id: 'singleton',
          site_title: title || null,
          site_description: description || null,
          og_image_url: ogImageUrl,
          reservation_url: reservationUrl || null,
          store_url: storeUrl || null,
          updated_at: new Date().toISOString()
        })
        
      if (upsertError) throw upsertError
      
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
        <label className={styles.label}>대표 이미지 (OG Image)</label>
        <p className={styles.helpText}>카카오톡 공유 등 링크 전송 시 표시될 이미지입니다. (권장 비율 1200x630)</p>
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
