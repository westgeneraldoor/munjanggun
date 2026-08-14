'use client'

import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  FileDown,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Megaphone,
  Menu,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  Share2,
  Trash2,
  Type,
  UserRound,
  UsersRound,
  Video,
  X,
} from 'lucide-react'
import { ChangeEvent, DragEvent as ReactDragEvent, Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { saveAsset } from '@/lib/link-pages/asset-store'
import { createBrowserLinkPageRepository } from '@/lib/link-pages/browser-repository'
import {
  LinkBlock,
  LinkBlockContent,
  LinkBlockKind,
  LinkItem,
  LinkPage,
  LinkPageState,
  LinkPageTab,
  canSetPageParent,
  createBlock,
  createId,
  createInitialLinkPageState,
  createPage,
  duplicateBlock,
  getNavigationPages,
  getPageDepth,
  getPageDescendantIds,
  getOrderedPageTree,
  isSlugAvailable,
  isValidHttpUrl,
  isValidSlug,
  normalizeBlockOrders,
  normalizePageOrders,
  updatePageSlug,
} from '@/lib/link-pages/model'
import { LinkPageRenderer } from './LinkPageRenderer'
import styles from './LinkPageStudio.module.css'

const repository = createBrowserLinkPageRepository()

const TAB_ITEMS: Array<{ id: LinkPageTab; label: string; icon: ReactNode }> = [
  { id: 'page', label: '페이지', icon: <Menu size={18} /> },
  { id: 'design', label: '디자인', icon: <Palette size={18} /> },
  { id: 'analytics', label: '분석', icon: <BarChart3 size={18} /> },
  { id: 'manage', label: '관리', icon: <UsersRound size={18} /> },
  { id: 'marketing', label: '마케팅', icon: <Megaphone size={18} /> },
]

const BLOCK_PICKER: Array<{ kind: Exclude<LinkBlockKind, 'profile'>; label: string; description: string; icon: ReactNode }> = [
  { kind: 'singleLink', label: '단일 링크', description: '하나의 URL 강조', icon: <Link2 /> },
  { kind: 'groupLink', label: '그룹 링크', description: '여러 링크를 한번에', icon: <LayoutGrid /> },
  { kind: 'text', label: '텍스트', description: '제목과 상세 내용', icon: <Type /> },
  { kind: 'gallery', label: '갤러리', description: '이미지 배치', icon: <ImageIcon /> },
  { kind: 'video', label: '동영상', description: '유튜브·비메오·소셜 링크', icon: <Video /> },
  { kind: 'fileShare', label: '파일공유', description: 'PDF와 상담 자료', icon: <FileDown /> },
]

const BLOCK_LABELS: Record<LinkBlockKind, string> = {
  profile: '프로필',
  singleLink: '단일 링크',
  groupLink: '그룹 링크',
  text: '텍스트',
  gallery: '갤러리',
  video: '동영상',
  fileShare: '파일공유',
}

type PageDialogState = { mode: 'add' | 'edit'; pageId?: string } | null

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <small className={styles.fieldError}>{error}</small> : null}
    </label>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className={styles.segmented} role="group">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

