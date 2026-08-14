'use client'

import Link from 'next/link'
import { Bell, Download, ExternalLink, Share2 } from 'lucide-react'
import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { loadAsset } from '@/lib/link-pages/asset-store'
import {
  AssetReference,
  FileItem,
  GalleryItem,
  LinkBlock,
  LinkItem,
  LinkPage,
  LinkPageState,
  VideoItem,
  isValidHttpUrl,
} from '@/lib/link-pages/model'
import { resolveDestination } from '@/lib/link-pages/navigation'
import styles from './LinkPageRenderer.module.css'

type NavigationPage = Pick<LinkPage, 'id' | 'slug' | 'title'>

export type LinkPageRendererProps = {
  page: LinkPage
  state: LinkPageState
  navigationPages: NavigationPage[]
  surface: 'public' | 'preview'
  onNavigate?: (pageId: string) => void
  onBlockInteract?: (blockId: string, itemId?: string) => void
  onShare?: () => void
}

function AssetImage({
  asset,
  fallbackUrl,
  alt,
  className,
}: {
  asset?: AssetReference
  fallbackUrl?: string
  alt: string
  className?: string
}) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    if (!asset) return
    void loadAsset(asset.id).then((blob) => {
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setAssetUrl(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [asset])

  const src = asset ? assetUrl : fallbackUrl
  if (!src) return <div className={`${styles.imageFallback} ${className ?? ''}`} aria-hidden="true" />
  // Prototype assets can be local IndexedDB object URLs, so next/image is not applicable here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />
}

function getVideoEmbed(item: VideoItem) {
  if (!isValidHttpUrl(item.url)) return null
  const url = new URL(item.url)
  const youtubeMatch = url.hostname.includes('youtu.be')
    ? url.pathname.slice(1)
    : url.searchParams.get('v') ?? url.pathname.match(/\/shorts\/([^/]+)/)?.[1]
  if (youtubeMatch && (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be'))) {
    return `https://www.youtube-nocookie.com/embed/${youtubeMatch}`
  }
  if (url.hostname.includes('vimeo.com')) {
    const id = url.pathname.split('/').filter(Boolean).at(-1)
    return id ? `https://player.vimeo.com/video/${id}` : null
  }
  return null
}

function handlePreviewLink(event: MouseEvent<HTMLAnchorElement>, surface: 'public' | 'preview') {
  if (surface === 'preview') event.preventDefault()
}

function SingleLinkBlock({
  block,
  state,
  surface,
  onInteract,
  onNavigate,
}: {
  block: Extract<LinkBlock, { content: { kind: 'singleLink' } }> | LinkBlock
  state: LinkPageState
  surface: 'public' | 'preview'
  onInteract?: (itemId?: string) => void
  onNavigate?: (pageId: string) => void
}) {
  if (block.content.kind !== 'singleLink') return null
  const content = block.content
  const resolved = resolveDestination(state, content.destination ?? { kind: 'external', url: content.url ?? '' })
  const valid = Boolean(resolved)
  return (
    <a
      className={`${styles.singleLink} ${styles[`single${content.layout}`]} ${content.highlighted ? styles.highlighted : ''}`}
      href={resolved?.href ?? '#'}
      target={surface === 'public' && resolved?.external ? '_blank' : undefined}
      rel="noreferrer"
      aria-disabled={!valid}
      onClick={(event) => {
        handlePreviewLink(event, surface)
        if (!valid) event.preventDefault()
        else {
          if (resolved?.pageId && onNavigate) onNavigate(resolved.pageId)
          onInteract?.()
        }
      }}
    >
      <AssetImage asset={content.image} fallbackUrl={content.imageUrl} alt="" className={styles.linkImage} />
      <span className={styles.linkCopy}>
        {content.tag ? <span className={styles.tag}>{content.tag}</span> : null}
        <strong>{content.title || '링크 제목'}</strong>
        {content.price ? (
          <span className={styles.price}>
            {content.originalPrice ? <del>{content.originalPrice}</del> : null} {content.price}
          </span>
        ) : null}
        {!valid ? <span className={styles.errorText}>올바른 URL을 입력하세요.</span> : null}
      </span>
      <ExternalLink size={17} aria-hidden="true" />
    </a>
  )
}

function GroupLinkBlock({
  block,
  state,
  surface,
  onInteract,
  onNavigate,
}: {
  block: LinkBlock
  state: LinkPageState
  surface: 'public' | 'preview'
  onInteract?: (itemId?: string) => void
  onNavigate?: (pageId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (block.content.kind !== 'groupLink') return null
  const { content } = block
  const visibleItems = content.collapsible && !expanded ? content.items.slice(0, 2) : content.items
  return (
    <section className={styles.sectionCard}>
      {content.title ? <h2>{content.title}</h2> : null}
      <div className={`${styles.linkGroup} ${styles[`group${content.layout}`]}`}>
        {visibleItems.map((item: LinkItem) => {
          const resolved = resolveDestination(state, item.destination ?? { kind: 'external', url: item.url ?? '' })
          const valid = Boolean(resolved)
          return (
            <a
              href={resolved?.href ?? '#'}
              key={item.id}
              target={surface === 'public' && resolved?.external ? '_blank' : undefined}
              rel="noreferrer"
              onClick={(event) => {
                handlePreviewLink(event, surface)
                if (!valid) event.preventDefault()
                else {
                  if (resolved?.pageId && onNavigate) onNavigate(resolved.pageId)
                  onInteract?.(item.id)
                }
              }}
            >
              <AssetImage asset={item.image} fallbackUrl={item.imageUrl} alt="" className={styles.groupImage} />
              <span>
                {item.tag ? <small>{item.tag}</small> : null}
                <strong>{item.title || '링크'}</strong>
                {item.price ? <span className={styles.groupPrice}>{item.originalPrice ? <del>{item.originalPrice}</del> : null} {item.price}</span> : null}
              </span>
            </a>
          )
        })}
      </div>
      {content.collapsible && content.items.length > 2 ? (
        <button className={styles.moreButton} type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? '접기' : '더보기'}
        </button>
      ) : null}
    </section>
  )
}

function TextBlock({ block }: { block: LinkBlock }) {
  if (block.content.kind !== 'text') return null
  const { content } = block
  const inner = (
    <div className={`${styles.textBlock} ${styles[`align${content.align}`]} ${styles[`text${content.size}`]}`}>
      <h2>{content.title}</h2>
      <p>{content.body}</p>
    </div>
  )
  if (content.layout === 'toggle') {
    return (
      <details className={styles.textToggle}>
        <summary>{content.title || '상세 내용'}</summary>
        <p>{content.body}</p>
      </details>
    )
  }
  return inner
}

function GalleryBlock({ block, state, surface, onInteract, onNavigate }: { block: LinkBlock; state: LinkPageState; surface: 'public' | 'preview'; onInteract?: (itemId?: string) => void; onNavigate?: (pageId: string) => void }) {
  const galleryRef = useRef<HTMLDivElement | null>(null)
  const content = block.content.kind === 'gallery' ? block.content : null

  useEffect(() => {
    if (!content?.slideshow || content.items.length < 2) return
    const interval = window.setInterval(() => {
      const gallery = galleryRef.current
      if (!gallery) return
      const atEnd = gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 8
      gallery.scrollTo({ left: atEnd ? 0 : gallery.scrollLeft + gallery.clientWidth * 0.86, behavior: 'smooth' })
    }, 3600)
    return () => window.clearInterval(interval)
  }, [content?.items.length, content?.slideshow])

  if (!content) return null

  return (
    <section className={styles.sectionCard}>
      {content.title ? <h2>{content.title}</h2> : null}
      {content.items.length ? (
        <div ref={galleryRef} className={`${styles.gallery} ${styles[`gallery${content.layout}`]} ${content.keepRatio ? styles.galleryKeepRatio : ''}`}>
          {content.items.map((item: GalleryItem) => {
            const image = <AssetImage asset={item.asset} fallbackUrl={item.imageUrl} alt={item.alt || '갤러리 이미지'} />
            const resolved = resolveDestination(state, item.destination ?? (item.url ? { kind: 'external', url: item.url } : undefined))
            return resolved ? (
              <a
                key={item.id}
                href={resolved.href}
                target={surface === 'public' && resolved.external ? '_blank' : undefined}
                rel="noreferrer"
                onClick={(event) => {
                  handlePreviewLink(event, surface)
                  if (resolved.pageId && onNavigate) onNavigate(resolved.pageId)
                  onInteract?.(item.id)
                }}
              >
                {image}
              </a>
            ) : <div key={item.id}>{image}</div>
          })}
        </div>
      ) : <p className={styles.emptyBlock}>이미지를 추가하면 갤러리가 표시됩니다.</p>}
    </section>
  )
}

function VideoBlock({ block, surface, onInteract }: { block: LinkBlock; surface: 'public' | 'preview'; onInteract?: (itemId?: string) => void }) {
  if (block.content.kind !== 'video') return null
  const { content } = block
  return (
    <section className={styles.sectionCard}>
      {content.title ? <h2>{content.title}</h2> : null}
      <div className={`${styles.videoGrid} ${styles[`video${content.layout}`]}`}>
        {content.items.map((item: VideoItem) => {
          const embed = getVideoEmbed(item)
          if (embed) {
            return (
              <div className={styles.videoFrame} key={item.id} onClick={() => onInteract?.(item.id)}>
                <iframe
                  src={`${embed}${content.autoplayMuted ? '?autoplay=1&mute=1' : ''}`}
                  title={content.title || '영상'}
                  loading="lazy"
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )
          }
          const valid = isValidHttpUrl(item.url)
          return (
            <a
              className={styles.videoFallback}
              key={item.id}
              href={valid ? item.url : '#'}
              target={surface === 'public' && valid ? '_blank' : undefined}
              rel="noreferrer"
              onClick={(event) => {
                handlePreviewLink(event, surface)
                if (!valid) event.preventDefault()
                else onInteract?.(item.id)
              }}
            >
              <span>{valid ? '영상 링크 보기' : '올바른 영상 URL을 입력하세요.'}</span>
              <ExternalLink size={18} aria-hidden="true" />
            </a>
          )
        })}
      </div>
    </section>
  )
}

async function downloadFile(item: FileItem) {
  const blob = await loadAsset(item.asset.id)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = item.asset.name
  anchor.click()
  URL.revokeObjectURL(url)
}

function FileShareBlock({ block, onInteract }: { block: LinkBlock; onInteract?: (itemId?: string) => void }) {
  if (block.content.kind !== 'fileShare') return null
  const { content } = block
  return (
    <section className={`${styles.sectionCard} ${styles.fileShare}`}>
      <AssetImage asset={content.image} fallbackUrl={content.imageUrl} alt="" className={styles.fileCover} />
      <h2>{content.title}</h2>
      {content.description ? <p>{content.description}</p> : null}
      {content.files.length ? content.files.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => {
            onInteract?.(item.id)
            void downloadFile(item)
          }}
        >
          <span>{item.asset.name}</span>
          <Download size={18} aria-hidden="true" />
        </button>
      )) : <p className={styles.emptyBlock}>공유할 파일을 추가하세요.</p>}
    </section>
  )
}

