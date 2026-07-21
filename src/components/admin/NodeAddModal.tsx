'use client'

import React, { useState } from 'react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
import { generateSlug, validateSlug } from '@/lib/utils'
import {
  PlatformButton,
  PlatformField,
  PlatformModal,
  PlatformSelect,
} from '@/components/platform/ui'
import styles from './NodeAddModal.module.css'

interface NodeAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  parentId: string | null
  displayOrder: number
}

export default function NodeAddModal({ isOpen, onClose, onSuccess, parentId, displayOrder }: NodeAddModalProps) {
  if (!isOpen) return null

  return (
    <NodeAddModalContent
      onClose={onClose}
      onSuccess={onSuccess}
      parentId={parentId}
      displayOrder={displayOrder}
    />
  )
}

function NodeAddModalContent({ onClose, onSuccess, parentId, displayOrder }: Omit<NodeAddModalProps, 'isOpen'>) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [type, setType] = useState(parentId === null ? 'listing' : 'detail')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createShowroomClient()

  const handleClose = () => {
    setName('')
    setSlug('')
    setType(parentId === null ? 'listing' : 'detail')
    onClose()
  }

  const slugValidation = slug ? validateSlug(slug) : { valid: true }

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
          type: parentId === null ? 'listing' : type, // 최상위는 listing 고정
          display_order: displayOrder,
          status: 'draft', // 기본값 초안
          hero_enabled: false
        })

      if (error) {
        // Unique constraint violation (code 23505) for slug
        if (error.code === '23505') {
          alert('이미 존재하는 슬러그입니다. 다른 슬러그를 입력해주세요.')
          throw error
        }
        throw error
      }
      
      onSuccess()
      handleClose()
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
    <PlatformModal
      isOpen
      title={parentId === null ? '탭(최상위 노드) 추가' : '자식 노드 추가'}
      onClose={handleClose}
      showCloseButton
      closeDisabled={isSubmitting}
      footer={(
        <>
          <PlatformButton type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            취소
          </PlatformButton>
          <PlatformButton
            type="submit"
            form="node-add-form"
            isLoading={isSubmitting}
            loadingLabel="추가 중"
            disabled={!slug || !slugValidation.valid}
          >
            추가하기
          </PlatformButton>
        </>
      )}
    >
      <form id="node-add-form" onSubmit={handleSubmit} className={styles.form}>
        <PlatformField
          id="node-name"
          label="이름 *"
          type="text"
          value={name}
          onChange={event => {
            setName(event.target.value)
            setSlug(generateSlug(event.target.value))
          }}
          placeholder="예: 싱크대, 올리브그린"
          required
          disabled={isSubmitting}
          data-modal-initial-focus
        />

        <PlatformField
          id="node-slug"
          label="URL 슬러그 *"
          type="text"
          value={slug}
          onChange={event => setSlug(event.target.value)}
          placeholder="예: modern, classic-goshi"
          required
          disabled={isSubmitting}
          error={slug && !slugValidation.valid ? slugValidation.message || '영문 slug를 직접 입력해주세요' : undefined}
        />

        {parentId !== null ? (
          <PlatformSelect
            id="node-type"
            label="노드 타입 *"
            value={type}
            onChange={event => setType(event.target.value)}
            disabled={isSubmitting}
            options={[
              { value: 'detail', label: '상세 (Detail) - 갤러리/사진 포함' },
              { value: 'listing', label: '목록 (Listing) - 하위 카테고리용' },
            ]}
          />
        ) : null}
      </form>
    </PlatformModal>
  )
}
