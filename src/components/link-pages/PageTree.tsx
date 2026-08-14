'use client'

import { Copy, Minus, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { LinkPage } from '@/lib/link-pages/model'
import { createPageTreeIndex, getAncestorIds, getVisibleTreeRows } from '@/lib/link-pages/tree'
import styles from './PageTree.module.css'

const EXPANDED_STORAGE_KEY = 'munjanggun:link-page-tree:v1'

type PageTreeProps = {
  pages: LinkPage[]
  selectedPageId: string
  onSelect: (pageId: string) => void
  onAdd: () => void
  onEdit: (pageId: string) => void
  onCopy: (pageId: string) => void
  onDelete: (pageId: string) => void
}

function loadExpandedIds() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const value = JSON.parse(window.localStorage.getItem(EXPANDED_STORAGE_KEY) ?? '[]')
    return new Set<string>(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

export function PageTree({ pages, selectedPageId, onSelect, onAdd, onEdit, onCopy, onDelete }: PageTreeProps) {
  const index = useMemo(() => createPageTreeIndex(pages), [pages])
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [expansionReady, setExpansionReady] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    queueMicrotask(() => {
      setExpandedIds(loadExpandedIds())
      setExpansionReady(true)
    })
  }, [])

  useEffect(() => {
    if (!expansionReady) return
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expandedIds]))
  }, [expandedIds, expansionReady])

  const visibleExpandedIds = useMemo(() => {
    const next = new Set(expandedIds)
    for (const ancestorId of getAncestorIds(index, selectedPageId)) next.add(ancestorId)
    return next
  }, [expandedIds, index, selectedPageId])
  const rows = useMemo(() => getVisibleTreeRows(index, visibleExpandedIds, query), [index, query, visibleExpandedIds])
  const toggle = (pageId: string) => setExpandedIds((current) => {
    const next = new Set(current)
    if (next.has(pageId)) next.delete(pageId)
    else next.add(pageId)
    return next
  })

  const focusRow = (pageId?: string) => {
    if (!pageId) return
    rowRefs.current.get(pageId)?.focus()
  }

  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, rowIndex: number, page: LinkPage, hasChildren: boolean) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); focusRow(rows[rowIndex + 1]?.page.id) }
    if (event.key === 'ArrowUp') { event.preventDefault(); focusRow(rows[rowIndex - 1]?.page.id) }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (hasChildren && !visibleExpandedIds.has(page.id)) toggle(page.id)
      else focusRow(rows[rowIndex + 1]?.depth === rows[rowIndex].depth + 1 ? rows[rowIndex + 1]?.page.id : undefined)
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (visibleExpandedIds.has(page.id)) toggle(page.id)
      else focusRow(page.parentId ?? undefined)
    }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(page.id) }
  }

  return (
    <aside className={styles.rail} aria-label="페이지 목록">
      <div className={styles.heading}>
        <div><strong>페이지</strong><span>{pages.length}</span></div>
        <button type="button" aria-label="페이지 추가" onClick={onAdd}><Plus size={17} /><span>추가</span></button>
      </div>
      <label className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="페이지 검색" aria-label="페이지 검색" />
        {query ? <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={15} /></button> : null}
      </label>
      <div className={styles.treeTools}>
        <button type="button" onClick={() => setExpandedIds(new Set(index.byId.keys()))}>모두 펼치기</button>
        <button type="button" onClick={() => setExpandedIds(new Set())}>모두 접기</button>
      </div>
      <div className={styles.tree} role="tree" aria-label="페이지 트리">
        {rows.map((row, rowIndex) => (
          <div
            className={`${styles.treeItem} ${row.page.id === selectedPageId ? styles.selected : ''}`}
            key={row.page.id}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={row.page.id === selectedPageId}
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            tabIndex={row.page.id === selectedPageId || (!selectedPageId && rowIndex === 0) ? 0 : -1}
            ref={(element) => { if (element) rowRefs.current.set(row.page.id, element); else rowRefs.current.delete(row.page.id) }}
            onKeyDown={(event) => onRowKeyDown(event, rowIndex, row.page, row.hasChildren)}
            style={{ '--tree-depth': row.depth } as React.CSSProperties}
          >
            <span className={styles.connector} aria-hidden="true" />
            {row.hasChildren ? (
              <button className={styles.disclosure} type="button" aria-label={`${row.page.title} ${row.expanded ? '접기' : '펼치기'}`} onClick={() => toggle(row.page.id)}>
                {row.expanded ? <Minus size={13} /> : <Plus size={13} />}
              </button>
            ) : <span className={styles.leaf} aria-hidden="true" />}
            <button className={styles.pageButton} type="button" onClick={() => onSelect(row.page.id)} tabIndex={-1}>
              <span className={styles.pageIcon}><UserRound size={17} /></span>
              <span className={styles.pageCopy}><strong>{row.page.title}</strong><small>{row.page.role === 'navigation' ? '네비게이션' : '자식 페이지'} · /{row.page.slug}</small></span>
            </button>
            <div className={styles.actions}>
              <button type="button" aria-label={`${row.page.title} 편집`} onClick={() => onEdit(row.page.id)}><Pencil size={14} /></button>
              <button type="button" aria-label={`${row.page.title} 복사`} onClick={() => onCopy(row.page.id)}><Copy size={14} /></button>
              {pages.length > 1 ? <button type="button" aria-label={`${row.page.title} 삭제`} onClick={() => onDelete(row.page.id)}><Trash2 size={14} /></button> : null}
            </div>
          </div>
        ))}
        {!rows.length ? <p className={styles.empty}>일치하는 페이지가 없습니다.</p> : null}
      </div>
    </aside>
  )
}
