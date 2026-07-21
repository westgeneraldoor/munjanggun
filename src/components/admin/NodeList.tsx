'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  FilePlus,
  FolderInput,
  FolderPlus,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
import ConfirmModal from '@/components/admin/ConfirmModal'
import NodeAddModal from '@/components/admin/NodeAddModal'
import NodeMoveModal from '@/components/admin/NodeMoveModal'
import {
  PlatformButton,
  PlatformIconButton,
  PlatformLinkButton,
  PlatformPageHeader,
  PlatformStatePanel,
  PlatformStatusBadge,
} from '@/components/platform/ui'
import styles from './NodeList.module.css'

type Node = {
  id: string
  parent_id: string | null
  type: string
  name: string
  slug: string
  status: 'draft' | 'published'
  display_order: number
  image_url: string | null
}

type BreadcrumbItem = { id: string; name: string }
type ReorderNodesRpc = (
  functionName: 'reorder_nodes',
  args: { p_parent_id: string | null; p_ordered_node_ids: string[] },
) => PromiseLike<{ data: number | null; error: unknown }>
type ReorderNodesSchemaClient = { rpc: ReorderNodesRpc }

function readSessionNavigation(): { parentId: string | null; breadcrumb: BreadcrumbItem[] } {
  try {
    const storedParent = JSON.parse(sessionStorage.getItem('admin_nodes_parentId') ?? 'null') as unknown
    const storedBreadcrumb = JSON.parse(sessionStorage.getItem('admin_nodes_breadcrumb') ?? '[]') as unknown
    if (!Array.isArray(storedBreadcrumb)) throw new Error('breadcrumb must be an array')
    const breadcrumb = storedBreadcrumb.filter((item): item is BreadcrumbItem => (
      typeof item === 'object'
      && item !== null
      && typeof (item as BreadcrumbItem).id === 'string'
      && typeof (item as BreadcrumbItem).name === 'string'
    ))
    const expectedParent = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null
    if (storedParent !== expectedParent) return { parentId: null, breadcrumb: [] }
    return { parentId: expectedParent, breadcrumb }
  } catch {
    return { parentId: null, breadcrumb: [] }
  }
}

