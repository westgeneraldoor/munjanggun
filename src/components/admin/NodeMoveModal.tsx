'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
import styles from './NodeMoveModal.module.css'

type SimpleNode = {
  id: string
  name: string
  parent_id: string | null
  type: string
}

type MovableNode = {
  id: string
  name: string
  parent_id: string | null
}

interface NodeMoveModalProps {
  isOpen: boolean
  node: MovableNode | null
  onClose: () => void
  onSuccess: () => void
}

type NodeMoveModalContentProps = Omit<NodeMoveModalProps, 'isOpen'> & {
  node: MovableNode
}

export default function NodeMoveModal(props: NodeMoveModalProps) {
  if (!props.isOpen || !props.node) return null

  return (
    <NodeMoveModalContent
      key={props.node.id}
      node={props.node}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
    />
  )
}

function NodeMoveModalContent({ node, onClose, onSuccess }: NodeMoveModalContentProps) {
  const [targetParentId, setTargetParentId] = useState<string | null | undefined>(node.parent_id)
  const [candidates, setCandidates] = useState<SimpleNode[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const supabase = useMemo(() => createShowroomClient(), [])

  useEffect(() => {
    let cancelled = false

    const fetchCandidates = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .schema('showroom')
          .from('nodes')
          .select('id, name, parent_id, type')
          .eq('type', 'listing')

        if (error) throw error

        if (data && !cancelled) {
          const getDescendantIds = (nodeId: string, allNodes: SimpleNode[]): string[] => {
            const children = allNodes.filter(n => n.parent_id === nodeId)
            return [nodeId, ...children.flatMap(c => getDescendantIds(c.id, allNodes))]
          }

          const descendants = getDescendantIds(node.id, data)
          const validCandidates = data.filter(n => !descendants.includes(n.id))
          setCandidates(validCandidates)
        }
      } catch (err) {
        if (!cancelled) {
          logError('이동 가능한 노드 목록 로딩 실패:', err)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void fetchCandidates()

    return () => {
      cancelled = true
    }
  }, [node.id, supabase])

  const handleConfirm = async () => {
    if (targetParentId === undefined) return
    setIsSaving(true)

    try {
      const showroomDb = supabase.schema('showroom')

      let countQuery = showroomDb.from('nodes').select('*', { count: 'exact', head: true })

      if (targetParentId === null) {
        countQuery = countQuery.is('parent_id', null)
      } else {
        countQuery = countQuery.eq('parent_id', targetParentId)
      }

      const { count, error: countError } = await countQuery

      if (countError) throw countError

      const { error: updateError } = await showroomDb
        .from('nodes')
        .update({
          parent_id: targetParentId,
          display_order: count || 0,
        })
        .eq('id', node.id)

      if (updateError) throw updateError

      onSuccess()
    } catch (err) {
      logError('노드 이동 실패:', err)
      alert('노드 이동에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <h2 className={styles.title}>노드 이동</h2>
        <p className={styles.message}>&apos;{node.name}&apos; 노드를 어디로 이동할까요?</p>

        <div className={styles.list}>
          <label className={`${styles.listItem} ${targetParentId === null ? styles.selected : ''}`}>
            <input
              type="radio"
              name="targetParent"
              checked={targetParentId === null}
              onChange={() => setTargetParentId(null)}
              disabled={node.parent_id === null}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.itemName}>최상위 (탭)</div>
              {node.parent_id === null && <div className={styles.itemDesc}>(현재 위치)</div>}
            </div>
          </label>

          {isLoading ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>로딩 중...</div>
          ) : (
            candidates.map(candidate => {
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
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className={styles.itemName}>{candidate.name}</div>
                    {isCurrentParent && <div className={styles.itemDesc}>(현재 위치)</div>}
                  </div>
                </label>
              )
            })
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSaving}
          >
            취소
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={isSaving || targetParentId === undefined || targetParentId === node.parent_id}
          >
            {isSaving ? '이동 중...' : '이동하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
