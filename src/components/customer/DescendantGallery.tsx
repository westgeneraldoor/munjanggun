'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ImageLightbox from '@/components/customer/ImageLightbox'
import ShowroomImage from '@/components/showroom/ShowroomImage'
import type { ShowroomImageSource } from '@/lib/showroom/image-sources'
import styles from './DescendantGallery.module.css'

type DescendantGalleryItem = {
  id: string
  assetKey: string
  imageUrl: string
  caption: string | null
  optionName: string
  optionUrl: string
  optionBreadcrumb: string[]
  imageSource: ShowroomImageSource
}

type DescendantGalleryPage = {
  items: DescendantGalleryItem[]
  nextOffset: number | null
  hasMore: boolean
  snapshot: string
}

type DescendantGalleryProps = {
  nodeId: string
  galleryScope?: 'node' | 'root'
  description: string
  initialItems: DescendantGalleryItem[]
  initialNextOffset: number | null
  initialHasMore: boolean
  initialSnapshot: string
}

const GALLERY_PAGE_SIZE = 12
const STORAGE_KEY_PREFIX = 'showroom-descendant-gallery:'
const MODAL_HISTORY_KEY = '__showroomDescendantGalleryModal'

type PersistedDescendantGallery = {
  items: DescendantGalleryItem[]
  nextOffset: number | null
  hasMore: boolean
  snapshot: string
}

type DescendantGalleryModalState = {
  nodeId: string
  photoId: string
}

function galleryStorageKey(nodeId: string) {
  return `${STORAGE_KEY_PREFIX}${nodeId}`
}

function isPersistedGallery(value: unknown): value is PersistedDescendantGallery {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PersistedDescendantGallery>
  return Array.isArray(candidate.items)
    && candidate.items.every(item => (
      typeof item?.id === 'string'
      && typeof item.assetKey === 'string'
      && Array.isArray(item.optionBreadcrumb)
    ))
    && (typeof candidate.nextOffset === 'number' || candidate.nextOffset === null)
    && typeof candidate.hasMore === 'boolean'
    && typeof candidate.snapshot === 'string'
}

function modalStateFromHistory(value: unknown): DescendantGalleryModalState | null {
  if (!value || typeof value !== 'object' || !(MODAL_HISTORY_KEY in value)) return null
  const modalState = (value as Record<string, unknown>)[MODAL_HISTORY_KEY]
  if (!modalState || typeof modalState !== 'object') return null
  const { nodeId, photoId } = modalState as Partial<DescendantGalleryModalState>
  return typeof nodeId === 'string' && typeof photoId === 'string'
    ? { nodeId, photoId }
    : null
}

function withModalHistoryState(nodeId: string, photoId: string) {
  const currentState = window.history.state
  const baseState = currentState && typeof currentState === 'object' ? currentState : {}
  return {
    ...baseState,
    [MODAL_HISTORY_KEY]: { nodeId, photoId },
  }
}

