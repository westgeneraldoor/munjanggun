'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Edit2, Trash2, FolderPlus, FilePlus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, ToggleLeft, ToggleRight } from 'lucide-react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmModal from '@/components/admin/ConfirmModal'
import NodeAddModal from '@/components/admin/NodeAddModal'
import styles from './NodeList.module.css'

type Node = {
  id: string
  parent_id: string | null
  type: string
  name: string
  slug: string
  status: string
  display_order: number
  image_url: string | null
}

export default function NodeList() {
  const [tabs, setTabs] = useState<Node[]>([])
  const [children, setChildren] = useState<Node[]>([])
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null)
  
  const [isLoadingTabs, setIsLoadingTabs] = useState(true)
  const [isLoadingChildren, setIsLoadingChildren] = useState(false)
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addModalParentId, setAddModalParentId] = useState<string | null>(null)
  const [addModalOrder, setAddModalOrder] = useState(0)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingNode, setDeletingNode] = useState<Node | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const router = useRouter()
  const supabase = createShowroomClient()

  const fetchTabs = async () => {
    setIsLoadingTabs(true)
    try {
      const { data, error } = await supabase
        .schema('showroom')
        .from('nodes')
        .select('*')
        .is('parent_id', null)
        .order('display_order')

      if (error) throw error
      
      setTabs(data || [])
      
      if (data && data.length > 0 && !selectedTabId) {
        setSelectedTabId(data[0].id)
      } else if (!data || data.length === 0) {
        setSelectedTabId(null)
      }
    } catch (err) {
      logError('탭 로딩 실패:', err)
    } finally {
      setIsLoadingTabs(false)
    }
  }

  const fetchChildren = async (parentId: string) => {
    setIsLoadingChildren(true)
    try {
      const { data, error } = await supabase
        .schema('showroom')
        .from('nodes')
        .select('*')
        .eq('parent_id', parentId)
        .order('display_order')

      if (error) throw error
      
      setChildren(data || [])
    } catch (err) {
      logError('자식 노드 로딩 실패:', err)
    } finally {
      setIsLoadingChildren(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTabs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedTabId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchChildren(selectedTabId)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChildren([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTabId])

  const handleStatusToggle = async (node: Node) => {
    const newStatus = node.status === 'draft' ? 'published' : 'draft'
    
    // Optimistic UI update
    if (node.parent_id === null) {
      setTabs(tabs.map(t => t.id === node.id ? { ...t, status: newStatus } : t))
    } else {
      setChildren(children.map(c => c.id === node.id ? { ...c, status: newStatus } : c))
    }

    try {
      const { error } = await supabase
        .schema('showroom')
        .from('nodes')
        .update({ status: newStatus })
        .eq('id', node.id)

      if (error) throw error
      router.refresh()
    } catch (err) {
      logError('상태 변경 실패:', err)
      // Revert Optimistic UI
      if (node.parent_id === null) {
        setTabs(tabs.map(t => t.id === node.id ? { ...t, status: node.status } : t))
      } else {
        setChildren(children.map(c => c.id === node.id ? { ...c, status: node.status } : c))
      }
      alert('상태 변경에 실패했습니다.')
    }
  }

  const handleOrderChange = async (index: number, direction: 'up' | 'down', list: Node[], isTab: boolean) => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === list.length - 1)
    ) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newList = [...list]
    const temp = newList[index]
    newList[index] = newList[newIndex]
    newList[newIndex] = temp

    // Update orders
    const updatedList = newList.map((item, i) => ({ ...item, display_order: i }))

    // Optimistic update
    if (isTab) {
      setTabs(updatedList)
    } else {
      setChildren(updatedList)
    }

    try {
      // Update in DB
      for (const item of updatedList) {
        await supabase
          .schema('showroom')
          .from('nodes')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
      }
    } catch (err) {
      logError('순서 변경 실패:', err)
      alert('순서 변경에 실패했습니다.')
      // Revert on error
      if (isTab) fetchTabs()
      else if (selectedTabId) fetchChildren(selectedTabId)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingNode) return
    setIsDeleting(true)

    try {
      // Note: In Supabase, if we set up foreign keys with ON DELETE CASCADE,
      // deleting a node will automatically delete its children, hero_media, gallery_photos, etc.
      // Assuming ON DELETE CASCADE is set.
      
      // We should ideally delete images from storage too if they exist.
      // But for simplicity in this order, we just delete the node record.
      const { error } = await supabase
        .schema('showroom')
        .from('nodes')
        .delete()
        .eq('id', deletingNode.id)

      if (error) throw error

      if (deletingNode.parent_id === null) {
        // We deleted a tab
        if (selectedTabId === deletingNode.id) {
          setSelectedTabId(null)
        }
        await fetchTabs()
      } else {
        // We deleted a child
        if (selectedTabId) {
          await fetchChildren(selectedTabId)
        }
      }

      setIsDeleteModalOpen(false)
      setDeletingNode(null)
      router.refresh()
    } catch (err) {
      logError('노드 삭제 실패:', err)
      alert('노드 삭제에 실패했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddTab = () => {
    setAddModalParentId(null)
    setAddModalOrder(tabs.length)
    setIsAddModalOpen(true)
  }

  const handleAddChild = () => {
    if (!selectedTabId) return
    setAddModalParentId(selectedTabId)
    setAddModalOrder(children.length)
    setIsAddModalOpen(true)
  }

  const handleAddSuccess = () => {
    if (addModalParentId === null) {
      fetchTabs()
    } else {
      fetchChildren(addModalParentId)
    }
    router.refresh()
  }

  if (isLoadingTabs) {
    return <div className={styles.loadingState}>로딩 중...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>노드 관리</h1>
      </div>

      <div className={styles.tabsContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${selectedTabId === tab.id ? styles.active : ''}`}
            onClick={() => setSelectedTabId(tab.id)}
          >
            {tab.name}
            {tab.status === 'draft' && ' (초안)'}
          </button>
        ))}
        <button className={styles.tabAddBtn} onClick={handleAddTab} title="탭 추가">
          <FolderPlus size={18} /> 탭 추가
        </button>
      </div>

      {/* 선택된 탭 관리 액션 바 */}
      {selectedTabId && (() => {
        const selectedTab = tabs.find(t => t.id === selectedTabId)
        const selectedIndex = tabs.findIndex(t => t.id === selectedTabId)
        if (!selectedTab) return null
        return (
          <div className={styles.tabActionBar}>
            <span className={styles.tabActionLabel}>탭: <strong>{selectedTab.name}</strong></span>
            <div className={styles.tabActionButtons}>
              <button
                className={styles.tabActionBtn}
                onClick={() => handleOrderChange(selectedIndex, 'up', tabs, true)}
                disabled={selectedIndex === 0}
                title="왼쪽으로"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className={styles.tabActionBtn}
                onClick={() => handleOrderChange(selectedIndex, 'down', tabs, true)}
                disabled={selectedIndex === tabs.length - 1}
                title="오른쪽으로"
              >
                <ChevronRight size={16} />
              </button>
              <button
                className={styles.tabActionBtn}
                onClick={() => handleStatusToggle(selectedTab)}
                title={selectedTab.status === 'draft' ? '공개하기' : '초안으로'}
              >
                {selectedTab.status === 'draft' ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                <span>{selectedTab.status === 'draft' ? '공개' : '초안'}</span>
              </button>
              <Link
                href={`/admin/nodes/${selectedTab.id}`}
                className={styles.tabActionBtn}
                title="편집"
              >
                <Edit2 size={16} />
                <span>편집</span>
              </Link>
              <button
                className={`${styles.tabActionBtn} ${styles.tabDeleteBtn}`}
                onClick={() => {
                  setDeletingNode(selectedTab)
                  setIsDeleteModalOpen(true)
                }}
                title="삭제"
              >
                <Trash2 size={16} />
                <span>삭제</span>
              </button>
            </div>
          </div>
        )
      })()}

      {tabs.length > 0 && selectedTabId && (
        <div className={styles.listContainer}>
          <div className={styles.header} style={{ marginBottom: '8px' }}>
            <h2 className={styles.title} style={{ fontSize: '18px' }}>자식 노드 목록</h2>
            <button className={styles.addBtn} onClick={handleAddChild}>
              <FilePlus size={18} />
              <span>자식 노드 추가</span>
            </button>
          </div>

          {isLoadingChildren ? (
            <div className={styles.loadingState}>자식 노드 로딩 중...</div>
          ) : children.length === 0 ? (
            <div className={styles.emptyState}>
              <FilePlus size={48} className={styles.emptyIcon} />
              <h2 className={styles.emptyTitle}>자식 노드가 없습니다</h2>
              <p className={styles.emptyText}>하위 카테고리나 상세 페이지를 추가해보세요.</p>
              <button className={styles.addBtn} onClick={handleAddChild}>
                자식 노드 추가하기
              </button>
            </div>
          ) : (
            children.map((child, index) => (
              <div key={child.id} className={styles.listItem}>
                <div className={styles.orderControls}>
                  <button 
                    className={styles.orderBtn} 
                    onClick={() => handleOrderChange(index, 'up', children, false)}
                    disabled={index === 0}
                  >
                    <ChevronUp size={20} />
                  </button>
                  <button 
                    className={styles.orderBtn} 
                    onClick={() => handleOrderChange(index, 'down', children, false)}
                    disabled={index === children.length - 1}
                  >
                    <ChevronDown size={20} />
                  </button>
                </div>
                
                {child.image_url ? (
                  <Image src={child.image_url} alt={child.name} width={40} height={40} style={{ borderRadius: 4, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: 'var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)' }}>
                    <ImageIcon size={20} />
                  </div>
                )}
                
                <div className={styles.itemContent}>
                  <h3 className={styles.itemName}>
                    <Link href={`/admin/nodes/${child.id}`} className={styles.itemLink}>
                      {child.name}
                    </Link>
                    <span className={styles.nodeTypeBadge}>{child.type}</span>
                    <StatusBadge 
                      status={child.status as 'draft' | 'published'} 
                      onClick={() => handleStatusToggle(child)} 
                    />
                  </h3>
                  <div className={styles.itemMeta}>
                    <span className={styles.itemSlug}>/{child.slug}</span>
                  </div>
                </div>

                <div className={styles.itemActions}>
                  <Link 
                    href={`/admin/nodes/${child.id}`}
                    className={styles.actionBtn}
                    title="편집"
                  >
                    <Edit2 size={18} />
                  </Link>
                  <button 
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => {
                      setDeletingNode(child)
                      setIsDeleteModalOpen(true)
                    }}
                    title="삭제"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tabs.length === 0 && (
        <div className={styles.emptyState}>
          <FolderPlus size={48} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>생성된 탭이 없습니다</h2>
          <p className={styles.emptyText}>최상위 카테고리(탭)를 먼저 추가해주세요.</p>
        </div>
      )}

      <NodeAddModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
        parentId={addModalParentId}
        displayOrder={addModalOrder}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="노드 삭제"
        message={`'${deletingNode?.name}' 노드를 정말 삭제하시겠습니까? 하위 노드가 있다면 모두 함께 삭제되며 복구할 수 없습니다.`}
        confirmText="삭제하기"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  )
}
