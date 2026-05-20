'use client'

import React, { useState, useRef } from 'react'
import { logError } from '@/lib/logger'
import Image from 'next/image'
import { UploadCloud, X, Edit2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './ImageUploader.module.css'

interface ImageUploaderProps {
  bucketName?: string
  folderPath: string
  onUploadComplete: (url: string) => void
  currentImageUrl?: string
  maxSizeMB?: number
  acceptTypes?: string
  onDelete?: () => void
  multiple?: boolean
  onMultiUploadComplete?: (urls: string[]) => void
  onUploadReplace?: (oldUrl: string, newUrl: string) => void  // blob→실제URL 교체용
  compressionMaxDimension?: number   // 압축 최대 크기 (px)
  compressionQuality?: number        // JPEG 품질 (0~1)
}

export default function ImageUploader({
  bucketName = 'showroom-images',
  folderPath,
  onUploadComplete,
  currentImageUrl,
  maxSizeMB = 10,
  acceptTypes = 'image/*',
  onDelete,
  multiple = false,
  onMultiUploadComplete,
  onUploadReplace,
  compressionMaxDimension = 1600,
  compressionQuality = 0.8
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 이미지 리사이즈 & 압축 (브라우저 메모리 절약 + 업로드 속도 개선)
  const compressImage = (file: File, maxDimension = 1600, quality = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      // 이미 작은 파일은 압축 불필요 (500KB 이하)
      if (file.size <= 500 * 1024) {
        resolve(file)
        return
      }

      const img = document.createElement('img')
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)

        let { width, height } = img

        // 최대 치수 초과 시 비율 유지 리사이즈
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width))
            width = maxDimension
          } else {
            width = Math.round(width * (maxDimension / height))
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file) // canvas 실패 시 원본 반환
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        const mimeType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }
            const compressedFile = new File([blob], file.name, {
              type: mimeType,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          mimeType,
          quality
        )
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(file)
      }

      img.src = url
    })
  }

  // URL에서 파일명 추출하여 스토리지 경로 구하기
  const getStoragePathFromUrl = (url: string) => {
    try {
      const parts = url.split(`/${bucketName}/`)
      if (parts.length > 1) return parts[1]
      return null
    } catch {
      return null
    }
  }

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
    if (isUploading) return
    
    if (multiple) {
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) handleMultiFiles(files)
    } else {
      const file = e.dataTransfer.files[0]
      if (file) handleUpload(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    try {
      await handleMultiFiles(Array.from(files))
    } catch (err) {
      logError('Multi file change error:', err)
      setError(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.')
      setIsUploading(false)
      setProgress(0)
    }
  }

  const handleMultiFiles = async (files: File[]) => {
    if (isUploading) return
    
    setError(null)
    setIsUploading(true)
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
      setProgress(0)
    }, 500)
  }

  const uploadSingleFile = async (file: File): Promise<string | null> => {
    // 크기 검증
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`파일 크기는 ${maxSizeMB}MB를 초과할 수 없습니다.`)
    }

    try {
      // 업로드 전 이미지 압축 (prop으로 전달된 크기/품질 사용)
      const compressedFile = await compressImage(file, compressionMaxDimension, compressionQuality)

      // 파일명 충돌 방지: 타임스탬프_원래이름
      const timestamp = Date.now()
      let safeName = compressedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '')
      // 한글 등 비영문 파일명일 경우 safeName이 빈 문자열이 될 수 있음
      if (!safeName || safeName.startsWith('.')) {
        const ext = compressedFile.type.split('/')[1] || 'jpg'
        safeName = `upload_${timestamp.toString(36)}.${ext}`
      }
      const filePath = `${folderPath.replace(/\/$/, '')}/${timestamp}_${safeName}`
      const supabase = createClient()

      const { data, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Public URL 가져오기
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path)

      return publicUrlData.publicUrl
    } catch (err: unknown) {
      logError('Single upload error:', err)
      const message = err instanceof Error ? err.message : '알 수 없는 오류'
      throw new Error(`업로드 실패 (${file.name}): ${message}`)
    }
  }

  const handleUpload = async (file: File) => {
    setError(null)
    
    // 미리보기 설정 (로컬 Object URL)
    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)

    setIsUploading(true)
    setProgress(10)

    try {
      // 기존 이미지가 있다면 삭제 처리
      if (currentImageUrl) {
        const oldPath = getStoragePathFromUrl(currentImageUrl)
        if (oldPath) {
          const supabase = createClient()
          await supabase.storage.from(bucketName).remove([oldPath])
        }
      }

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
        setProgress(0)
      }, 500)
    }
  }

  const handleDeleteClick = async () => {
    if (currentImageUrl) {
      try {
        const path = getStoragePathFromUrl(currentImageUrl)
        if (path) {
          const supabase = createClient()
          await supabase.storage.from(bucketName).remove([path])
        }
      } catch (err) {
        logError('삭제 실패', err)
      }
    }
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (onDelete) onDelete()
  }

  const triggerSelect = () => {
    if (isUploading) return
    fileInputRef.current?.click()
  }

  const displayUrl = previewUrl || currentImageUrl

  return (
    <div className={styles.uploader}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={multiple ? handleMultiFileChange : handleFileChange}
        accept={acceptTypes}
        multiple={multiple}
        style={{ display: 'none' }}
      />
      
      {displayUrl ? (
        <div className={styles.previewContainer}>
          {previewUrl || displayUrl.startsWith('blob:') ? (
             // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl || displayUrl} alt="Preview" className={styles.previewImage} />
          ) : (
            <Image 
              src={displayUrl} 
              alt="Current image" 
              width={400} 
              height={300} 
              className={styles.previewImage}
              loading="lazy"
              unoptimized={true}
            />
          )}
          
          <div className={styles.previewActions}>
            <button 
              type="button" 
              className={styles.actionBtn} 
              onClick={triggerSelect}
              title="변경"
              disabled={isUploading}
            >
              <Edit2 size={16} />
            </button>
            <button 
              type="button" 
              className={`${styles.actionBtn} ${styles.deleteBtn}`} 
              onClick={handleDeleteClick}
              title="삭제"
              disabled={isUploading}
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
        <div 
          className={`${styles.dropzone} ${isDragging ? styles.dragActive : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerSelect}
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
        </div>
      )}
      
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  )
}