function LayoutPicker<T extends string>({ value, options, onChange, disabled = false }: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className={styles.layoutPicker} role="group">
      {options.map((option) => (
        <button key={option.value} type="button" data-layout={option.value} aria-pressed={value === option.value} disabled={disabled} onClick={() => onChange(option.value)}>
          <span className={styles.layoutGlyph} aria-hidden="true"><i /><i /><i /></span>
          <b>{option.label}</b>
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" />
      <b>{label}</b>
    </label>
  )
}

function FileUploadButton({ label, accept, multiple, onChange, file = false }: {
  label: string
  accept?: string
  multiple?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  file?: boolean
}) {
  return (
    <label className={styles.uploadBox}>
      {file ? <FileDown size={22} /> : <ImageIcon size={22} />}
      <span>{label}</span>
      <small>{multiple ? '여러 파일을 한 번에 선택할 수 있어요' : '눌러서 파일을 선택하세요'}</small>
      <input type="file" accept={accept} multiple={multiple} onChange={onChange} />
    </label>
  )
}

function BlockFields({ block, onChange }: { block: LinkBlock; onChange: (content: LinkBlockContent) => void }) {
  const content = block.content
  const [groupItemDraft, setGroupItemDraft] = useState<LinkItem | null>(null)

  const upload = async (event: ChangeEvent<HTMLInputElement>, accept: 'image' | 'file') => {
    const file = event.target.files?.[0]
    if (!file) return
    const asset = await saveAsset(file)
    if (content.kind === 'profile') onChange({ ...content, [accept === 'image' ? 'image' : 'cover']: asset })
    if (content.kind === 'singleLink') onChange({ ...content, image: asset })
    if (content.kind === 'fileShare' && accept === 'image') onChange({ ...content, image: asset })
  }

  if (content.kind === 'profile') {
    return (
      <div className={styles.fields}>
        <Field label="레이아웃">
          <LayoutPicker value={content.layout} options={[
            { value: 'avatar', label: '아바타' }, { value: 'dark', label: '다크' },
            { value: 'overlap', label: '오버랩' }, { value: 'cover', label: '커버' },
          ]} onChange={(layout) => onChange({ ...content, layout })} />
        </Field>
        <Field label="이미지"><FileUploadButton label="프로필 이미지" accept="image/*" onChange={(event) => void upload(event, 'image')} /></Field>
        {(content.layout === 'overlap' || content.layout === 'cover') ? (
          <Field label="커버 이미지"><FileUploadButton label="커버 이미지" accept="image/*" onChange={(event) => void upload(event, 'file')} /></Field>
        ) : null}
        <Field label="대표문구"><input value={content.title} onChange={(event) => onChange({ ...content, title: event.target.value })} /></Field>
        <Field label="상세문구"><textarea rows={3} value={content.description} onChange={(event) => onChange({ ...content, description: event.target.value })} /></Field>
        <Field label="글자크기"><Segmented value={content.size} options={[{ value: 'small', label: '소' }, { value: 'medium', label: '중' }, { value: 'large', label: '대' }]} onChange={(size) => onChange({ ...content, size })} /></Field>
      </div>
    )
  }

  if (content.kind === 'singleLink') {
    const invalid = content.url !== 'https://' && !isValidHttpUrl(content.url)
    return (
      <div className={styles.fields}>
        <Field label="연결 URL *" error={invalid ? 'http:// 또는 https://로 시작하는 URL을 입력하세요.' : undefined}>
          <input value={content.url} onChange={(event) => onChange({ ...content, url: event.target.value })} />
        </Field>
        <Field label="이미지"><FileUploadButton label="링크 이미지" accept="image/*" onChange={(event) => void upload(event, 'image')} /></Field>
        <Field label="대표문구 *"><input value={content.title} onChange={(event) => onChange({ ...content, title: event.target.value })} /></Field>
        <Field label="크기"><LayoutPicker value={content.layout} options={[{ value: 'small', label: '소' }, { value: 'medium', label: '중' }, { value: 'large', label: '대' }]} onChange={(layout) => onChange({ ...content, layout })} /></Field>
        <Toggle checked={content.highlighted} label="링크 강조" onChange={(highlighted) => onChange({ ...content, highlighted })} />
        <div className={styles.twoFields}>
          <Field label="강조 태그"><input value={content.tag ?? ''} onChange={(event) => onChange({ ...content, tag: event.target.value })} /></Field>
          <Field label="판매가"><input value={content.price ?? ''} onChange={(event) => onChange({ ...content, price: event.target.value })} /></Field>
        </div>
        <Field label="정가"><input value={content.originalPrice ?? ''} onChange={(event) => onChange({ ...content, originalPrice: event.target.value })} /></Field>
      </div>
    )
  }

  if (content.kind === 'groupLink') {
    return (
      <div className={styles.fields}>
        <Field label="대표문구"><input value={content.title} onChange={(event) => onChange({ ...content, title: event.target.value })} /></Field>
        <Field label="레이아웃"><LayoutPicker value={content.layout} options={[
          { value: 'list', label: '기본' }, { value: 'twoColumn', label: '2열' }, { value: 'threeColumn', label: '3열' },
          { value: 'carousel', label: '1캐러셀' }, { value: 'doubleCarousel', label: '2캐러셀' },
        ]} onChange={(layout) => onChange({ ...content, layout })} /></Field>
        <Toggle checked={content.collapsible} label="접기/더보기" onChange={(collapsible) => onChange({ ...content, collapsible })} />
        <div className={styles.itemList}>
          {content.items.map((item, index) => (
            <div className={styles.itemSummary} key={item.id} data-item-id={item.id}>
              <GripVertical size={17} aria-hidden="true" />
              <button className={styles.itemEditButton} type="button" onClick={() => setGroupItemDraft(structuredClone(item))}><b>{item.title || `${index + 1}번 링크`}</b><small>{item.url}</small></button>
              <button type="button" aria-label={`${index + 1}번 링크 삭제`} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })}><Trash2 size={17} /></button>
            </div>
          ))}
          <button className={styles.addSubItem} type="button" onClick={() => {
            setGroupItemDraft({ id: createId(), title: '', url: 'https://' })
          }}>+ 링크 추가</button>
        </div>
        {groupItemDraft ? (() => {
          const updateItem = (patch: Partial<LinkItem>) => setGroupItemDraft((item) => item ? { ...item, ...patch } : item)
          const uploadItemImage = async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            if (file) updateItem({ image: await saveAsset(file) })
          }
          const valid = isValidHttpUrl(groupItemDraft.url) && Boolean(groupItemDraft.title.trim()) && Boolean(groupItemDraft.image || groupItemDraft.imageUrl)
          const saveItem = () => {
            if (!valid) return
            const exists = content.items.some((item) => item.id === groupItemDraft.id)
            onChange({ ...content, items: exists ? content.items.map((item) => item.id === groupItemDraft.id ? groupItemDraft : item) : [...content.items, groupItemDraft] })
            setGroupItemDraft(null)
          }
          return (
            <Dialog title="그룹 링크 편집" onClose={() => setGroupItemDraft(null)}>
              <div className={styles.fields}>
                <Field label="연결 URL *"><input value={groupItemDraft.url} onChange={(event) => updateItem({ url: event.target.value })} /></Field>
                <Field label="대표문구 *"><input value={groupItemDraft.title} onChange={(event) => updateItem({ title: event.target.value })} /></Field>
                <Field label="이미지 *"><FileUploadButton label="링크 이미지" accept="image/*" onChange={(event) => void uploadItemImage(event)} /></Field>
                <div className={styles.twoFields}>
                  <Field label="강조 태그"><input value={groupItemDraft.tag ?? ''} onChange={(event) => updateItem({ tag: event.target.value })} /></Field>
                  <Field label="판매가"><input value={groupItemDraft.price ?? ''} onChange={(event) => updateItem({ price: event.target.value })} /></Field>
                </div>
                <Field label="정가"><input value={groupItemDraft.originalPrice ?? ''} onChange={(event) => updateItem({ originalPrice: event.target.value })} /></Field>
                <div className={styles.dialogActions}><button type="button" disabled={!valid} onClick={saveItem}>설정 완료</button></div>
              </div>
            </Dialog>
          )
        })() : null}
      </div>
    )
  }

  if (content.kind === 'text') {
    return (
      <div className={styles.fields}>
        <Field label="대표문구" hint={`${content.title.length}/60`}><input maxLength={60} value={content.title} onChange={(event) => onChange({ ...content, title: event.target.value })} /></Field>
        <Field label="상세문구" hint={`${content.body.length}/5000`}><textarea rows={6} maxLength={5000} value={content.body} onChange={(event) => onChange({ ...content, body: event.target.value })} /></Field>
        <Field label="표시"><Segmented value={content.layout} options={[{ value: 'plain', label: '기본' }, { value: 'toggle', label: '접기' }]} onChange={(layout) => onChange({ ...content, layout })} /></Field>
        <Field label="정렬"><Segmented value={content.align} options={[{ value: 'left', label: '왼쪽' }, { value: 'center', label: '가운데' }, { value: 'right', label: '오른쪽' }]} onChange={(align) => onChange({ ...content, align })} /></Field>
        <Field label="글자크기"><Segmented value={content.size} options={[{ value: 'small', label: '소' }, { value: 'medium', label: '중' }, { value: 'large', label: '대' }]} onChange={(size) => onChange({ ...content, size })} /></Field>
      </div>
    )
  }

  if (content.kind === 'gallery') {
    const uploadGallery = async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      const assets = await Promise.all(files.map(saveAsset))
      onChange({ ...content, items: [...content.items, ...assets.map((asset) => ({ id: createId(), alt: asset.name, asset }))] })
    }
    return (
      <div className={styles.fields}>
        <Field label="대표문구"><input value={content.title} onChange={(event) => onChange({ ...content, title: event.target.value })} /></Field>
        <Field label="이미지 *"><FileUploadButton label="갤러리 이미지" accept="image/*" multiple onChange={(event) => void uploadGallery(event)} /></Field>
        <Field label="레이아웃"><LayoutPicker value={content.layout} options={[
          { value: 'single', label: '한 장' }, { value: 'carousel', label: '캐러셀' }, { value: 'list', label: '목록' },
          { value: 'thumbnail', label: '썸네일' }, { value: 'masonry', label: '자유' },
        ]} disabled={!content.items.length} onChange={(layout) => onChange({ ...content, layout })} /></Field>
        <Toggle checked={content.slideshow} label="이미지 슬라이드" onChange={(slideshow) => onChange({ ...content, slideshow })} />
        <Toggle checked={content.keepRatio} label="이미지 비율 유지" onChange={(keepRatio) => onChange({ ...content, keepRatio })} />
        {content.items.map((item, index) => (
          <div className={styles.itemEditor} key={item.id} data-item-id={item.id}>
            <GripVertical size={17} />
            <input aria-label={`${index + 1}번 이미지 설명`} value={item.alt} onChange={(event) => onChange({ ...content, items: content.items.map((candidate) => candidate.id === item.id ? { ...candidate, alt: event.target.value } : candidate) })} />
            <input aria-label={`${index + 1}번 연결 URL`} placeholder="연결 URL (선택)" value={item.url ?? ''} onChange={(event) => onChange({ ...content, items: content.items.map((candidate) => candidate.id === item.id ? { ...candidate, url: event.target.value } : candidate) })} />
            <button type="button" aria-label={`${index + 1}번 이미지 삭제`} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })}><Trash2 size={17} /></button>
          </div>
        ))}
      </div>
    )
  }

  if (content.kind === 'video') {
    return (
      <div className={styles.fields}>
        <Field label="대표문구"><input value={content.title} onChange={(event) => onChange({ ...content, title: event.target.value })} /></Field>
        <Field label="레이아웃"><LayoutPicker value={content.layout} options={[{ value: 'list', label: '기본' }, { value: 'carousel', label: '캐러셀' }, { value: 'twoColumn', label: '2열' }]} onChange={(layout) => onChange({ ...content, layout })} /></Field>
        <Toggle checked={content.autoplayMuted} label="무음 자동재생" onChange={(autoplayMuted) => onChange({ ...content, autoplayMuted })} />
        {content.items.map((item, index) => (
          <div className={styles.itemEditor} key={item.id} data-item-id={item.id}>
            <GripVertical size={17} />
            <input aria-label={`${index + 1}번 영상 URL`} value={item.url} onChange={(event) => onChange({ ...content, items: content.items.map((candidate) => candidate.id === item.id ? { ...candidate, url: event.target.value } : candidate) })} />
            <button type="button" aria-label={`${index + 1}번 영상 삭제`} onClick={() => onChange({ ...content, items: content.items.filter((candidate) => candidate.id !== item.id) })}><Trash2 size={17} /></button>
          </div>
        ))}
        <button className={styles.addSubItem} type="button" onClick={() => onChange({ ...content, items: [...content.items, { id: createId(), url: 'https://' }] })}>+ 영상채널 연결추가</button>
      </div>
    )
  }

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    const assets = await Promise.all(files.map(saveAsset))
    onChange({ ...content, files: [...content.files, ...assets.map((asset) => ({ id: createId(), asset }))] })
  }
  return (
    <div className={styles.fields}>
      <Field label="대표문구 *"><input value={content.title} onChange={(event) => onChange({ ...content, title: event.target.value })} /></Field>
      <Field label="상세설명"><textarea rows={3} value={content.description} onChange={(event) => onChange({ ...content, description: event.target.value })} /></Field>
      <Field label="커버 이미지"><FileUploadButton label="파일 카드 이미지" accept="image/*" onChange={(event) => void upload(event, 'image')} /></Field>
      <Field label="파일 *"><FileUploadButton label="공유할 파일" multiple file onChange={(event) => void uploadFiles(event)} /></Field>
      {content.files.map((item, index) => (
        <div className={styles.itemEditor} key={item.id} data-item-id={item.id}>
          <GripVertical size={17} /><span>{item.asset.name}</span>
          <button type="button" aria-label={`${index + 1}번 파일 삭제`} onClick={() => onChange({ ...content, files: content.files.filter((candidate) => candidate.id !== item.id) })}><Trash2 size={17} /></button>
        </div>
      ))}
      <div className={styles.disabledNotice}>이름·연락처·이메일 수집은 동의·보관 정책 확정 후 열립니다.</div>
    </div>
  )
}

