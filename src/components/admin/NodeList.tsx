'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Edit2, Trash2, FolderPlus, FilePlus, ChevronUp, ChevronDown, Image as ImageIcon, FolderInput, Copy } from 'lucide-react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmModal from '@/components/admin/ConfirmModal'
import NodeAddModal from '@/components/admin/NodeAddModal'
import NodeMoveModal from '@/components/admin/NodeMoveModal'
import NodeCopyModal from '@/components/admin/NodeCopyModal'
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
  const [currentParentId, setCurrentParentId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('admin_nodes_parentId')
      return saved ? JSON.parse(saved) : null
    }
    return null
  })
  const [nodes, setNodes] = useState<Node[]>([])
  const [breadcrumb, setBreadcrumb] = useState<{id: string, name: string}[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('admin_nodes_breadcrumb')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_nodes_parentId', JSON.stringify(currentParentId))
      sessionStorage.setItem('admin_nodes_breadcrumb', JSON.stringify(breadcrumb))
    }
  }, [currentParentId, breadcrumb])
  const [isLoading, setIsLoading] = useState(true)
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addModalParentId, setAddModalParentId] = useState<string | null>(null)
  const [addModalOrder, setAddModalOrder] = useState(0)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingNode, setDeletingNode] = useState<Node | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [movingNode, setMovingNode] = useState<Node | null>(null)

  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [copyingNode, setCopyingNode] = useState<Node | null>(null)

  const router = useRouter()
  const supabase = createShowroomClient()

  const fetchNodes = async (parentId: string | null) => {
    setIsLoading(true)
    try {
      let query = supabase
        .schema('showroom')
        .from('nodes')
        .select('*')
        .order('display_order')

      if (parentId === null) {
        query = query.is('parent_id', null)
      } else {
        query = query.eq('parent_id', parentId)
      }

      const { data, error } = await query
      if (error) throw error
      setNodes(data || [])
    } catch (err) {
      logError('노드 로딩 실패:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNodes(currentParentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParentId])

  const handleDrillDown = (node: Node) => {
    if (node.type !== 'listing') return
    setBreadcrumb(prev => [...prev, { id: node.id, name: node.name }])
    setCurrentParentId(node.id)
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setBreadcrumb([])
      setCurrentParentId(null)
    } else {
      const target = breadcrumb[index]
      setBreadcrumb(prev => prev.slice(0, index + 1))
      setCurrentParentId(target.id)
    }
  }

  const handleStatusToggle = async (node: Node) => {
    const newStatus = node.status === 'draft' ? 'published' : 'draft'
    
    // Optimistic UI update
    setNodes(nodes.map(n => n.id === node.id ? { ...n, status: newStatus } : n))

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
      setNodes(nodes.map(n => n.id === node.id ? { ...n, status: node.status } : n))
      alert('상태 변경에 실패했습니다.')
    }
  }

  const handleOrderChange = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === nodes.length - 1)
    ) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newList = [...nodes]
    const temp = newList[index]
    newList[index] = newList[newIndex]
    newList[newIndex] = temp

    // Update orders
    const updatedList = newList.map((item, i) => ({ ...item, display_order: i }))

    // Optimistic update
    setNodes(updatedList)

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
      fetchNodes(currentParentId)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingNode) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .schema('showroom')
        .from('nodes')
        .delete()
        .eq('id', deletingNode.id)

      if (error) throw error

      await fetchNodes(currentParentId)

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

  const handleAddNode = () => {
    setAddModalParentId(currentParentId)
    setAddModalOrder(nodes.length)
    setIsAddModalOpen(true)
  }

  const handleAddSuccess = () => {
    fetchNodes(currentParentId)
    router.refresh()
  }

  const handleMoveSuccess = () => {
    fetchNodes(currentParentId)
    setIsMoveModalOpen(false)
    setMovingNode(null)
    router.refresh()
  }

  const handleCopySuccess = () => {
    fetchNodes(currentParentId)
    setIsCopyModalOpen(false)
    setCopyingNode(null)
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>노드 관리</h1>
      </div>

      <div className={styles.breadcrumb}>
        <button 
          className={`${styles.breadcrumbItem} ${breadcrumb.length === 0 ? styles.breadcrumbCurrent : ''}`}
          onClick={() => handleBreadcrumbClick(-1)}
        >
          🏠 홈
        </button>
        {breadcrumb.map((item, index) => (
          <React.Fragment key={item.id}>
            <span className={styles.breadcrumbSeparator}>/</span>
            <button
              className={`${styles.breadcrumbItem} ${index === breadcrumb.length - 1 ? styles.breadcrumbCurrent : ''}`}
              onClick={() => handleBreadcrumbClick(index)}
            >
              {item.name}
            </button>
            {index === breadcrumb.length - 1 && (
              <Link href={`/admin/nodes/${item.id}`} className={styles.breadcrumbEdit} title="편집">
                <Edit2 size={14} />
              </Link>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className={styles.header} style={{ marginBottom: '8px' }}>
        <h2 className={styles.title} style={{ fontSize: '18px' }}>
          {breadcrumb.length > 0 ? `${breadcrumb[breadcrumb.length - 1].name}의 하위 노드` : '최상위 노드'}
        </h2>
        <button className={styles.addBtn} onClick={handleAddNode}>
          <FilePlus size={18} />
          <span>노드 추가</span>
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loadingState}>로딩 중...</div>
      ) : nodes.length === 0 ? (
        <div className={styles.emptyState}>
          <FolderPlus size={48} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>노드가 없습니다</h2>
          <p className={styles.emptyText}>
            {breadcrumb.length > 0 ? '하위 노드를 추가해보세요.' : '최상위 노드(탭)를 추가해주세요.'}
          </p>
          <button className={styles.addBtn} onClick={handleAddNode}>
            노드 추가하기
          </button>
        </div>
      ) : (
        <div className={styles.listContainer}>
          {nodes.map((node, index) => (
            <div key={node.id} className={styles.listItem}>
              <div className={styles.orderControls}>
                <button 
                  className={styles.orderBtn} 
                  onClick={() => handleOrderChange(index, 'up')}
                  disabled={index === 0}
                >
                  <ChevronUp size={20} />
                </button>
                <button 
                  className={styles.orderBtn} 
                  onClick={() => handleOrderChange(index, 'down')}
                  disabled={index === nodes.length - 1}
                >
                  <ChevronDown size={20} />
                </button>
              </div>
              
              {node.image_url ? (
                <Image src={node.image_url} alt={node.name} width={40} height={40} style={{ borderRadius: 4, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 4, backgroundColor: 'var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)' }}>
                  <ImageIcon size={20} />
                </div>
              )}
              
              <div className={styles.itemContent}>
                <h3 className={styles.itemName}>
                  {node.type === 'listing' ? (
                    <button className={styles.drillDownBtn} onClick={() => handleDrillDown(node)}>
                      📁 {node.name}
                    </button>
                  ) : (
                    <Link href={`/admin/nodes/${node.id}`} className={styles.itemLink}>
                      {node.name}
                    </Link>
                  )}
                  <span className={styles.nodeTypeBadge}>{node.type}</span>
                  <StatusBadge status={node.status as 'draft' | 'published'} onClick={() => handleStatusToggle(node)} />
                </h3>
                <div className={styles.itemMeta}>
                  <span className={styles.itemSlug}>/{node.slug}</span>
                </div>
              </div>

              <div className={styles.itemActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => {
                    setCopyingNode(node)
                    setIsCopyModalOpen(true)
                  }}
                  title="복사"
                >
                  <Copy size={18} />
                </button>
                <button 
                  className={styles.actionBtn}
                  onClick={() => {
                    setMovingNode(node)
                    setIsMoveModalOpen(true)
                  }}
                  title="이동"
                >
                  <FolderInput size={18} />
                </button>
                <Link 
                  href={`/admin/nodes/${node.id}`}
                  className={styles.actionBtn}
                  title="편집"
                >
                  <Edit2 size={18} />
                </Link>
                <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => {
                    setDeletingNode(node)
                    setIsDeleteModalOpen(true)
                  }}
                  title="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
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

      <NodeMoveModal
        isOpen={isMoveModalOpen}
        node={movingNode}
        onClose={() => setIsMoveModalOpen(false)}
        onSuccess={handleMoveSuccess}
      />

      <NodeCopyModal
        isOpen={isCopyModalOpen}
        node={copyingNode}
        onClose={() => {
          setIsCopyModalOpen(false)
          setCopyingNode(null)
        }}
        onSuccess={handleCopySuccess}
      />
    </div>
  )
}
