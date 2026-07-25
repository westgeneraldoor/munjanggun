'use client'

import React, { useState, useEffect } from 'react'
import { createShowroomClient } from '@/lib/supabase/client'
import { refreshShowroomCatalogCache } from '@/app/admin/nodes/catalog-revalidation'
import { logError } from '@/lib/logger'
import { PlatformButton, PlatformModal } from '@/components/platform/ui'
import styles from './NodeMoveModal.module.css'

type SimpleNode = {
  id: string
  name: string
  parent_id: string | null
  type: string
}

interface NodeMoveModalProps {
  isOpen: boolean
  node: { id: string; name: string; parent_id: string | null } | null
  onClose: () => void
  onSuccess: () => void
}

export default function NodeMoveModal({ isOpen, node, onClose, onSuccess }: NodeMoveModalProps) {
  if (!isOpen || !node) return null

  return (
    <NodeMoveModalContent
      key={`${node.id}:${node.parent_id ?? 'root'}`}
      node={node}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

function NodeMoveModalContent({ node, onClose, onSuccess }: Omit<NodeMoveModalProps, 'isOpen'> & { node: NonNullable<NodeMoveModalProps['node']> }) {
  const [targetParentId, setTargetParentId] = useState<string | null>(node.parent_id)
  const [candidates, setCandidates] = useState<SimpleNode[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  const supabase = createShowroomClient()

  useEffect(() => {
    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setIsLoading(true)
      setLoadError(null)
      setCandidates([])
      try {
        const client = createShowroomClient()
        const { data, error } = await client
          .schema('showroom')
          .from('nodes')
          .select('id, name, parent_id, type')
          .eq('type', 'listing')

        if (error) throw error
        if (!data || cancelled) return

        const getDescendantIds = (nodeId: string, allNodes: SimpleNode[]): string[] => {
          const children = allNodes.filter(candidate => candidate.parent_id === nodeId)
          return [nodeId, ...children.flatMap(child => getDescendantIds(child.id, allNodes))]
        }
        const descendants = getDescendantIds(node.id, data)
        setCandidates(data.filter(candidate => !descendants.includes(candidate.id)))
      } catch (err) {
        if (!cancelled) {
          logError('이동 가능한 노드 목록 로딩 실패:', err)
          setLoadError('이동 가능한 위치를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadAttempt, node])

  const handleClose = () => {
    onClose()
  }

  const handleConfirm = async () => {
    setIsSaving(true)

    try {
      const showroomDb = supabase.schema('showroom')

      // 목적지의 자식 수 조회 (display_order 결정)
      let countQuery = showroomDb.from('nodes').select('*', { count: 'exact', head: true })
      
      if (targetParentId === null) {
        countQuery = countQuery.is('parent_id', null)
      } else {
        countQuery = countQuery.eq('parent_id', targetParentId)
      }

      const { count, error: countError } = await countQuery

      if (countError) throw countError

      // 이동
      const { error: updateError } = await showroomDb
        .from('nodes')
        .update({
          parent_id: targetParentId,
          display_order: count || 0
        })
        .eq('id', node.id)

      if (updateError) throw updateError

      await refreshShowroomCatalogCache()
      onSuccess()
    } catch (err) {
      logError('노드 이동 실패:', err)
      alert('노드 이동에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PlatformModal
      isOpen
      title="노드 이동"
      description={`'${node.name}' 노드를 어디로 이동할까요?`}
      onClose={handleClose}
      showCloseButton
      closeOnBackdrop
      closeDisabled={isSaving}
      size="md"
      footer={(
        <>
          <PlatformButton type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            취소
          </PlatformButton>
          <PlatformButton
            type="button"
            onClick={handleConfirm}
            isLoading={isSaving}
            loadingLabel="이동 중"
            disabled={isLoading || Boolean(loadError) || targetParentId === node.parent_id}
          >
            이동하기
          </PlatformButton>
        </>
      )}
    >
      <div className={styles.list}>
        {isLoading ? (
          <p className={styles.loading} role="status">이동할 위치를 불러오는 중입니다.</p>
        ) : loadError ? (
          <div className={styles.loadError} role="alert">
            <p>{loadError}</p>
            <PlatformButton type="button" variant="secondary" onClick={() => setLoadAttempt(attempt => attempt + 1)}>
              다시 시도
            </PlatformButton>
          </div>
        ) : (
          <>
            <label className={`${styles.listItem} ${targetParentId === null ? styles.selected : ''}`}>
              <input
                type="radio"
                name="targetParent"
                checked={targetParentId === null}
                onChange={() => setTargetParentId(null)}
                disabled={node.parent_id === null}
              />
              <span className={styles.itemCopy}>
                <span className={styles.itemName}>최상위 (탭)</span>
                {node.parent_id === null ? <span className={styles.itemDesc}>(현재 위치)</span> : null}
              </span>
            </label>
            {candidates.map(candidate => {
              const isCurrentParent = candidate.id === node.parent_id
              return (
                <label key={candidate.id} className={`${styles.listItem} ${targetParentId === candidate.id ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    name="targetParent"
                    checked={targetParentId === candidate.id}
                    onChange={() => setTargetParentId(candidate.id)}
                    disabled={isCurrentParent}
                  />
                  <span className={styles.itemCopy}>
                    <span className={styles.itemName}>{candidate.name}</span>
                    {isCurrentParent ? <span className={styles.itemDesc}>(현재 위치)</span> : null}
                  </span>
                </label>
              )
            })}
          </>
        )}
      </div>
    </PlatformModal>
  )
}
