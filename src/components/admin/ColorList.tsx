'use client'

import React, { useState } from 'react'
import { logError } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { GripVertical, Edit2, Trash2, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmModal from '@/components/admin/ConfirmModal'
import styles from '@/app/admin/collections/[id]/colors/colors.module.css'

type Color = {
  id: string
  name: string
  slug: string
  status: 'draft' | 'published'
  display_order: number
  texture_image_url: string | null
  _count?: {
    installation_photos: number
  }
}

interface ColorListProps {
  initialColors: Color[]
  collectionId: string
}

export default function ColorList({ initialColors, collectionId }: ColorListProps) {
  const [colors, setColors] = useState<Color[]>(initialColors)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingColor, setDeletingColor] = useState<Color | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const handleStatusToggle = async (color: Color) => {
    const newStatus = color.status === 'draft' ? 'published' : 'draft'
    
    if (newStatus === 'published') {
      const { data: collection, error } = await supabase
        .schema('colorbook')
        .from('collections')
        .select('status')
        .eq('id', collectionId)
        .single()
        
      if (!error && collection?.status === 'draft') {
        alert("컬렉션이 아직 초안 상태입니다. 컬렉션을 먼저 공개해야 고객에게 보입니다.")
      }
    }
    
    setColors(colors.map(c => 
      c.id === color.id ? { ...c, status: newStatus } : c
    ))
    
    try {
      const { error } = await supabase
        .schema('colorbook')
        .from('colors')
        .update({ status: newStatus })
        .eq('id', color.id)
        
      if (error) throw error
      router.refresh()
    } catch (err) {
      logError('상태 변경 실패:', err)
      setColors(colors.map(c => 
        c.id === color.id ? { ...c, status: color.status } : c
      ))
      alert('상태 변경에 실패했습니다.')
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId === id) return
    setDragOverId(id)
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)
    
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }

    const draggedIndex = colors.findIndex(c => c.id === draggedId)
    const targetIndex = colors.findIndex(c => c.id === targetId)

    if (draggedIndex < 0 || targetIndex < 0) return

    // 순서 변경 로직
    const newColors = [...colors]
    const [draggedItem] = newColors.splice(draggedIndex, 1)
    newColors.splice(targetIndex, 0, draggedItem)

    // 낙관적 UI 업데이트
    const updatedColors = newColors.map((c, i) => ({
      ...c,
      display_order: i
    }))
    setColors(updatedColors)
    setDraggedId(null)

    // DB 업데이트
    try {
      const updates = updatedColors.map((c) => ({
        id: c.id,
        display_order: c.display_order
      }))
      
      for (const update of updates) {
        await supabase
          .schema('colorbook')
          .from('colors')
          .update({ display_order: update.display_order })
          .eq('id', update.id)
      }
      
      router.refresh()
    } catch (err) {
      logError('순서 변경 실패:', err)
      setColors(initialColors)
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  // 삭제 처리
  const handleDeleteConfirm = async () => {
    if (!deletingColor) return
    setIsDeleting(true)

    try {
      // 1. 텍스처 이미지 삭제
      if (deletingColor.texture_image_url) {
        const parts = deletingColor.texture_image_url.split('/colorbook-images/')
        if (parts.length > 1) {
          await supabase.storage.from('colorbook-images').remove([parts[1]])
        }
      }

      // 2. 시공사진 삭제
      const { data: photos } = await supabase
        .schema('colorbook')
        .from('installation_photos')
        .select('image_url')
        .eq('color_id', deletingColor.id)
        
      if (photos && photos.length > 0) {
        const photoPaths = photos.map(p => {
          const parts = p.image_url.split('/colorbook-images/')
          return parts.length > 1 ? parts[1] : null
        }).filter(Boolean) as string[]

        if (photoPaths.length > 0) {
          await supabase.storage.from('colorbook-images').remove(photoPaths)
        }
      }

      // 3. DB 데이터 삭제
      const { error } = await supabase
        .schema('colorbook')
        .from('colors')
        .delete()
        .eq('id', deletingColor.id)
        
      if (error) throw error
      
      setIsDeleteModalOpen(false)
      setDeletingColor(null)
      router.refresh()
      
      setColors(colors.filter(c => c.id !== deletingColor.id))
      
    } catch (err) {
      logError('삭제 중 오류 발생:', err)
      alert('삭제에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteModal = (color: Color) => {
    setDeletingColor(color)
    setIsDeleteModalOpen(true)
  }

  return (
    <>
      {colors.length === 0 ? (
        <div className={styles.emptyState}>
          <Palette size={48} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>아직 컬러가 없습니다</h2>
          <p className={styles.emptyText}>첫 번째 컬러를 추가하여 컬렉션을 완성해보세요.</p>
          <Link href={`/admin/collections/${collectionId}/colors/new`} className={styles.addBtn}>
            컬러 추가하기
          </Link>
        </div>
      ) : (
        <div className={styles.listContainer}>
          {colors.map((color) => (
            <div
              key={color.id}
              className={`${styles.listItem} ${draggedId === color.id ? styles.dragging : ''} ${dragOverId === color.id ? styles.dragOver : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, color.id)}
              onDragOver={(e) => handleDragOver(e, color.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, color.id)}
              onDragEnd={handleDragEnd}
            >
              <div className={styles.dragHandle}>
                <GripVertical size={20} />
              </div>
              
              {color.texture_image_url ? (
                <Image 
                  src={color.texture_image_url} 
                  alt={color.name} 
                  width={40} 
                  height={40} 
                  sizes="40px"
                  className={styles.thumbnail}
                />
              ) : (
                <div className={styles.thumbnailPlaceholder}>
                  <Palette size={20} />
                </div>
              )}
              
              <div className={styles.itemContent}>
                <h3 className={styles.itemName}>
                  {color.name}
                  <StatusBadge 
                    status={color.status} 
                    onClick={() => handleStatusToggle(color)} 
                  />
                </h3>
                <div className={styles.itemMeta}>
                  <span className={styles.itemSlug}>/{color.slug}</span>
                  <span>•</span>
                  <span>시공사진: {color._count?.installation_photos || 0}장</span>
                </div>
              </div>

              <div className={styles.itemActions}>
                <Link 
                  href={`/admin/collections/${collectionId}/colors/${color.id}`}
                  className={styles.actionBtn} 
                  title="수정"
                >
                  <Edit2 size={18} />
                </Link>
                <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => openDeleteModal(color)}
                  title="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="컬러 삭제"
        message={`'${deletingColor?.name}' 컬러를 정말 삭제하시겠습니까? 시공사진 ${deletingColor?._count?.installation_photos || 0}장도 함께 삭제되며 복구할 수 없습니다.`}
        confirmText="삭제하기"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDestructive={true}
        isLoading={isDeleting}
      />
    </>
  )
}
