'use client'

import React, { useState } from 'react'
import { logError } from '@/lib/logger'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GripVertical, Edit2, Trash2, FolderPlus, Palette } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmModal from '@/components/admin/ConfirmModal'
import CollectionForm from '@/components/admin/CollectionForm'
import styles from '@/app/admin/collections/collections.module.css'

type Collection = {
  id: string
  name: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  status: 'draft' | 'published'
  display_order: number
  _count?: {
    colors: number
  }
}

interface CollectionListProps {
  initialCollections: Collection[]
}

export default function CollectionList({ initialCollections }: CollectionListProps) {
  const [collections, setCollections] = useState<Collection[]>(initialCollections)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  
  // 모달 상태 관리
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingCollection, setDeletingCollection] = useState<Collection | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const handleStatusToggle = async (collection: Collection) => {
    const newStatus = collection.status === 'draft' ? 'published' : 'draft'
    
    if (newStatus === 'published') {
      const { count, error } = await supabase
        .schema('colorbook')
        .from('colors')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', collection.id)
        .eq('status', 'published')
        
      if (!error && count === 0) {
        alert("공개 상태의 컬러가 없습니다. 먼저 컬러를 공개해주세요.")
      }
    }
    
    setCollections(collections.map(c => 
      c.id === collection.id ? { ...c, status: newStatus } : c
    ))
    
    try {
      const { error } = await supabase
        .schema('colorbook')
        .from('collections')
        .update({ status: newStatus })
        .eq('id', collection.id)
        
      if (error) throw error
      router.refresh()
    } catch (err) {
      logError('상태 변경 실패:', err)
      setCollections(collections.map(c => 
        c.id === collection.id ? { ...c, status: collection.status } : c
      ))
      alert('상태 변경에 실패했습니다.')
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    // 드래그 이미지 투명화 등 커스텀 가능
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

    const draggedIndex = collections.findIndex(c => c.id === draggedId)
    const targetIndex = collections.findIndex(c => c.id === targetId)

    if (draggedIndex < 0 || targetIndex < 0) return

    // 순서 변경 로직
    const newCollections = [...collections]
    const [draggedItem] = newCollections.splice(draggedIndex, 1)
    newCollections.splice(targetIndex, 0, draggedItem)

    // 낙관적 UI 업데이트
    const updatedCollections = newCollections.map((c, i) => ({
      ...c,
      display_order: i
    }))
    setCollections(updatedCollections)
    setDraggedId(null)

    // DB 업데이트
    try {
      const updates = updatedCollections.map((c) => ({
        id: c.id,
        display_order: c.display_order
      }))
      
      // 개별 UPDATE 실행 (RPC가 없으므로)
      for (const update of updates) {
        await supabase
          .schema('colorbook')
          .from('collections')
          .update({ display_order: update.display_order })
          .eq('id', update.id)
      }
      
      router.refresh()
    } catch (err) {
      logError('순서 변경 실패:', err)
      // 실패 시 원래 순서로 롤백
      setCollections(initialCollections)
    }
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  // 삭제 처리
  const handleDeleteConfirm = async () => {
    if (!deletingCollection) return
    setIsDeleting(true)

    try {
      // 1. 해당 컬렉션의 하위 컬러 ID들 가져오기
      const { data: colors } = await supabase
        .schema('colorbook')
        .from('colors')
        .select('id, texture_image_url')
        .eq('collection_id', deletingCollection.id)

      if (colors && colors.length > 0) {
        const colorIds = colors.map(c => c.id)
        
        // 2. Storage에서 텍스처 이미지 삭제
        const textureUrls = colors.filter(c => c.texture_image_url).map(c => c.texture_image_url!)
        // (참고: URL에서 path만 추출해서 삭제하는 로직 필요)
        // Storage 경로는 보통 bucket-name 뒤의 경로
        // 간단한 예제로 생략하거나, 경로 추출 로직 추가 가능
        const texturePaths = textureUrls.map(url => {
          const parts = url.split('/colorbook-images/')
          return parts.length > 1 ? parts[1] : null
        }).filter(Boolean) as string[]

        if (texturePaths.length > 0) {
          await supabase.storage.from('colorbook-images').remove(texturePaths)
        }

        // 3. 시공사진 이미지 삭제
        const { data: photos } = await supabase
          .schema('colorbook')
          .from('installation_photos')
          .select('image_url')
          .in('color_id', colorIds)
          
        if (photos && photos.length > 0) {
          const photoPaths = photos.map(p => {
            const parts = p.image_url.split('/colorbook-images/')
            return parts.length > 1 ? parts[1] : null
          }).filter(Boolean) as string[]

          if (photoPaths.length > 0) {
            await supabase.storage.from('colorbook-images').remove(photoPaths)
          }
        }
      }

      // 4. 컬렉션 썸네일 파일 삭제 (있다면)
      const { data: colData } = await supabase
        .schema('colorbook')
        .from('collections')
        .select('thumbnail_url')
        .eq('id', deletingCollection.id)
        .single()
        
      if (colData?.thumbnail_url) {
        const parts = colData.thumbnail_url.split('/colorbook-images/')
        if (parts.length > 1) {
          await supabase.storage.from('colorbook-images').remove([parts[1]])
        }
      }

      // 5. DB 데이터 삭제 (cascade가 걸려있다면 컬러/사진은 자동 삭제됨)
      const { error } = await supabase
        .schema('colorbook')
        .from('collections')
        .delete()
        .eq('id', deletingCollection.id)
        
      if (error) throw error
      
      // 성공 시 상태 업데이트 및 새로고침
      setIsDeleteModalOpen(false)
      setDeletingCollection(null)
      router.refresh()
      
      // 클라이언트 상태도 바로 반영
      setCollections(collections.filter(c => c.id !== deletingCollection.id))
      
    } catch (err) {
      logError('삭제 중 오류 발생:', err)
      alert('삭제에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeleteModal = (collection: Collection) => {
    setDeletingCollection(collection)
    setIsDeleteModalOpen(true)
  }

  const openAddForm = () => {
    setEditingCollection(null)
    setIsFormOpen(true)
  }

  const openEditForm = (collection: Collection) => {
    setEditingCollection(collection)
    setIsFormOpen(true)
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    router.refresh() // 서버에서 최신 데이터 다시 받아옴
    
    // 이펙트를 위해 페이지 새로고침 후 약간의 지연 후 상태 업데이트
    setTimeout(() => {
      // 페이지가 새로고침되면 props가 업데이트되므로 이 코드는 실행 안될 수도 있음
    }, 500)
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>컬렉션 관리</h1>
        <button className={styles.addBtn} onClick={openAddForm}>
          <FolderPlus size={20} />
          <span>컬렉션 추가</span>
        </button>
      </div>

      {collections.length === 0 ? (
        <div className={styles.emptyState}>
          <FolderPlus size={48} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>아직 컬렉션이 없습니다</h2>
          <p className={styles.emptyText}>첫 번째 컬렉션을 추가하여 컬러북을 구성해보세요.</p>
          <button className={styles.addBtn} onClick={openAddForm}>
            컬렉션 추가하기
          </button>
        </div>
      ) : (
        <div className={styles.listContainer}>
          {collections.map((collection) => (
            <div
              key={collection.id}
              className={`${styles.listItem} ${draggedId === collection.id ? styles.dragging : ''} ${dragOverId === collection.id ? styles.dragOver : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, collection.id)}
              onDragOver={(e) => handleDragOver(e, collection.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, collection.id)}
              onDragEnd={handleDragEnd}
            >
              <div className={styles.dragHandle}>
                <GripVertical size={20} />
              </div>
              
              <div className={styles.itemContent}>
                <h3 className={styles.itemName}>
                  <Link href={`/admin/collections/${collection.id}/colors`} className={styles.itemLink}>
                    {collection.name}
                  </Link>
                  <StatusBadge 
                    status={collection.status} 
                    onClick={() => handleStatusToggle(collection)} 
                  />
                </h3>
                <div className={styles.itemMeta}>
                  <span className={styles.itemSlug}>/{collection.slug}</span>
                  <span>•</span>
                  <span>하위 컬러: {collection._count?.colors || 0}개</span>
                </div>
              </div>

              <div className={styles.itemActions}>
                <Link 
                  href={`/admin/collections/${collection.id}/colors`}
                  className={styles.actionBtn}
                  title="컬러 관리"
                >
                  <Palette size={18} />
                </Link>
                <button 
                  className={styles.actionBtn} 
                  onClick={() => openEditForm(collection)}
                  title="수정"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => openDeleteModal(collection)}
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
        title="컬렉션 삭제"
        message={`'${deletingCollection?.name}' 컬렉션을 정말 삭제하시겠습니까? 하위 컬러 ${deletingCollection?._count?.colors || 0}개도 함께 삭제되며 복구할 수 없습니다.`}
        confirmText="삭제하기"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDestructive={true}
        isLoading={isDeleting}
      />

      {isFormOpen && (
        <CollectionForm
          initialData={editingCollection}
          displayOrder={editingCollection ? undefined : collections.length}
          onSuccess={handleFormSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}
    </>
  )
}
