'use client'

import { ExternalLink, FileSymlink, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LinkDestination, LinkPage } from '@/lib/link-pages/model'
import { isValidHttpUrl } from '@/lib/link-pages/model'
import styles from './LinkDestinationField.module.css'

export type LinkMetadataSuggestion = {
  title?: string
  imageUrl?: string
  faviconUrl?: string
  status: 'found' | 'empty' | 'blocked'
}

type LinkDestinationFieldProps = {
  value: LinkDestination
  pages: LinkPage[]
  currentPageId: string
  onChange: (value: LinkDestination) => void
  onMetadata?: (suggestion: LinkMetadataSuggestion, requestedUrl: string) => void
}

const metadataCache = new Map<string, LinkMetadataSuggestion>()

export function LinkDestinationField({ value, pages, currentPageId, onChange, onMetadata }: LinkDestinationFieldProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'empty' | 'blocked'>('idle')
  const requestVersion = useRef(0)
  const onMetadataRef = useRef(onMetadata)
  const externalUrl = value.kind === 'external' ? value.url : null

  useEffect(() => {
    onMetadataRef.current = onMetadata
  }, [onMetadata])

  useEffect(() => {
    const version = ++requestVersion.current
    if (!externalUrl || !isValidHttpUrl(externalUrl)) {
      queueMicrotask(() => {
        if (version === requestVersion.current) setStatus('idle')
      })
      return
    }
    const requestedUrl = externalUrl
    const cached = metadataCache.get(requestedUrl)
    if (cached) {
      queueMicrotask(() => {
        if (version !== requestVersion.current) return
        setStatus(cached.status)
        onMetadataRef.current?.(cached, requestedUrl)
      })
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setStatus('loading')
      try {
        const response = await fetch('/api/link-pages/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: requestedUrl }),
          signal: controller.signal,
        })
        const result = await response.json() as LinkMetadataSuggestion
        if (version !== requestVersion.current) return
        const normalized = response.ok && ['found', 'empty', 'blocked'].includes(result.status)
          ? result
          : { status: 'blocked' as const }
        metadataCache.set(requestedUrl, normalized)
        setStatus(normalized.status)
        onMetadataRef.current?.(normalized, requestedUrl)
      } catch {
        if (controller.signal.aborted || version !== requestVersion.current) return
        setStatus('blocked')
      }
    }, 500)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [externalUrl])

  const publishedPages = pages.filter((page) => page.status === 'published')
  return (
    <div className={styles.fieldset}>
      <span className={styles.legend}>이동 위치 *</span>
      <div className={styles.mode} role="radiogroup" aria-label="링크 이동 방식">
        <button type="button" role="radio" aria-checked={value.kind === 'external'} onClick={() => onChange({ kind: 'external', url: 'https://' })}>
          <ExternalLink size={17} aria-hidden="true" />외부 링크
        </button>
        <button type="button" role="radio" aria-checked={value.kind === 'page'} onClick={() => onChange({ kind: 'page', pageId: '' })}>
          <FileSymlink size={17} aria-hidden="true" />내부 페이지
        </button>
      </div>
      {value.kind === 'external' ? (
        <label className={styles.control}>
          <span>연결 URL</span>
          <input aria-label="연결 URL *" value={value.url} onChange={(event) => onChange({ kind: 'external', url: event.target.value })} placeholder="https://" inputMode="url" />
        </label>
      ) : (
        <label className={styles.control}>
          <span>이동할 페이지</span>
          <select required aria-label="이동할 페이지" value={value.pageId} onChange={(event) => onChange({ kind: 'page', pageId: event.target.value })}>
            <option value="">페이지를 선택하세요</option>
            {publishedPages.map((page) => <option key={page.id} value={page.id}>{page.id === currentPageId ? `${page.title} (현재 페이지)` : page.title}</option>)}
          </select>
        </label>
      )}
      {value.kind === 'external' && status !== 'idle' ? (
        <p className={styles.status} role="status">
          {status === 'loading' ? <><LoaderCircle className={styles.spinner} size={15} />표지 정보를 확인하고 있어요.</> : null}
          {status === 'found' ? '표지 정보 후보를 불러왔어요. 직접 입력한 값은 유지됩니다.' : null}
          {status === 'empty' ? '이 링크에서 사용할 표지 정보를 찾지 못했어요.' : null}
          {status === 'blocked' ? '자동 확인이 어려운 링크예요. 제목과 이미지를 직접 넣어주세요.' : null}
        </p>
      ) : null}
    </div>
  )
}
