'use client'

import { useEffect, useMemo, useState } from 'react'
import { createShowroomClient } from '@/lib/supabase/client'
import { logError } from '@/lib/logger'
import {
  collectNodeTree,
  createCopiedNodeInsert,
  type CopyableNode,
} from '@/lib/admin/nodeCopy'
import type { Database } from '@/types/database'
import styles from './NodeMoveModal.module.css'

type HeroMediaRow = Database['showroom']['Tables']['hero_media']['Row']
type HeroMediaInsert = Database['showroom']['Tables']['hero_media']['Insert']
type GalleryPhotoRow = Database['showroom']['Tables']['gallery_photos']['Row']
type GalleryPhotoInsert = Database['showroom']['Tables']['gallery_photos']['Insert']

type CopyTargetNode = {
  id: string
  name: string
  parent_id: string | null
}

interface NodeCopyModalProps {
  isOpen: boolean
  node: CopyTargetNode | null
  onClose: () => void
  onSuccess: () => void
}

type NodeCopyModalContentProps = Omit<NodeCopyModalProps, 'isOpen'> & {
  node: CopyTargetNode
}

export default function NodeCopyModal(props: NodeCopyModalProps) {
  if (!props.isOpen || !props.node) return null

  return (
    <NodeCopyModalContent
      key={props.node.id}
      node={props.node}
      onClose={props.onClose}
      onSuccess={props.onSuccess}
    />
  )
}

function NodeCopyModalContent({ node, onClose, onSuccess }: NodeCopyModalContentProps) {
  const [descendantCount, setDescendantCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const supabase = useMemo(() => createShowroomClient(), [])

  useEffect(() => {
    let cancelled = false

    const fetchSummary = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .schema('showroom')
          .from('nodes')
          .select('*')

        if (error) throw error

        const tree = collectNodeTree(node.id, (data || []) as CopyableNode[])

        if (!cancelled) {
          setDescendantCount(Math.max(tree.length - 1, 0))
        }
      } catch (err) {
        if (!cancelled) {
          logError('노드 복사 정보 로딩 실패:', err)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void fetchSummary()

    return () => {
      cancelled = true
    }
  }, [node.id, supabase])

  const handleConfirm = async () => {
    setIsSaving(true)

    try {
      const showroomDb = supabase.schema('showroom')
      const { data: allNodesData, error: nodesError } = await showroomDb
        .from('nodes')
        .select('*')

      if (nodesError) throw nodesError

      const allNodes = (allNodesData || []) as CopyableNode[]
      const sourceTree = collectNodeTree(node.id, allNodes)

      if (sourceTree.length === 0) {
        throw new Error('Copy source node was not found')
      }

      const sourceIds = sourceTree.map(item => item.id)
      const [heroMediaResult, galleryPhotosResult] = await Promise.all([
        showroomDb
          .from('hero_media')
          .select('*')
          .in('node_id', sourceIds),
        showroomDb
          .from('gallery_photos')
          .select('*')
          .in('node_id', sourceIds),
      ])

      if (heroMediaResult.error) throw heroMediaResult.error
      if (galleryPhotosResult.error) throw galleryPhotosResult.error

      const sourceRoot = sourceTree[0]
      const idMap = new Map<string, string>()
      const copiedSiblingSlugs = new Map<string | null, Set<string>>()
      const rootSiblingSlugs = new Set(
        allNodes
          .filter(item => item.parent_id === sourceRoot.parent_id)
          .map(item => item.slug)
      )
      copiedSiblingSlugs.set(sourceRoot.parent_id, rootSiblingSlugs)

      for (const source of sourceTree) {
        const parentId = source.id === sourceRoot.id
          ? sourceRoot.parent_id
          : idMap.get(source.parent_id || '') || null

        if (source.id !== sourceRoot.id && !parentId) {
          throw new Error('Copied parent node was not created')
        }

        const displayOrder = source.id === sourceRoot.id
          ? allNodes.filter(item => item.parent_id === sourceRoot.parent_id).length
          : source.display_order

        const siblingSlugs = copiedSiblingSlugs.get(parentId) ?? new Set<string>()
        const insertPayload = createCopiedNodeInsert({
          source,
          parentId,
          displayOrder,
          siblingSlugs,
        })

        const { data: insertedNode, error: insertError } = await showroomDb
          .from('nodes')
          .insert(insertPayload)
          .select('id, slug')
          .single()

        if (insertError) throw insertError
        if (!insertedNode) throw new Error('Copied node was not returned')

        idMap.set(source.id, insertedNode.id)
        siblingSlugs.add(insertedNode.slug)
        copiedSiblingSlugs.set(parentId, siblingSlugs)
        copiedSiblingSlugs.set(insertedNode.id, new Set<string>())
      }

      const copiedHeroMedia = ((heroMediaResult.data || []) as HeroMediaRow[])
        .map(row => copyHeroMedia(row, idMap.get(row.node_id)))
        .filter((row): row is HeroMediaInsert => Boolean(row))

      if (copiedHeroMedia.length > 0) {
        const { error } = await showroomDb.from('hero_media').insert(copiedHeroMedia)
        if (error) throw error
      }

      const copiedGalleryPhotos = ((galleryPhotosResult.data || []) as GalleryPhotoRow[])
        .map(row => copyGalleryPhoto(row, idMap.get(row.node_id)))
        .filter((row): row is GalleryPhotoInsert => Boolean(row))

      if (copiedGalleryPhotos.length > 0) {
        const { error } = await showroomDb.from('gallery_photos').insert(copiedGalleryPhotos)
        if (error) throw error
      }

      onSuccess()
    } catch (err) {
      logError('노드 복사 실패:', err)
      alert('노드 복사에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.title}>노드 복사</h2>
        <p className={styles.message}>
          &apos;{node.name}&apos; 노드를 같은 위치에 초안으로 복사합니다.
        </p>
        <p className={styles.itemDesc}>
          {isLoading
            ? '복사할 하위 노드를 확인하는 중입니다.'
            : descendantCount > 0
              ? `하위 노드 ${descendantCount}개와 이미지 자료도 함께 복사됩니다.`
              : '하위 노드 없이 이 노드만 복사됩니다.'}
        </p>

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
            disabled={isSaving || isLoading}
          >
            {isSaving ? '복사 중...' : '초안으로 복사'}
          </button>
        </div>
      </div>
    </div>
  )
}

function copyHeroMedia(row: HeroMediaRow, newNodeId: string | undefined): HeroMediaInsert | null {
  if (!newNodeId) return null

  return {
    node_id: newNodeId,
    image_url: row.image_url,
    mobile_image_url: row.mobile_image_url,
    device_type: row.device_type,
    media_type: row.media_type,
    display_order: row.display_order,
  }
}

function copyGalleryPhoto(row: GalleryPhotoRow, newNodeId: string | undefined): GalleryPhotoInsert | null {
  if (!newNodeId) return null

  return {
    node_id: newNodeId,
    image_url: row.image_url,
    caption: row.caption,
    display_order: row.display_order,
  }
}
