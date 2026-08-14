'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createBrowserLinkPageRepository, subscribeToLinkPageState } from '@/lib/link-pages/browser-repository'
import { LinkPage, LinkPageState, createId, getNavigationPages, resolvePageBySlug } from '@/lib/link-pages/model'
import { LinkPageRenderer } from './LinkPageRenderer'
import styles from './PublicLinkPageClient.module.css'

const repository = createBrowserLinkPageRepository()

export function PublicLinkPageClient({ slug }: { slug: string }) {
  const router = useRouter()
  const [result, setResult] = useState<{ state: LinkPageState; page: LinkPage } | null>(null)
  const [missing, setMissing] = useState(false)
  const pageViewEvent = useRef<{ pageId: string; id: string } | null>(null)

  useEffect(() => {
    const load = () => {
      const state = repository.load()
      const resolved = resolvePageBySlug(state, slug)
      if (!resolved || resolved.page.status !== 'published') {
        setMissing(true)
        setResult(null)
        return
      }
      setMissing(false)
      setResult({ state, page: resolved.page })
      if (resolved.isAlias) router.replace(`/l/${resolved.page.slug}`)
    }
    load()
    return subscribeToLinkPageState(load)
  }, [router, slug])

  useEffect(() => {
    if (!result) return
    if (pageViewEvent.current?.pageId !== result.page.id) pageViewEvent.current = { pageId: result.page.id, id: createId() }
    repository.recordEvent({
      id: pageViewEvent.current.id,
      type: 'page_view',
      pageId: result.page.id,
      blockId: null,
      itemId: null,
      occurredAt: new Date().toISOString(),
    })
  }, [result])

  if (missing) {
    return <main className={styles.state}><h1>페이지를 찾을 수 없어요.</h1><p>보낸 링크가 맞는지 확인해주세요.</p></main>
  }
  if (!result) return <main className={styles.state} aria-busy="true">페이지를 불러오는 중입니다.</main>

  const { state, page } = result
  return (
    <main className={styles.publicShell} style={{ backgroundColor: page.theme.backgroundColor }}>
      <LinkPageRenderer
        page={page}
        navigationPages={getNavigationPages(state, page)}
        surface="public"
        onShare={() => {
          if (navigator.share) void navigator.share({ title: page.title, url: location.href })
          else void navigator.clipboard.writeText(location.href)
        }}
        onBlockInteract={(blockId, itemId) => repository.recordEvent({
          id: createId(),
          type: 'block_click',
          pageId: page.id,
          blockId,
          itemId: itemId ?? null,
          occurredAt: new Date().toISOString(),
        })}
      />
    </main>
  )
}
