'use client'

import React, { useState, useEffect } from 'react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
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
  const [targetParentId, setTargetParentId] = useState<string | null | undefined>(undefined)
  const [candidates, setCandidates] = useState<SimpleNode[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const supabase = createShowroomClient()

  const fetchCandidates = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .schema('showroom')
        .from('nodes')
        .select('id, name, parent_id, type')
        .eq('type', 'listing')

      if (error) throw error

      if (data && node) {
        // 순환 참조 방지
        const getDescendantIds = (nodeId: string, allNodes: SimpleNode[]): string[] => {
          const children = allNodes.filter(n => n.parent_id === nodeId)
          return [nodeId, ...children.flatMap(c => getDescendantIds(c.id, allNodes))]
        }

        const descendants = getDescendantIds(node.id, data)
        const validCandidates = data.filter(n => !descendants.includes(n.id))
        setCandidates(validCandidates)
      }
    } catch (err) {
      logError('이동 가능한 노드 목록 로딩 실패:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && node) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetParentId(node.parent_id)
      fetchCandidates()
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCandidates([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetParentId(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, node])

  const handleConfirm = async () => {
    if (!node || targetParentId === undefined) return
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

      onSuccess()
    } catch (err) {
      logError('노드 이동 실패:', err)
      alert('노드 이동에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen || !node) return null

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <h2 className={styles.title}>노드 이동</h2>
        <p className={styles.message}>&apos;{node.name}&apos; 노드를 어디로 이동할까요?</p>

        <div className={styles.list}>
          {/* 최상위(탭) 옵션 */}
          <label className={`${styles.listItem} ${targetParentId === null ? styles.selected : ''}`}>
            <input
              type="radio"
              name="targetParent"
              checked={targetParentId === null}
              onChange={() => setTargetParentId(null)}
              disabled={node.parent_id === null}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className={styles.itemName}>📌 최상위 (탭)</div>
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