function BlockCard({
  block,
  index,
  count,
  onUpdate,
  onMove,
  onDropBlock,
  onCopy,
  onDelete,
}: {
  block: LinkBlock
  index: number
  count: number
  onUpdate: (block: LinkBlock) => void
  onMove: (direction: -1 | 1) => void
  onDropBlock: (draggedBlockId: string) => void
  onCopy: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(block.kind === 'profile')
  const [actionsOpen, setActionsOpen] = useState(false)
  return (
    <section
      className={styles.blockCard}
      data-block-id={block.id}
      data-block-kind={block.kind}
      onDragOver={(event) => { if (block.kind !== 'profile') event.preventDefault() }}
      onDrop={(event) => {
        if (block.kind === 'profile') return
        event.preventDefault()
        const draggedBlockId = event.dataTransfer.getData('text/plain')
        if (draggedBlockId && draggedBlockId !== block.id) onDropBlock(draggedBlockId)
      }}
    >
      <header
        draggable={block.kind !== 'profile'}
        onDragStart={(event: ReactDragEvent<HTMLElement>) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', block.id)
        }}
      >
        <span className={styles.dragHandle} title={block.kind === 'profile' ? '프로필은 고정됩니다' : '드래그해 정렬'}><GripVertical size={18} /></span>
        <Toggle checked={block.enabled} label="ON" onChange={(enabled) => onUpdate({ ...block, enabled })} />
        <strong>{BLOCK_LABELS[block.kind]}</strong>
        <div className={styles.cardActions}>
          {block.kind !== 'profile' ? <span className={styles.reservationHint} title="예약 기능은 후속 범위입니다"><Clock3 size={14} />예약</span> : null}
          {block.kind !== 'profile' ? (
            <div className={styles.moreActions}>
              <button type="button" aria-label="블록 더보기" aria-expanded={actionsOpen} onClick={() => setActionsOpen((value) => !value)}><MoreHorizontal size={19} /></button>
              {actionsOpen ? (
                <div className={styles.cardMenu} role="menu">
                  <button type="button" role="menuitem" disabled={index === 0} onClick={() => { onMove(-1); setActionsOpen(false) }}><ChevronUp size={16} />위로 이동</button>
                  <button type="button" role="menuitem" disabled={index === count - 1} onClick={() => { onMove(1); setActionsOpen(false) }}><ChevronDown size={16} />아래로 이동</button>
                  <button type="button" role="menuitem" onClick={() => { onCopy(); setActionsOpen(false) }}><Copy size={16} />블록 복사</button>
                  <button type="button" role="menuitem" onClick={() => { onDelete(); setActionsOpen(false) }}><Trash2 size={16} />블록 삭제</button>
                </div>
              ) : null}
            </div>
          ) : null}
          <button type="button" aria-label={open ? '접기' : '펼치기'} onClick={() => setOpen((value) => !value)}>{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
        </div>
      </header>
      {open ? <BlockFields block={block} onChange={(content) => onUpdate({ ...block, content })} /> : null}
    </section>
  )
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" aria-label="닫기" onClick={onClose}><X /></button></header>
        {children}
      </section>
    </div>
  )
}

