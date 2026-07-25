'use client'

import React, { useId, useState, useRef } from 'react'
import { logError } from '@/lib/logger'
import { UploadCloud, X, Edit2 } from 'lucide-react'
import { uploadShowroomImage } from '@/app/admin/nodes/image-actions'
import ShowroomImage from '@/components/showroom/ShowroomImage'
import type { ShowroomImageSource } from '@/lib/showroom/image-sources'
import styles from './ImageUploader.module.css'
import type { UploadStateChange } from './useUploadPendingTracker'

interface ImageUploaderProps {
  bucketName?: string
  folderPath: string
  onUploadComplete: (url: string) => void
  currentImageUrl?: string
  currentImageSource?: ShowroomImageSource
  onImageSourceReady?: (source: ShowroomImageSource) => void
  maxSizeMB?: number
  acceptTypes?: string
  onDelete?: () => void
  multiple?: boolean
  onMultiUploadComplete?: (urls: string[]) => void
  onUploadReplace?: (oldUrl: string, newUrl: string) => void  // blob→실제URL 교체용
  compressionMaxDimension?: number   // 압축 최대 크기 (px)
  compressionQuality?: number        // JPEG 품질 (0~1)
  onUploadStateChange?: UploadStateChange
  disabled?: boolean
}

export default function ImageUploader({
  onUploadComplete,
  currentImageUrl,
  currentImageSource,
  onImageSourceReady,
  maxSizeMB = 10,
  acceptTypes = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif',
  onDelete,
  multiple = false,
  onMultiUploadComplete,
  onUploadReplace,
  onUploadStateChange,
  disabled = false,
}: ImageUploaderProps) {
  const fileInputId = useId().replaceAll(':', '')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadedSource, setUploadedSource] = useState<ShowroomImageSource | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || isUploading) return
    
    if (multiple) {
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) handleMultiFiles(files)
    } else {
      const file = e.dataTransfer.files[0]
      if (file) handleUpload(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return
    const files = e.target.files
    if (!files || files.length === 0) return
    try {
      await handleMultiFiles(Array.from(files))
    } catch (err) {
      logError('Multi file change error:', err)
      setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.')
      setIsUploading(false)
      onUploadStateChange?.(fileInputId, false)
      setProgress(0)
    }
  }

  const handleMultiFiles = async (files: File[]) => {
    if (disabled || isUploading) return
    
    setError(null)
    setIsUploading(true)
    onUploadStateChange?.(fileInputId, true)
    setProgress(0)
    
    // 즉시 미리보기: Object URL로 사진을 바로 표시
    const useOptimistic = !!onUploadReplace
    const previews = files.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }))
    
    if (useOptimistic && onMultiUploadComplete) {
      // 즉시 preview URL로 사진 표시 (사용자 체감 0초)
      onMultiUploadComplete(previews.map(p => p.previewUrl))
    }
    
    // 백그라운드: 압축 + 업로드
    const uploadedUrls: string[] = []
    const failedNames: string[] = []
    const total = files.length
    
    for (let i = 0; i < total; i++) {
      const { file, previewUrl: blobUrl } = previews[i]
      try {
        const url = await uploadSingleFile(file)
        if (url) {
          uploadedUrls.push(url)
          // blob URL → 실제 Supabase URL로 교체 (사용자에겐 보이지 않음)
          if (useOptimistic && onUploadReplace) {
            onUploadReplace(blobUrl, url)
          }
        }
        setProgress(Math.round(((i + 1) / total) * 100))
      } catch (err) {
        logError('Multi upload error:', err)
        failedNames.push(file.name)
      }
    }
    
    // 비-옵티미스틱 모드 (onUploadReplace 미제공 시 기존 동작 유지)
    if (!useOptimistic && onMultiUploadComplete && uploadedUrls.length > 0) {
      onMultiUploadComplete(uploadedUrls)
    }
    
    if (failedNames.length > 0) {
      setError(`${failedNames.length}개 파일 업로드 실패: ${failedNames.join(', ')}`)
    }
    
    // 파일 입력 초기화 (같은 파일 재선택 가능하도록)
    if (fileInputRef.current) fileInputRef.current.value = ''
    
    setTimeout(() => {
      setIsUploading(false)
      onUploadStateChange?.(fileInputId, false)
      setProgress(0)
    }, 500)
  }

  const uploadSingleFile = async (file: File): Promise<string | null> => {
    // 크기 검증
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`파일 크기는 ${maxSizeMB}MB를 초과할 수 없습니다.`)
    }

    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadShowroomImage(formData)
      if (!result.ok) throw new Error(result.error)
      setUploadedSource(result.source)
      onImageSourceReady?.(result.source)
      return result.source.originalUrl
    } catch (err: unknown) {
      logError('Single upload error:', err)
      const message = err instanceof Error ? err.message : '알 수 없는 오류'
      throw new Error(`업로드 실패 (${file.name}): ${message}`)
    }
  }

  const handleUpload = async (file: File) => {
    if (disabled || isUploading) return
    setError(null)
    
    // 미리보기 설정 (로컬 Object URL)
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)

    setIsUploading(true)
    onUploadStateChange?.(fileInputId, true)
    setProgress(10)

    try {
      setProgress(40)
      const url = await uploadSingleFile(file)
      
      if (url) {
        setProgress(100)
        onUploadComplete(url)
      }
    } catch (err: unknown) {
      logError('Upload error:', err)
      const message = err instanceof Error ? err.message : '업로드에 실패했습니다.'
      setError(message)
      setPreviewUrl(null)
    } finally {
      setTimeout(() => {
        setIsUploading(false)
        onUploadStateChange?.(fileInputId, false)
        setProgress(0)
      }, 500)
    }
  }

  const handleDeleteClick = () => {
    if (disabled || isUploading) return
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (onDelete) onDelete()
  }

  const triggerSelect = () => {
    if (disabled || isUploading) return
    fileInputRef.current?.click()
  }

  const displayUrl = previewUrl || currentImageUrl

  return (
    <div className={styles.uploader}>
      <input
        id={fileInputId}
        type="file"
        ref={fileInputRef}
        onChange={multiple ? handleMultiFileChange : handleFileChange}
        accept={acceptTypes}
        multiple={multiple}
        disabled={disabled || isUploading}
        className={styles.fileInput}
        aria-label="이미지 파일 선택"
      />
      
      {displayUrl ? (
        <div className={styles.previewContainer}>
          {previewUrl || displayUrl.startsWith('blob:') ? (
             // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl || displayUrl} alt="Preview" className={styles.previewImage} />
          ) : (
            <ShowroomImage
              source={
                uploadedSource?.originalUrl === displayUrl
                  ? uploadedSource
                  : currentImageSource?.originalUrl === displayUrl
                    ? currentImageSource
                    : displayUrl
              }
              purpose="card"
              alt="Current image" 
              width={400} 
              height={300} 
              className={styles.previewImage}
              loading="lazy"
            />
          )}
          
          <div className={styles.previewActions}>
            <button 
              type="button" 
              className={styles.actionBtn} 
              onClick={triggerSelect}
              title="변경"
              aria-label="이미지 변경"
              disabled={disabled || isUploading}
            >
              <Edit2 size={16} />
            </button>
            <button 
              type="button" 
              className={`${styles.actionBtn} ${styles.deleteBtn}`} 
              onClick={handleDeleteClick}
              title="삭제"
              aria-label="이미지 삭제"
              disabled={disabled || isUploading}
            >
              <X size={16} />
            </button>
          </div>
          
          {isUploading && (
            <div className={styles.progressContainer} style={{ position: 'absolute', bottom: 16, width: '90%', left: '5%' }}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.dropzone} ${isDragging ? styles.dragActive : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerSelect}
          disabled={disabled || isUploading}
        >
          <UploadCloud size={32} className={styles.icon} />
          <p className={styles.text}>클릭하거나 파일을 여기로 드래그하세요</p>
          <p className={styles.subText}>최대 {maxSizeMB}MB (허용: {acceptTypes})</p>
          
          {isUploading && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.progressText}>{progress}%</span>
            </div>
          )}
        </button>
      )}
      
      {error && <p className={styles.errorText} role="alert">{error}</p>}
    </div>
  )
}