export default function DescendantGallery({
  nodeId,
  galleryScope = 'node',
  description,
  initialItems,
  initialNextOffset,
  initialHasMore,
  initialSnapshot,
}: DescendantGalleryProps) {
  const [items, setItems] = useState(initialItems)
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isStorageReady, setIsStorageReady] = useState(false)
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadInFlight = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const itemsRef = useRef(items)
  const seenAssetKeys = useRef(new Set(initialItems.map(item => item.assetKey)))
  const scrollActivationRef = useRef(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedValue = window.sessionStorage.getItem(galleryStorageKey(nodeId))
        if (storedValue) {
          const restored = JSON.parse(storedValue) as unknown
          if (
            isPersistedGallery(restored)
            && restored.snapshot === initialSnapshot
            && restored.items.length >= initialItems.length
          ) {
            itemsRef.current = restored.items
            seenAssetKeys.current = new Set(restored.items.map(item => item.assetKey))
            setItems(restored.items)
            setNextOffset(restored.nextOffset)
            setHasMore(restored.hasMore)
            setSnapshot(restored.snapshot)
          } else {
            window.sessionStorage.removeItem(galleryStorageKey(nodeId))
          }
        }
      } catch {
        window.sessionStorage.removeItem(galleryStorageKey(nodeId))
      }
      setIsStorageReady(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [nodeId, initialItems, initialHasMore, initialNextOffset, initialSnapshot])

  useEffect(() => {
    if (!isStorageReady) return
    try {
      window.sessionStorage.setItem(galleryStorageKey(nodeId), JSON.stringify({
        items,
        nextOffset,
        hasMore,
        snapshot,
      } satisfies PersistedDescendantGallery))
    } catch {
      // The current page remains usable when session storage is unavailable.
    }
  }, [hasMore, isStorageReady, items, nextOffset, nodeId, snapshot])

  useEffect(() => {
    const activateNextLoad = () => {
      scrollActivationRef.current = true
    }

    window.addEventListener('scroll', activateNextLoad, { passive: true })
    return () => window.removeEventListener('scroll', activateNextLoad)
  }, [])

  const loadMore = useCallback(async () => {
    if (!isStorageReady || loadInFlight.current || !hasMore || nextOffset === null || requiresRefresh) return

    loadInFlight.current = true
    setIsLoading(true)
    setLoadError(null)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const searchParams = new URLSearchParams({
        offset: String(nextOffset),
        limit: String(GALLERY_PAGE_SIZE),
        snapshot,
      })
      if (galleryScope === 'root') {
        searchParams.set('scope', 'root')
      } else {
        searchParams.set('nodeId', nodeId)
      }
      const response = await fetch(`/api/showroom/descendant-gallery?${searchParams.toString()}`, {
        signal: controller.signal,
      })
      if (response.status === 409) {
        const staleError = new Error('The gallery ordering changed.')
        staleError.name = 'DescendantGallerySnapshotMismatchError'
        throw staleError
      }
      if (!response.ok) throw new Error('Unable to load the next gallery page.')

      const page = await response.json() as DescendantGalleryPage
      const newItems = page.items.filter(item => {
        if (seenAssetKeys.current.has(item.assetKey)) return false
        seenAssetKeys.current.add(item.assetKey)
        return true
      })
      if (newItems.length > 0) {
        const combinedItems = [...itemsRef.current, ...newItems]
        itemsRef.current = combinedItems
        setItems(combinedItems)
      }
      setNextOffset(page.nextOffset)
      setHasMore(page.hasMore)
      setSnapshot(page.snapshot)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof Error && error.name === 'DescendantGallerySnapshotMismatchError') {
        setRequiresRefresh(true)
        setLoadError('시공사진 순서가 갱신되었습니다. 목록을 새로 고쳐 주세요.')
        return
      }
      setLoadError('시공사진을 더 불러오지 못했습니다.')
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      loadInFlight.current = false
      setIsLoading(false)
    }
  }, [galleryScope, hasMore, isStorageReady, nextOffset, nodeId, requiresRefresh, snapshot])

  useEffect(() => () => abortControllerRef.current?.abort(), [])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || !isStorageReady) return

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || !scrollActivationRef.current) return
      scrollActivationRef.current = false
      void loadMore()
    }, { rootMargin: '360px 0px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isStorageReady, loadMore])

  const syncModalFromHistory = useCallback((historyState: unknown) => {
    const modalState = modalStateFromHistory(historyState)
    if (!modalState || modalState.nodeId !== nodeId) {
      setSelectedIndex(null)
      return
    }

    const restoredIndex = itemsRef.current.findIndex(item => item.id === modalState.photoId)
    setSelectedIndex(restoredIndex >= 0 ? restoredIndex : null)
  }, [nodeId])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => syncModalFromHistory(event.state)
    const frame = window.requestAnimationFrame(() => syncModalFromHistory(window.history.state))
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [syncModalFromHistory])

  const openViewer = useCallback((index: number) => {
    const photo = itemsRef.current[index]
    if (!photo) return
    window.history.pushState(
      withModalHistoryState(nodeId, photo.id),
      '',
      window.location.href,
    )
    setSelectedIndex(index)
  }, [nodeId])

  const closeViewer = useCallback(() => {
    const modalState = modalStateFromHistory(window.history.state)
    if (modalState?.nodeId === nodeId) {
      window.history.back()
      return
    }
    setSelectedIndex(null)
  }, [nodeId])

  const changeViewerIndex = useCallback((index: number) => {
    const photo = itemsRef.current[index]
    if (!photo) return
    const modalState = modalStateFromHistory(window.history.state)
    if (modalState?.nodeId === nodeId) {
      window.history.replaceState(
        withModalHistoryState(nodeId, photo.id),
        '',
        window.location.href,
      )
    }
    setSelectedIndex(index)
  }, [nodeId])

  const selectedPhoto = selectedIndex === null ? null : items[selectedIndex]

  return (
    <section className={styles.section} aria-labelledby="descendant-gallery-heading">
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <h2 id="descendant-gallery-heading" className={styles.title}>
            완성된 공간
          </h2>
          <p className={styles.description}>{description}</p>
        </div>
      </div>

      <div className={styles.grid}>
        {items.map((item, index) => {
          return (
            <figure
              className={styles.card}
              key={item.id}
            >
              <button
                className={styles.imageButton}
                type="button"
                onClick={() => openViewer(index)}
                aria-label={`${item.optionName} 시공사진 크게 보기`}
              >
                <span className={styles.imageFrame}>
                  <ShowroomImage
                    source={item.imageSource}
                    purpose="card"
                    alt={`${item.optionName} 시공사진`}
                    fill
                    sizes="(min-width: 1180px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className={styles.image}
                  />
                </span>
              </button>
              <figcaption className={styles.cardMeta}>
                <span className={styles.optionName} title={item.optionName}>
                  {item.optionName}
                </span>
                <span className={styles.optionBreadcrumb} title={item.optionBreadcrumb.slice(1).join(' › ')}>
                  {item.optionBreadcrumb.slice(1).join(' › ')}
                </span>
              </figcaption>
            </figure>
          )
        })}
      </div>

      {isLoading && (
        <div className={styles.skeletonGrid} aria-label="시공사진을 더 불러오는 중입니다.">
          {Array.from({ length: 4 }, (_, index) => (
            <div className={styles.skeleton} key={index} />
          ))}
        </div>
      )}

      {loadError && (
        <div className={styles.loadError} role="status">
          <p>{loadError}</p>
          <button
            className={styles.retryButton}
            type="button"
            aria-label={requiresRefresh ? '목록 새로 고침' : undefined}
            onClick={() => {
              if (requiresRefresh) {
                window.location.reload()
                return
              }
              void loadMore()
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {hasMore && <div className={styles.sentinel} ref={sentinelRef} aria-hidden="true" />}

      <ImageLightbox
        photos={items.map(item => ({
          id: item.id,
          image_url: item.imageUrl,
          image_source: item.imageSource,
          caption: item.caption,
          option_name: item.optionName,
          option_href: item.optionUrl,
          option_breadcrumb: item.optionBreadcrumb,
        }))}
        currentIndex={selectedIndex ?? 0}
        isOpen={selectedPhoto !== null}
        onClose={closeViewer}
        onIndexChange={changeViewerIndex}
      />
    </section>
  )
}