export function LinkPageStudio() {
  const [state, setState] = useState<LinkPageState>(() => createInitialLinkPageState())
  const [hydrated, setHydrated] = useState(false)
  const [activeTab, setActiveTab] = useState<LinkPageTab>('page')
  const [blockPickerOpen, setBlockPickerOpen] = useState(false)
  const [blockInsertAfterId, setBlockInsertAfterId] = useState<string | null>(null)
  const [pageDialog, setPageDialog] = useState<PageDialogState>(null)
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null)
  const [deletePageId, setDeletePageId] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setState(repository.load())
      setHydrated(true)
    })
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      repository.save(state)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 900)
    }, 120)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [hydrated, state])

  const selectedPage = state.pages.find((page) => page.id === state.selectedPageId) ?? state.pages[0]
  const navigationPages = useMemo(() => getNavigationPages(state, selectedPage), [state, selectedPage])

  const updateSelectedPage = (updater: (page: LinkPage) => LinkPage) => {
    setState((current) => ({ ...current, pages: current.pages.map((page) => page.id === current.selectedPageId ? { ...updater(page), updatedAt: new Date().toISOString() } : page) }))
  }

  const updateBlock = (block: LinkBlock) => updateSelectedPage((page) => ({ ...page, blocks: page.blocks.map((item) => item.id === block.id ? block : item) }))

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    updateSelectedPage((page) => {
      const profile = page.blocks.find((block) => block.kind === 'profile')
      const blocks = page.blocks.filter((block) => block.kind !== 'profile').sort((a, b) => a.sortOrder - b.sortOrder)
      const index = blocks.findIndex((block) => block.id === blockId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= blocks.length) return page
      const reordered = [...blocks]
      ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
      const normalized = normalizeBlockOrders([...(profile ? [{ ...profile, sortOrder: 0 }] : []), ...reordered])
      return { ...page, blocks: normalized }
    })
  }

  const moveBlockBefore = (draggedBlockId: string, targetBlockId: string) => {
    updateSelectedPage((page) => {
      const profile = page.blocks.find((block) => block.kind === 'profile')
      const blocks = page.blocks.filter((block) => block.kind !== 'profile').sort((a, b) => a.sortOrder - b.sortOrder)
      const draggedIndex = blocks.findIndex((block) => block.id === draggedBlockId)
      if (draggedIndex < 0) return page
      const [dragged] = blocks.splice(draggedIndex, 1)
      const targetIndex = blocks.findIndex((block) => block.id === targetBlockId)
      if (targetIndex < 0) return page
      blocks.splice(targetIndex, 0, dragged)
      return { ...page, blocks: normalizeBlockOrders([...(profile ? [profile] : []), ...blocks]) }
    })
  }

  const copyBlock = (blockId: string) => updateSelectedPage((page) => {
    const source = page.blocks.find((block) => block.id === blockId)
    if (!source || source.kind === 'profile') return page
    const blocks = page.blocks.filter((block) => block.kind !== 'profile').sort((a, b) => a.sortOrder - b.sortOrder)
    const index = blocks.findIndex((block) => block.id === blockId)
    const copy = { ...duplicateBlock(source), sortOrder: source.sortOrder + 1 }
    blocks.splice(index + 1, 0, copy)
    const profile = page.blocks.find((block) => block.kind === 'profile')
    return { ...page, blocks: normalizeBlockOrders([...(profile ? [profile] : []), ...blocks]) }
  })

  const addBlock = (kind: Exclude<LinkBlockKind, 'profile'>) => {
    updateSelectedPage((page) => {
      const blocks = page.blocks.slice().sort((a, b) => a.sortOrder - b.sortOrder)
      const insertionIndex = blockInsertAfterId ? blocks.findIndex((block) => block.id === blockInsertAfterId) + 1 : blocks.length
      blocks.splice(Math.max(1, insertionIndex), 0, createBlock(page.id, kind, insertionIndex))
      return { ...page, blocks: normalizeBlockOrders(blocks) }
    })
    setBlockPickerOpen(false)
    setBlockInsertAfterId(null)
  }

  const confirmDeleteBlock = () => {
    if (!deleteBlockId) return
    updateSelectedPage((page) => ({ ...page, blocks: normalizeBlockOrders(page.blocks.filter((block) => block.id !== deleteBlockId)) }))
    setDeleteBlockId(null)
  }

  const addOrEditPage = (form: FormData) => {
    const title = String(form.get('title') ?? '').trim()
    const slug = String(form.get('slug') ?? '').trim()
    const parentIdValue = String(form.get('parentId') ?? '')
    const currentId = pageDialog?.pageId
    const nextParentId = parentIdValue || null
    if (!title || !isValidSlug(slug) || !isSlugAvailable(state, slug, currentId)) return
    if (currentId && !canSetPageParent(state, currentId, nextParentId)) return

    if (pageDialog?.mode === 'edit' && currentId) {
      setState((current) => {
        const source = current.pages.find((page) => page.id === currentId)
        if (!source) return current
        const parentChanged = source.parentId !== nextParentId
        const nextSortOrder = parentChanged ? current.pages.filter((page) => page.parentId === nextParentId && page.id !== currentId).length : source.sortOrder
        const pages = current.pages.map((page) => page.id === currentId ? updatePageSlug({
          ...page,
          title,
          parentId: nextParentId,
          sortOrder: nextSortOrder,
          updatedAt: new Date().toISOString(),
        }, slug) : page)
        return { ...current, pages: normalizePageOrders(pages) }
      })
    } else {
      const parentId = nextParentId
      const siblingCount = state.pages.filter((page) => page.parentId === parentId).length
      const page = createPage(title, slug, parentId, siblingCount)
      setState((current) => ({ ...current, pages: normalizePageOrders([...current.pages, page]), selectedPageId: page.id }))
    }
    setPageDialog(null)
  }

  const copyPage = (pageId: string) => {
    const source = state.pages.find((page) => page.id === pageId)
    if (!source) return
    let suffix = 2
    let slug = `${source.slug}-${suffix}`
    while (!isSlugAvailable(state, slug)) { suffix += 1; slug = `${source.slug}-${suffix}` }
    const id = createId()
    const copy: LinkPage = {
      ...structuredClone(source), id, slug, slugAliases: [], title: `${source.title} 복사본`,
      blocks: source.blocks.map((block) => ({ ...duplicateBlock(block), pageId: id })),
      sortOrder: state.pages.filter((page) => page.parentId === source.parentId).length,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    setState((current) => ({ ...current, pages: normalizePageOrders([...current.pages, copy]), selectedPageId: copy.id }))
  }

  const confirmDeletePage = () => {
    if (!deletePageId || state.pages.length === 1) return
    const deletedPage = state.pages.find((page) => page.id === deletePageId)
    const fallbackParentId = deletedPage?.parentId ?? null
    const remaining = state.pages.filter((page) => page.id !== deletePageId).map((page) => page.parentId === deletePageId ? { ...page, parentId: fallbackParentId } : page)
    setState((current) => ({ ...current, pages: normalizePageOrders(remaining), selectedPageId: remaining[0].id }))
    setDeletePageId(null)
  }

  return (
    <main className={styles.studio} data-mg-theme="admin">
      <aside className={styles.pageRail} aria-label="페이지 목록">
        <button className={styles.railIcon} type="button" aria-label="설정"><Settings /></button>
        <button className={styles.addPageRail} type="button" onClick={() => setPageDialog({ mode: 'add' })}><Plus /><span>페이지 추가</span></button>
        <div className={styles.pageTree}>
          {getOrderedPageTree(state).map((page) => (
            <div className={styles.pageThumbWrap} style={{ marginLeft: `${Math.min(getPageDepth(state, page), 4) * 14}px` }} key={page.id}>
              <button className={`${styles.pageThumb} ${page.id === selectedPage.id ? styles.selectedPage : ''}`} type="button" onClick={() => setState((current) => ({ ...current, selectedPageId: page.id }))}>
                <UserRound size={25} /><span>{page.parentId ? '페이지' : '홈화면'}</span>
              </button>
              <div className={styles.pageMiniActions}>
                <button type="button" aria-label={`${page.title} 편집`} onClick={() => setPageDialog({ mode: 'edit', pageId: page.id })}><Pencil size={13} /></button>
                <button type="button" aria-label={`${page.title} 복사`} onClick={() => copyPage(page.id)}><Copy size={13} /></button>
                {state.pages.length > 1 ? <button type="button" aria-label={`${page.title} 삭제`} onClick={() => setDeletePageId(page.id)}><Trash2 size={13} /></button> : null}
              </div>
            </div>
          ))}
        </div>
        <button className={styles.dashedAdd} type="button" aria-label="페이지 추가" onClick={() => setPageDialog({ mode: 'add' })}><Plus /></button>
      </aside>

      <section className={styles.previewRail} aria-label="실시간 미리보기">
        <div className={`${styles.phoneFrame} ${savedFlash ? styles.savedFrame : ''}`}>
          <LinkPageRenderer
            page={selectedPage}
            navigationPages={navigationPages}
            surface="preview"
            onNavigate={(pageId) => setState((current) => ({ ...current, selectedPageId: pageId }))}
          />
        </div>
        <div className={styles.previewUrl}>
          <span>URL</span><a href={`/l/${selectedPage.slug}`} target="_blank" rel="noreferrer">/l/{selectedPage.slug}</a>
          <button type="button" aria-label="URL 복사" onClick={() => void navigator.clipboard.writeText(`${location.origin}/l/${selectedPage.slug}`)}><Copy size={17} /></button>
          <a href={`/l/${selectedPage.slug}`} target="_blank" rel="noreferrer" aria-label="공개 페이지 열기"><Share2 size={17} /></a>
        </div>
      </section>

      <section className={styles.editorRail}>
        <nav className={styles.topTabs} aria-label="편집기 메뉴">
          {TAB_ITEMS.map((item) => (
            <button key={item.id} type="button" aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => setActiveTab(item.id)}>{item.icon}<span>{item.label}</span></button>
          ))}
        </nav>

        {activeTab === 'page' ? (
          <div className={styles.editorContent}>
            {selectedPage.blocks.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((block) => {
              const movableBlocks = selectedPage.blocks.filter((item) => item.kind !== 'profile').sort((a, b) => a.sortOrder - b.sortOrder)
              const movableIndex = movableBlocks.findIndex((item) => item.id === block.id)
              return (
                <Fragment key={block.id}>
                  <BlockCard block={block} index={movableIndex} count={movableBlocks.length} onUpdate={updateBlock} onMove={(direction) => moveBlock(block.id, direction)} onDropBlock={(draggedBlockId) => moveBlockBefore(draggedBlockId, block.id)} onCopy={() => copyBlock(block.id)} onDelete={() => setDeleteBlockId(block.id)} />
                  <button className={styles.insertBlock} type="button" aria-label={`${BLOCK_LABELS[block.kind]} 다음에 블록 삽입`} onClick={() => { setBlockInsertAfterId(block.id); setBlockPickerOpen(true) }}><Plus size={17} /></button>
                </Fragment>
              )
            })}
            <button className={styles.addBlock} type="button" onClick={() => { setBlockInsertAfterId(null); setBlockPickerOpen(true) }}>+블럭 추가</button>
          </div>
        ) : null}

        {activeTab === 'design' ? (
          <div className={styles.editorContent}>
            <section className={styles.designPanel}>
              <header><Palette size={20} /><h2>페이지 디자인</h2></header>
              <Field label="배경색"><input type="color" value={selectedPage.theme.backgroundColor} onChange={(event) => updateSelectedPage((page) => ({ ...page, theme: { ...page.theme, backgroundColor: event.target.value } }))} /></Field>
              <Field label="버튼색"><input type="color" value={selectedPage.theme.buttonColor} onChange={(event) => updateSelectedPage((page) => ({ ...page, theme: { ...page.theme, buttonColor: event.target.value } }))} /></Field>
              <Field label="폰트">
                <Segmented value={selectedPage.theme.fontKey} options={[{ value: 'pretendard', label: '기본' }, { value: 'roundwind', label: '라운드' }, { value: 'serif', label: '세리프' }]} onChange={(fontKey) => updateSelectedPage((page) => ({ ...page, theme: { ...page.theme, fontKey } }))} />
              </Field>
            </section>
          </div>
        ) : null}

        {activeTab === 'analytics' ? <Placeholder icon={<BarChart3 />} title="분석" description="화면은 다음 단계에서 열립니다. 지금도 페이지 조회와 블록 클릭 이벤트는 쌓입니다." /> : null}
        {activeTab === 'manage' ? <Placeholder icon={<UsersRound />} title="관리" description="CRM·고객정보·매출·정산은 이번 프로토타입 범위에 포함되지 않습니다." /> : null}
        {activeTab === 'marketing' ? <Placeholder icon={<Megaphone />} title="마케팅" description="메일·DM·문자 발송과 외부 계정 연결은 이번 프로토타입 범위에서 제외합니다." /> : null}
      </section>

      {blockPickerOpen ? (
        <Dialog title="블럭 추가" onClose={() => { setBlockPickerOpen(false); setBlockInsertAfterId(null) }}>
          <div className={styles.blockPicker}>
            {BLOCK_PICKER.map((item) => <button type="button" key={item.kind} data-block-picker-kind={item.kind} onClick={() => addBlock(item.kind)}><span>{item.icon}</span><b>{item.label}</b><small>{item.description}</small></button>)}
          </div>
          <p className={styles.pickerScope}>프로필은 페이지마다 고정 제공됩니다. 현재 승인된 7개 블록만 노출합니다.</p>
        </Dialog>
      ) : null}

      {pageDialog ? (
        <PageFormDialog state={state} dialog={pageDialog} onClose={() => setPageDialog(null)} onSubmit={addOrEditPage} />
      ) : null}

      {deleteBlockId ? <ConfirmDialog title="블럭을 삭제할까요?" description="삭제한 블럭은 복구할 수 없습니다." onCancel={() => setDeleteBlockId(null)} onConfirm={confirmDeleteBlock} /> : null}
      {deletePageId ? <ConfirmDialog title="페이지를 삭제할까요?" description="자식 페이지는 삭제할 페이지의 상위로 이동하고 해당 페이지만 삭제됩니다." onCancel={() => setDeletePageId(null)} onConfirm={confirmDeletePage} /> : null}

      <button className={styles.resetButton} type="button" onClick={() => setState(repository.reset())}><RotateCcw size={16} /> 예시 복구</button>
    </main>
  )
}

