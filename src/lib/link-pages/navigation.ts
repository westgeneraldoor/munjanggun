import type { GalleryItem, LinkDestination, LinkItem, LinkPage, LinkPageState } from './model'

export type ResolvedLinkDestination = {
  href: string
  external: boolean
  pageId?: string
}

export type InboundPageReference = {
  sourcePageId: string
  blockId: string | null
  itemId: string | null
  kind: 'singleLink' | 'groupLink' | 'gallery' | 'parent'
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function getNavigationPages(state: LinkPageState): LinkPage[]
export function getNavigationPages(state: LinkPageState, currentPage: LinkPage): LinkPage[]
export function getNavigationPages(state: LinkPageState) {
  return state.pages
    .filter((page) => page.status === 'published' && page.role === 'navigation' && page.parentId === null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
}

export function resolveDestination(
  state: LinkPageState,
  destination: LinkDestination | undefined,
): ResolvedLinkDestination | null {
  if (!destination) return null
  if (destination.kind === 'external') {
    return isHttpUrl(destination.url) ? { href: destination.url, external: true } : null
  }
  const target = state.pages.find((page) => page.id === destination.pageId)
  if (!target || target.status !== 'published') return null
  return { href: `/l/${target.slug}`, external: false, pageId: target.id }
}

function destinationTargetsPage(destination: LinkDestination | undefined, pageId: string) {
  return destination?.kind === 'page' && destination.pageId === pageId
}

function itemDestination(item: LinkItem | GalleryItem) {
  return item.destination
}

export function getInboundPageReferences(state: LinkPageState, pageId: string) {
  const references: InboundPageReference[] = []
  for (const page of state.pages) {
    if (page.parentId === pageId) {
      references.push({ sourcePageId: page.id, blockId: null, itemId: null, kind: 'parent' })
    }
    for (const block of page.blocks) {
      const content = block.content
      if (content.kind === 'singleLink' && destinationTargetsPage(content.destination, pageId)) {
        references.push({ sourcePageId: page.id, blockId: block.id, itemId: null, kind: 'singleLink' })
      }
      if (content.kind === 'groupLink') {
        for (const item of content.items) {
          if (destinationTargetsPage(itemDestination(item), pageId)) {
            references.push({ sourcePageId: page.id, blockId: block.id, itemId: item.id, kind: 'groupLink' })
          }
        }
      }
      if (content.kind === 'gallery') {
        for (const item of content.items) {
          if (destinationTargetsPage(itemDestination(item), pageId)) {
            references.push({ sourcePageId: page.id, blockId: block.id, itemId: item.id, kind: 'gallery' })
          }
        }
      }
    }
  }
  return references
}
