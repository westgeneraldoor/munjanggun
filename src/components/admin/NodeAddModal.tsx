'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
import { generateSlug, validateSlug } from '@/lib/utils'
import styles from './NodeAddModal.module.css'

interface NodeAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  parentId: string | null
  displayOrder: number
}

type NodeAddModalContentProps = Omit<NodeAddModalProps, 'isOpen'>

export default function NodeAddModal(props: NodeAddModalProps) {
  if (!props.isOpen) return null

  return (
    <NodeAddModalContent
      key={`${props.parentId ?? 'root'}-${props.displayOrder}`}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
      parentId={props.parentId}
      displayOrder={props.displayOrder}
    />
  )
}

function NodeAddModalContent({ onClose, onSuccess, parentId, displayOrder }: NodeAddModalContentProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [type, setType] = useState(parentId === null ? 'listing' : 'detail')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createShowroomClient()

  const handleNameChange = (value: string) => {
    setName(value)
    setSlug(value ? generateSlug(value) : '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !slug.trim()) {
      alert('이름과 슬러그를 입력해주세요.')
      return
    }

    const slugValidation = validateSlug(slug)
    if (!slugValidation.valid) {
      alert(slugValidation.message || '유효하지 않은 슬러그입니다.')
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .schema('showroom')
        .from('nodes')
        .insert({
          parent_id: parentId,
          name: name.trim(),
          slug: slug.trim(),
          type: parentId === null ? 'listing' : type,
          display_order: displayOrder,
          status: 'draft',
          hero_enabled: false,
        })

      if (error) {
        if (error.code === '23505') {
          alert('이미 존재하는 슬러그입니다. 다른 슬러그를 입력해주세요.')
          throw error
        }
        throw error
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      logError('노드 추가 실패:', err)
      if ((err as { code?: string })?.code !== '23505') {
        alert('노드 추가에 실패했습니다.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>{parentId === null ? '탭(최상위 노드) 추가' : '자식 노드 추가'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>이름 *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={styles.input}
              placeholder="예: 싱크대, 올리브그린"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="slug" className={styles.label}>URL 슬러그 *</label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={`${styles.input} ${slug && !validateSlug(slug).valid ? styles.inputError : ''}`}
              placeholder="예: modern, classic-goshi"
              required
              disabled={isSubmitting}
            />
            {slug && !validateSlug(slug).valid && (
              <p className={styles.slugWarning}>{validateSlug(slug).message || '영문 slug를 직접 입력해주세요'}</p>
            )}
          </div>

          {parentId !== null && (
            <div className={styles.formGroup}>
              <label htmlFor="type" className={styles.label}>노드 타입 *</label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={styles.select}
                disabled={isSubmitting}
              >
                <option value="detail">상세 (Detail) - 갤러리/사진 포함</option>
                <option value="listing">목록 (Listing) - 하위 카테고리용</option>
              </select>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || (slug ? !validateSlug(slug).valid : true)}
            >
              {isSubmitting ? '추가 중...' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