function BlockRenderer({
  block,
  state,
  surface,
  onInteract,
  onNavigate,
}: {
  block: LinkBlock
  state: LinkPageState
  surface: 'public' | 'preview'
  onInteract?: (itemId?: string) => void
  onNavigate?: (pageId: string) => void
}) {
  if (!block.enabled || block.kind === 'profile') return null
  if (block.content.kind === 'singleLink') return <SingleLinkBlock block={block} state={state} surface={surface} onInteract={onInteract} onNavigate={onNavigate} />
  if (block.content.kind === 'groupLink') return <GroupLinkBlock block={block} state={state} surface={surface} onInteract={onInteract} onNavigate={onNavigate} />
  if (block.content.kind === 'text') return <TextBlock block={block} />
  if (block.content.kind === 'gallery') return <GalleryBlock block={block} state={state} surface={surface} onInteract={onInteract} onNavigate={onNavigate} />
  if (block.content.kind === 'video') return <VideoBlock block={block} surface={surface} onInteract={onInteract} />
  if (block.content.kind === 'fileShare') return <FileShareBlock block={block} onInteract={onInteract} />
  return null
}

export function LinkPageRenderer({
  page,
  state,
  navigationPages,
  surface,
  onNavigate,
  onBlockInteract,
  onShare,
}: LinkPageRendererProps) {
  const profile = useMemo(
    () => page.blocks.find((block) => block.kind === 'profile' && block.enabled),
    [page.blocks],
  )
  const orderedBlocks = useMemo(
    () => page.blocks.filter((block) => block.kind !== 'profile').sort((a, b) => a.sortOrder - b.sortOrder),
    [page.blocks],
  )
  const profileContent = profile?.content.kind === 'profile' ? profile.content : null
  const fontClass = styles[`type${page.theme.typographyPreset}`]
  const utilityBar = (
    <div className={styles.utilityBar}>
      {page.theme.showShare ? <button type="button" aria-label="페이지 공유" onClick={onShare}><Share2 size={18} /></button> : null}
      {page.theme.showSubscribe ? <button type="button" aria-label="알림"><Bell size={18} /></button> : null}
    </div>
  )

  return (
    <article
      className={`${styles.page} ${styles[surface]} ${fontClass} ${styles[`shape${page.theme.buttonShape}`]} ${styles[`action${page.theme.buttonAction}`]} ${styles[`menu${page.theme.topMenuStyle}`]}`}
      style={{
        '--link-page-bg': page.theme.backgroundColor,
        '--link-page-surface': page.theme.surfaceColor,
        '--link-page-text': page.theme.textColor,
        '--link-page-button': page.theme.buttonColor,
        '--link-page-button-text': page.theme.buttonTextColor,
      } as React.CSSProperties}
      data-testid={`link-page-renderer-${surface}`}
    >
      {page.theme.backgroundImage || page.theme.backgroundImageUrl ? <AssetImage asset={page.theme.backgroundImage} fallbackUrl={page.theme.backgroundImageUrl} alt="" className={styles.themeBackground} /> : null}
      {page.theme.logoMode === 'custom' && (page.theme.logo || page.theme.logoUrl) ? <AssetImage asset={page.theme.logo} fallbackUrl={page.theme.logoUrl} alt="" className={styles.themeLogo} /> : null}
      {profileContent ? (
        <header className={`${styles.profile} ${styles[`profile${profileContent.layout}`]} ${styles[`profileSize${profileContent.size}`]}`}>
          {utilityBar}
          {profileContent.cover || profileContent.coverUrl ? (
            <AssetImage asset={profileContent.cover} fallbackUrl={profileContent.coverUrl} alt="" className={styles.profileCover} />
          ) : null}
          <AssetImage asset={profileContent.image} fallbackUrl={profileContent.imageUrl} alt="" className={styles.profileImage} />
          <div className={styles.profileCopy}>
            <h1>{profileContent.title}</h1>
            <p>{profileContent.description}</p>
          </div>
        </header>
      ) : utilityBar}

      {page.theme.showNavigation && navigationPages.length > 1 ? (
        <nav className={styles.pageNavigation} aria-label="자료 페이지">
          {navigationPages.map((item) => (
            <Link
              key={item.id}
              href={`/l/${item.slug}`}
              aria-current={item.id === page.id ? 'page' : undefined}
              onClick={(event) => {
                if (onNavigate) {
                  event.preventDefault()
                  onNavigate(item.id)
                }
              }}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className={styles.blocks}>
        {orderedBlocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            state={state}
            surface={surface}
            onNavigate={onNavigate}
            onInteract={(itemId) => onBlockInteract?.(block.id, itemId)}
          />
        ))}
      </div>
    </article>
  )
}