function Placeholder({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className={styles.placeholder}>{icon}<h2>{title}</h2><p>{description}</p><span>프로토타입 비대상</span></div>
}

function ConfirmDialog({ title, description, onCancel, onConfirm }: { title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <p className={styles.confirmDescription}>{description}</p>
      <div className={styles.dialogActions}><button type="button" onClick={onCancel}>취소</button><button className={styles.dangerButton} type="button" onClick={onConfirm}>삭제</button></div>
    </Dialog>
  )
}

function PageFormDialog({ state, dialog, onClose, onSubmit }: { state: LinkPageState; dialog: NonNullable<PageDialogState>; onClose: () => void; onSubmit: (form: FormData) => void }) {
  const existing = dialog.pageId ? state.pages.find((page) => page.id === dialog.pageId) : undefined
  const descendants = existing ? getPageDescendantIds(state, existing.id) : new Set<string>()
  const [slug, setSlug] = useState(existing?.slug ?? `page-${state.pages.length + 1}`)
  const slugError = !isValidSlug(slug) ? '4~50자 영문·숫자·-·_·.만 사용하세요.' : !isSlugAvailable(state, slug, existing?.id) ? '이미 사용했던 slug입니다.' : undefined
  return (
    <Dialog title={dialog.mode === 'add' ? '페이지 추가' : '페이지 편집'} onClose={onClose}>
      <form className={styles.pageForm} action={(form) => { if (!slugError) onSubmit(form) }}>
        <Field label="페이지 이름"><input name="title" required defaultValue={existing?.title ?? ''} /></Field>
        <Field label="공개 URL" hint={`/l/${slug}`} error={slugError}><input name="slug" value={slug} onChange={(event) => setSlug(event.target.value)} /></Field>
        <Field label="상위 페이지">
          <select name="parentId" defaultValue={existing?.parentId ?? ''}>
            <option value="">없음 (루트)</option>
            {state.pages.filter((page) => page.id !== existing?.id && !descendants.has(page.id)).map((page) => <option key={page.id} value={page.id}>{'— '.repeat(getPageDepth(state, page))}{page.title}</option>)}
          </select>
        </Field>
        <div className={styles.dialogActions}><button type="button" onClick={onClose}>취소</button><button type="submit" disabled={Boolean(slugError)}>설정 완료</button></div>
      </form>
    </Dialog>
  )
}
