import type { LinkPage, LinkPageState } from './model'

export type PageTreeIndex = {
  byId: ReadonlyMap<string, LinkPage>
  childrenByParentId: ReadonlyMap<string | null, readonly LinkPage[]>
  roots: readonly LinkPage[]
  invalidEdgeIds: ReadonlySet<string>
}

export type VisibleTreeRow = {
  page: LinkPage
  depth: number
  hasChildren: boolean
  expanded: boolean
}

function comparePages(left: LinkPage, right: LinkPage) {
  return left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
}

export function createPageTreeIndex(pages: readonly LinkPage[]): PageTreeIndex {
  const byId = new Map(pages.map((page) => [page.id, page]))
  const invalidEdgeIds = new Set<string>()
  const complete = new Set<string>()

  for (const page of pages) {
    if (complete.has(page.id)) continue
    const path: string[] = []
    const position = new Map<string, number>()
    let current: LinkPage | undefined = page

    while (current && !complete.has(current.id)) {
      const cycleStart = position.get(current.id)
      if (cycleStart !== undefined) {
        for (const id of path.slice(cycleStart)) invalidEdgeIds.add(id)
        break
      }
      position.set(current.id, path.length)
      path.push(current.id)
      if (current.parentId === null) break
      const parent = byId.get(current.parentId)
      if (!parent) {
        invalidEdgeIds.add(current.id)
        break
      }
      current = parent
    }
    for (const id of path) complete.add(id)
  }

  const mutableChildren = new Map<string | null, LinkPage[]>()
  for (const page of pages) {
    if (invalidEdgeIds.has(page.id)) continue
    if (page.parentId !== null && !byId.has(page.parentId)) continue
    const siblings = mutableChildren.get(page.parentId) ?? []
    siblings.push(page)
    mutableChildren.set(page.parentId, siblings)
  }
  for (const siblings of mutableChildren.values()) siblings.sort(comparePages)

  return {
    byId,
    childrenByParentId: mutableChildren,
    roots: mutableChildren.get(null) ?? [],
    invalidEdgeIds,
  }
}

export function getAncestorIds(index: PageTreeIndex, pageId: string) {
  const ancestors: string[] = []
  const visited = new Set<string>([pageId])
  let parentId = index.byId.get(pageId)?.parentId ?? null
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    ancestors.unshift(parentId)
    parentId = index.byId.get(parentId)?.parentId ?? null
  }
  return ancestors
}

export function getVisibleTreeRows(
  index: PageTreeIndex,
  expandedIds: ReadonlySet<string>,
  query = '',
): VisibleTreeRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')
  const included = new Set<string>()
  if (normalizedQuery) {
    for (const page of index.byId.values()) {
      if (`${page.title}\n${page.slug}`.toLocaleLowerCase('ko-KR').includes(normalizedQuery)) {
        included.add(page.id)
        for (const ancestorId of getAncestorIds(index, page.id)) included.add(ancestorId)
      }
    }
  }

  const rows: VisibleTreeRow[] = []
  const visited = new Set<string>()
  const pending = [...index.roots].reverse().map((page) => ({ page, depth: 0 }))
  while (pending.length) {
    const current = pending.pop()
    if (!current || visited.has(current.page.id)) continue
    visited.add(current.page.id)
    const children = index.childrenByParentId.get(current.page.id) ?? []
    const visibleChildren = normalizedQuery ? children.filter((child) => included.has(child.id)) : children
    if (!normalizedQuery || included.has(current.page.id)) {
      rows.push({
        page: current.page,
        depth: current.depth,
        hasChildren: children.length > 0,
        expanded: normalizedQuery ? visibleChildren.length > 0 : expandedIds.has(current.page.id),
      })
    }
    if (normalizedQuery || expandedIds.has(current.page.id)) {
      for (let indexOfChild = visibleChildren.length - 1; indexOfChild >= 0; indexOfChild -= 1) {
        pending.push({ page: visibleChildren[indexOfChild], depth: current.depth + 1 })
      }
    }
  }
  return rows
}

export function getPageDescendantIds(state: LinkPageState, pageId: string) {
  const index = createPageTreeIndex(state.pages)
  const descendants = new Set<string>()
  const pending = [...(index.childrenByParentId.get(pageId) ?? [])]
  while (pending.length) {
    const page = pending.pop()
    if (!page || descendants.has(page.id)) continue
    descendants.add(page.id)
    pending.push(...(index.childrenByParentId.get(page.id) ?? []))
  }
  return descendants
}

export function canSetPageParent(state: LinkPageState, pageId: string, parentId: string | null) {
  if (!parentId) return true
  return parentId !== pageId && !getPageDescendantIds(state, pageId).has(parentId)
}

export function getPageDepth(state: LinkPageState, page: LinkPage) {
  return getAncestorIds(createPageTreeIndex(state.pages), page.id).length
}

export function getOrderedPageTree(state: LinkPageState) {
  const index = createPageTreeIndex(state.pages)
  return getVisibleTreeRows(index, new Set(index.byId.keys())).map((row) => row.page)
}