export default function NodeList() {
  const [currentParentId, setCurrentParentId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [isSessionRestored, setIsSessionRestored] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addModalParentId, setAddModalParentId] = useState<string | null>(null)
  const [addModalOrder, setAddModalOrder] = useState(0)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingNode, setDeletingNode] = useState<Node | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [movingNode, setMovingNode] = useState<Node | null>(null)

  const router = useRouter()
  const supabase = useMemo(() => createShowroomClient(), [])
  const fetchRequestRef = useRef(0)
  const currentParentRef = useRef<string | null>(null)

  useEffect(() => {
    currentParentRef.current = currentParentId
  }, [currentParentId])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const saved = readSessionNavigation()
      setCurrentParentId(saved.parentId)
      setBreadcrumb(saved.breadcrumb)
      setIsSessionRestored(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isSessionRestored) return
    try {
      sessionStorage.setItem('admin_nodes_parentId', JSON.stringify(currentParentId))
      sessionStorage.setItem('admin_nodes_breadcrumb', JSON.stringify(breadcrumb))
    } catch (error) {
      logError('노드 탐색 위치 저장 실패:', error)
    }
  }, [breadcrumb, currentParentId, isSessionRestored])

  const fetchNodes = useCallback(async (parentId: string | null) => {
    const requestId = ++fetchRequestRef.current
    setIsLoading(true)
    setLoadError(null)
    setNodes([])

    try {
      let query = supabase
        .schema('showroom')
        .from('nodes')
        .select('*')
        .order('display_order')

      query = parentId === null
        ? query.is('parent_id', null)
        : query.eq('parent_id', parentId)

      const { data, error } = await query
      if (error) throw error
      if (requestId !== fetchRequestRef.current) return
      setNodes((data ?? []) as Node[])
    } catch (error) {
      if (requestId !== fetchRequestRef.current) return
      logError('노드 로딩 실패:', error)
      setLoadError('노드 목록을 불러오지 못했습니다.')
    } finally {
      if (requestId === fetchRequestRef.current) setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (!isSessionRestored) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) void fetchNodes(currentParentId)
    })
    return () => {
      cancelled = true
    }
  }, [currentParentId, fetchNodes, isSessionRestored])

  const handleDrillDown = (node: Node) => {
    if (node.type !== 'listing') return
    setBreadcrumb(previous => [...previous, { id: node.id, name: node.name }])
    setCurrentParentId(node.id)
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setBreadcrumb([])
      setCurrentParentId(null)
      return
    }
    const target = breadcrumb[index]
    setBreadcrumb(previous => previous.slice(0, index + 1))
    setCurrentParentId(target.id)
  }

  const handleStatusToggle = async (node: Node) => {
    if (isReordering) return
    const newStatus = node.status === 'draft' ? 'published' : 'draft'
    setMutationError(null)
    setStatusUpdatingId(node.id)
    setNodes(previous => previous.map(item => item.id === node.id ? { ...item, status: newStatus } : item))

    try {
      const { data, error } = await supabase
        .schema('showroom')
        .from('nodes')
        .update({ status: newStatus })
        .eq('id', node.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('status update affected no rows')
      router.refresh()
    } catch (error) {
      logError('상태 변경 실패:', error)
      setNodes(previous => previous.map(item => item.id === node.id ? { ...item, status: node.status } : item))
      setMutationError('상태 변경을 저장하지 못했습니다. 원래 상태로 되돌렸습니다.')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const handleOrderChange = async (index: number, direction: 'up' | 'down') => {
    if (statusUpdatingId !== null || isDeleting) return
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === nodes.length - 1)) return

    const parentAtStart = currentParentId
    const previousNodes = nodes
    const previousDisplayOrder = new Map(previousNodes.map(item => [item.id, item.display_order]))
    const newIndex = direction === 'up' ? index - 1 : index + 1
    const reordered = [...previousNodes]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]
    const updated = reordered.map((item, displayOrder) => ({ ...item, display_order: displayOrder }))
    setMutationError(null)
    setNodes(updated)
    setIsReordering(true)

    try {
      const reorderClient = supabase.schema('showroom') as unknown as ReorderNodesSchemaClient
      const { data, error } = await reorderClient.rpc('reorder_nodes', {
          p_parent_id: parentAtStart,
          p_ordered_node_ids: updated.map(item => item.id),
      })
      if (error) throw error
      if (data !== updated.length) throw new Error('node reorder affected an unexpected row count')
    } catch (error) {
      logError('순서 변경 실패:', error)
      if (currentParentRef.current === parentAtStart) {
        setNodes(current => current
          .map(item => previousDisplayOrder.has(item.id)
            ? { ...item, display_order: previousDisplayOrder.get(item.id)! }
            : item)
          .sort((left, right) => left.display_order - right.display_order))
      }
      setMutationError('순서 변경을 저장하지 못했습니다. 원래 순서로 되돌렸습니다.')
    } finally {
      setIsReordering(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingNode) return
    setMutationError(null)
    setIsDeleting(true)
    try {
      const { data, error } = await supabase
        .schema('showroom')
        .from('nodes')
        .delete()
        .eq('id', deletingNode.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('node delete affected no rows')
      await fetchNodes(currentParentId)
      setIsDeleteModalOpen(false)
      setDeletingNode(null)
      router.refresh()
    } catch (error) {
      logError('노드 삭제 실패:', error)
      setMutationError('노드를 삭제하지 못했습니다. 목록을 확인한 뒤 다시 시도해 주세요.')
      setIsDeleteModalOpen(false)
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
    void fetchNodes(currentParentId)
    router.refresh()
  }

  const handleMoveSuccess = () => {
    void fetchNodes(currentParentId)
    setIsMoveModalOpen(false)
    setMovingNode(null)
    router.refresh()
  }

  const currentLabel = breadcrumb.length > 0
    ? `${breadcrumb[breadcrumb.length - 1].name}의 하위 노드`
    : '최상위 노드'
  const isListMutationBusy = isReordering || statusUpdatingId !== null || isDeleting

  return (
    <div className={styles.container} data-admin-node-list>
      <PlatformPageHeader
        title="노드 관리"
        description="쇼룸의 탐색 구조, 공개 상태와 표시 순서를 관리합니다."
      />

      <nav className={styles.breadcrumb} aria-label="노드 위치">
        <PlatformButton
          type="button"
          variant="ghost"
          size="sm"
          className={styles.breadcrumbButton}
          onClick={() => handleBreadcrumbClick(-1)}
          disabled={isReordering || breadcrumb.length === 0}
          aria-current={breadcrumb.length === 0 ? 'page' : undefined}
        >
          홈
        </PlatformButton>
        {breadcrumb.map((item, index) => {
          const isCurrent = index === breadcrumb.length - 1
          return (
            <React.Fragment key={item.id}>
              <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>
              <PlatformButton
                type="button"
                variant="ghost"
                size="sm"
                className={styles.breadcrumbButton}
                onClick={() => handleBreadcrumbClick(index)}
                disabled={isReordering || isCurrent}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {item.name}
              </PlatformButton>
              {isCurrent ? (
                <PlatformLinkButton
                  href={`/admin/nodes/${item.id}`}
                  variant="ghost"
                  size="sm"
                  className={styles.actionLink}
                  aria-label={`${item.name} 편집`}
                >
                  <Edit2 aria-hidden="true" />
                </PlatformLinkButton>
              ) : null}
            </React.Fragment>
          )
        })}
      </nav>

      <div className={styles.sectionHeader}>
        <h2>{currentLabel}</h2>
        <PlatformButton type="button" onClick={handleAddNode} disabled={isListMutationBusy}>
          <FilePlus aria-hidden="true" />
          노드 추가
        </PlatformButton>
      </div>

      {mutationError ? (
        <PlatformStatePanel
          tone="error"
          title="변경사항을 저장하지 못했습니다"
          description={mutationError}
          action={(
            <PlatformButton type="button" variant="secondary" onClick={() => setMutationError(null)}>
              알림 닫기
            </PlatformButton>
          )}
        />
      ) : null}

      {!isSessionRestored || isLoading ? (
        <PlatformStatePanel
          tone="loading"
          title="노드를 불러오는 중입니다"
          description="현재 위치의 노드 목록을 확인하고 있습니다."
        />
      ) : loadError ? (
        <PlatformStatePanel
          tone="error"
          title={loadError}
          description="연결 상태를 확인한 뒤 다시 시도해 주세요."
          action={(
            <PlatformButton type="button" variant="secondary" onClick={() => void fetchNodes(currentParentId)}>
              다시 시도
            </PlatformButton>
          )}
        />
      ) : nodes.length === 0 ? (
        <PlatformStatePanel
          tone="empty"
          title="노드가 없습니다"
          description={breadcrumb.length > 0 ? '이 위치에 하위 노드를 추가해 보세요.' : '최상위 노드(탭)를 추가해 주세요.'}
          icon={<FolderPlus />}
          action={(
            <PlatformButton type="button" onClick={handleAddNode}>노드 추가하기</PlatformButton>
          )}
        />
      ) : (
        <div className={styles.listContainer} role="list" aria-label={currentLabel}>
          {nodes.map((node, index) => (
            <article key={node.id} className={styles.listItem} role="listitem">
              <div className={styles.orderControls} aria-label={`${node.name} 표시 순서`}>
                <PlatformIconButton
                  type="button"
                  variant="ghost"
                  aria-label={`${node.name} 위로 이동`}
                  onClick={() => void handleOrderChange(index, 'up')}
                    disabled={isListMutationBusy || index === 0}
                >
                  <ChevronUp aria-hidden="true" />
                </PlatformIconButton>
                <PlatformIconButton
                  type="button"
                  variant="ghost"
                  aria-label={`${node.name} 아래로 이동`}
                  onClick={() => void handleOrderChange(index, 'down')}
                    disabled={isListMutationBusy || index === nodes.length - 1}
                >
                  <ChevronDown aria-hidden="true" />
                </PlatformIconButton>
              </div>

              {node.image_url ? (
                <Image className={styles.thumbnail} src={node.image_url} alt={`${node.name} 대표 이미지`} width={48} height={48} />
              ) : (
                <div className={styles.thumbnailPlaceholder} aria-hidden="true">
                  <ImageIcon />
                </div>
              )}

              <div className={styles.itemContent}>
                <div className={styles.itemNameRow}>
                  {node.type === 'listing' ? (
                    <PlatformButton type="button" variant="ghost" size="sm" onClick={() => handleDrillDown(node)} disabled={isListMutationBusy}>
                      {node.name}
                    </PlatformButton>
                  ) : (
                    <PlatformLinkButton href={`/admin/nodes/${node.id}`} variant="ghost" size="sm">
                      {node.name}
                    </PlatformLinkButton>
                  )}
                  <PlatformStatusBadge tone={node.type === 'listing' ? 'info' : 'neutral'}>{node.type}</PlatformStatusBadge>
                  <PlatformButton
                    type="button"
                    variant={node.status === 'published' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => void handleStatusToggle(node)}
                    isLoading={statusUpdatingId === node.id}
                    loadingLabel="변경 중"
                    disabled={isReordering || (statusUpdatingId !== null && statusUpdatingId !== node.id)}
                    aria-label={`상태: ${node.status === 'published' ? '공개' : '초안'}. ${node.status === 'published' ? '초안으로 변경' : '공개로 변경'}`}
                  >
                    {node.status === 'published' ? '공개' : '초안'}
                  </PlatformButton>
                </div>
                <p className={styles.itemSlug}>/{node.slug}</p>
              </div>

              <div className={styles.itemActions}>
                <PlatformIconButton
                  type="button"
                  variant="ghost"
                  aria-label={`${node.name} 이동`}
                  disabled={isListMutationBusy}
                  onClick={() => {
                    setMovingNode(node)
                    setIsMoveModalOpen(true)
                  }}
                >
                  <FolderInput aria-hidden="true" />
                </PlatformIconButton>
                <PlatformLinkButton
                  href={`/admin/nodes/${node.id}`}
                  variant="ghost"
                  size="sm"
                  className={styles.actionLink}
                  aria-label={`${node.name} 편집`}
                >
                  <Edit2 aria-hidden="true" />
                </PlatformLinkButton>
                <PlatformIconButton
                  type="button"
                  variant="danger"
                  aria-label={`${node.name} 삭제`}
                  disabled={isListMutationBusy}
                  onClick={() => {
                    setDeletingNode(node)
                    setIsDeleteModalOpen(true)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </PlatformIconButton>
              </div>
            </article>
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
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDestructive
        isLoading={isDeleting}
      />
      <NodeMoveModal
        isOpen={isMoveModalOpen}
        node={movingNode}
        onClose={() => setIsMoveModalOpen(false)}
        onSuccess={handleMoveSuccess}
      />
    </div>
  )
}
