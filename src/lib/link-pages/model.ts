export type LinkPageTab = 'page' | 'design' | 'analytics' | 'manage' | 'marketing'

export type LinkPageRole = 'navigation' | 'child'

export type LinkDestination =
  | { kind: 'external'; url: string }
  | { kind: 'page'; pageId: string }

export type LinkPageTheme = {
  recipeId?: string
  backgroundColor: string
  backgroundImage?: AssetReference
  backgroundImageUrl?: string
  surfaceColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  buttonShape: 'tidy' | 'soft' | 'pill'
  buttonAction: 'none' | 'lift' | 'press' | 'arrow' | 'outline'
  buttonScope: 'all' | 'highlighted'
  typographyPreset: 'editorial' | 'clean' | 'compact'
  topMenuStyle: 'light' | 'ink' | 'minimal'
  showNavigation: boolean
  showShare: boolean
  showSubscribe: boolean
  logoMode: 'default' | 'custom' | 'hidden'
  logo?: AssetReference
  logoUrl?: string
  /** @deprecated V1 renderer compatibility; use typographyPreset. */
  fontKey: 'pretendard' | 'roundwind' | 'serif'
}

export type LinkBlockKind =
  | 'profile'
  | 'singleLink'
  | 'groupLink'
  | 'text'
  | 'gallery'
  | 'video'
  | 'fileShare'

export type AssetReference = {
  id: string
  name: string
  type: string
  size: number
}

export type LinkItem = {
  id: string
  title: string
  url?: string
  destination?: LinkDestination
  tag?: string
  price?: string
  originalPrice?: string
  image?: AssetReference
  imageUrl?: string
}

export type GalleryItem = {
  id: string
  alt: string
  url?: string
  destination?: LinkDestination
  asset?: AssetReference
  imageUrl?: string
}

export type VideoItem = {
  id: string
  url: string
}

export type FileItem = {
  id: string
  asset: AssetReference
}

export type LinkBlockContent =
  | {
      kind: 'profile'
      title: string
      description: string
      layout: 'avatar' | 'dark' | 'overlap' | 'cover'
      size: 'small' | 'medium' | 'large'
      image?: AssetReference
      imageUrl?: string
      cover?: AssetReference
      coverUrl?: string
    }
  | {
      kind: 'singleLink'
      title: string
      url?: string
      destination?: LinkDestination
      layout: 'small' | 'medium' | 'large'
      highlighted: boolean
      tag?: string
      price?: string
      originalPrice?: string
      image?: AssetReference
      imageUrl?: string
    }
  | {
      kind: 'groupLink'
      title: string
      layout: 'list' | 'twoColumn' | 'threeColumn' | 'carousel' | 'doubleCarousel'
      collapsible: boolean
      items: LinkItem[]
    }
  | {
      kind: 'text'
      title: string
      body: string
      layout: 'plain' | 'toggle'
      align: 'left' | 'center' | 'right'
      size: 'small' | 'medium' | 'large'
    }
  | {
      kind: 'gallery'
      title: string
      layout: 'single' | 'carousel' | 'list' | 'thumbnail' | 'masonry'
      keepRatio: boolean
      slideshow: boolean
      items: GalleryItem[]
    }
  | {
      kind: 'video'
      title: string
      layout: 'list' | 'carousel' | 'twoColumn'
      autoplayMuted: boolean
      items: VideoItem[]
    }
  | {
      kind: 'fileShare'
      title: string
      description: string
      files: FileItem[]
      collectFields: false
      image?: AssetReference
      imageUrl?: string
    }

export type LinkBlock = {
  id: string
  pageId: string
  kind: LinkBlockKind
  enabled: boolean
  sortOrder: number
  content: LinkBlockContent
}

export type LinkPage = {
  id: string
  slug: string
  slugAliases: string[]
  parentId: string | null
  sortOrder: number
  status: 'draft' | 'published'
  role: LinkPageRole
  title: string
  theme: LinkPageTheme
  blocks: LinkBlock[]
  createdAt: string
  updatedAt: string
}

export type LinkPageEvent = {
  id: string
  type: 'page_view' | 'block_click'
  pageId: string
  blockId: string | null
  itemId: string | null
  occurredAt: string
}

export type LinkPageState = {
  version: 2
  pages: LinkPage[]
  selectedPageId: string
}

export type LinkPageStateV2 = LinkPageState

export const LINK_PAGE_STORAGE_KEY = 'munjanggun:link-pages:v1'
export const LINK_PAGE_EVENT_KEY = 'munjanggun:link-page-events:v1'
export const LINK_PAGE_CHANNEL = 'munjanggun:link-pages'

const ROOT_PAGE_ID = '7f6a220a-4ca8-48c3-9bca-0fcf43f0e101'
const CHILD_PAGE_ID = '7f6a220a-4ca8-48c3-9bca-0fcf43f0e102'
const NOW = '2026-08-14T00:00:00.000Z'

export function createDefaultLinkPageTheme(
  legacy: Partial<Pick<LinkPageTheme, 'backgroundColor' | 'buttonColor' | 'fontKey'>> = {},
): LinkPageTheme {
  const fontKey = legacy.fontKey ?? 'pretendard'
  return {
    backgroundColor: legacy.backgroundColor ?? '#eef1f4',
    surfaceColor: '#ffffff',
    textColor: '#171717',
    buttonColor: legacy.buttonColor ?? '#171717',
    buttonTextColor: '#ffffff',
    buttonShape: 'soft',
    buttonAction: 'none',
    buttonScope: 'all',
    typographyPreset: fontKey === 'serif' ? 'editorial' : fontKey === 'roundwind' ? 'compact' : 'clean',
    topMenuStyle: 'light',
    showNavigation: true,
    showShare: true,
    showSubscribe: false,
    logoMode: 'default',
    fontKey,
  }
}

export function createId() {
  return crypto.randomUUID()
}

export function createBlock(pageId: string, kind: Exclude<LinkBlockKind, 'profile'>, sortOrder: number): LinkBlock {
  const id = createId()
  const base = { id, pageId, kind, enabled: true, sortOrder }

  if (kind === 'singleLink') {
    return { ...base, content: { kind, title: '새 링크', url: 'https://', destination: { kind: 'external', url: 'https://' }, layout: 'medium', highlighted: false } }
  }
  if (kind === 'groupLink') {
    return { ...base, content: { kind, title: '관련 자료 모음', layout: 'list', collapsible: false, items: [] } }
  }
  if (kind === 'text') {
    return { ...base, content: { kind, title: '제목을 입력하세요', body: '상세 내용을 입력하세요.', layout: 'plain', align: 'left', size: 'medium' } }
  }
  if (kind === 'gallery') {
    return { ...base, content: { kind, title: '시공 사례', layout: 'carousel', keepRatio: true, slideshow: false, items: [] } }
  }
  if (kind === 'video') {
    return { ...base, content: { kind, title: '영상 자료', layout: 'list', autoplayMuted: false, items: [{ id: createId(), url: 'https://' }] } }
  }
  return { ...base, content: { kind: 'fileShare', title: '자료 다운로드', description: '', files: [], collectFields: false } }
}

export function createPage(
  title: string,
  slug: string,
  parentId: string | null,
  sortOrder: number,
  role: LinkPageRole = parentId ? 'child' : 'navigation',
): LinkPage {
  const id = createId()
  const normalizedParentId = role === 'navigation' ? null : parentId
  if (role === 'child' && !normalizedParentId) throw new Error('Child pages require a parent.')
  return {
    id,
    slug,
    slugAliases: [],
    parentId: normalizedParentId,
    sortOrder,
    status: 'published',
    role,
    title,
    theme: createDefaultLinkPageTheme(),
    blocks: [
      {
        id: createId(),
        pageId: id,
        kind: 'profile',
        enabled: true,
        sortOrder: 0,
        content: {
          kind: 'profile',
          title,
          description: '고객에게 필요한 자료를 한곳에서 보여주세요.',
          layout: 'avatar',
          size: 'medium',
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function createInitialLinkPageState(): LinkPageState {
  const rootBlocks: LinkBlock[] = [
    {
      id: '03bb653b-b556-47ba-8b55-6a654f9b1011',
      pageId: ROOT_PAGE_ID,
      kind: 'profile',
      enabled: true,
      sortOrder: 0,
      content: {
        kind: 'profile',
        title: '문장군',
        description: '문이 바뀌는 체험을 아름답게',
        layout: 'dark',
        size: 'large',
        imageUrl: '/images/measure/v2/hero-480.webp',
      },
    },
    {
      id: '03bb653b-b556-47ba-8b55-6a654f9b1012',
      pageId: ROOT_PAGE_ID,
      kind: 'singleLink',
      enabled: true,
      sortOrder: 1,
      content: {
        kind: 'singleLink',
        title: '무료방문실측 견적상담',
        url: 'https://munjanggun.com/measure',
        destination: { kind: 'external', url: 'https://munjanggun.com/measure' },
        layout: 'medium',
        highlighted: true,
        tag: '네이버예약',
        imageUrl: '/images/measure/v2/consultation-640.webp',
      },
    },
    {
      id: '03bb653b-b556-47ba-8b55-6a654f9b1013',
      pageId: ROOT_PAGE_ID,
      kind: 'text',
      enabled: true,
      sortOrder: 2,
      content: {
        kind: 'text',
        title: '상담 전 확인해주세요',
        body: '공간 사진과 대략적인 치수를 알려주시면 더 빠른 상담이 가능합니다.',
        layout: 'toggle',
        align: 'left',
        size: 'medium',
      },
    },
  ]

  const childBlocks: LinkBlock[] = [
    {
      id: '03bb653b-b556-47ba-8b55-6a654f9b1021',
      pageId: CHILD_PAGE_ID,
      kind: 'profile',
      enabled: true,
      sortOrder: 0,
      content: {
        kind: 'profile',
        title: '중문 상담 자료',
        description: '현장과 생활방식에 맞는 중문을 함께 고릅니다.',
        layout: 'cover',
        size: 'large',
        coverUrl: '/images/measure/v2/photo-guide-960.webp',
      },
    },
    {
      id: '03bb653b-b556-47ba-8b55-6a654f9b1022',
      pageId: CHILD_PAGE_ID,
      kind: 'gallery',
      enabled: true,
      sortOrder: 1,
      content: {
        kind: 'gallery',
        title: '중문 상담 예시',
        layout: 'carousel',
        keepRatio: true,
        slideshow: false,
        items: [
          { id: '151b36a7-cdf0-4c83-a6d0-f98341130101', alt: '중문 상담 자료 1', imageUrl: '/images/measure/v2/hero-720.webp' },
          { id: '151b36a7-cdf0-4c83-a6d0-f98341130102', alt: '중문 상담 자료 2', imageUrl: '/images/measure/v2/finish-640.webp' },
        ],
      },
    },
  ]

  return {
    version: 2,
    selectedPageId: ROOT_PAGE_ID,
    pages: [
      {
        id: ROOT_PAGE_ID,
        slug: 'munjanggun',
        slugAliases: [],
        parentId: null,
        sortOrder: 0,
        status: 'published',
        role: 'navigation',
        title: '문장군 상담',
        theme: createDefaultLinkPageTheme({ backgroundColor: '#eef1f4', buttonColor: '#171717', fontKey: 'pretendard' }),
        blocks: rootBlocks,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: CHILD_PAGE_ID,
        slug: 'sliding-door',
        slugAliases: [],
        parentId: ROOT_PAGE_ID,
        sortOrder: 0,
        status: 'published',
        role: 'child',
        title: '중문 상담 자료',
        theme: createDefaultLinkPageTheme({ backgroundColor: '#eef1f4', buttonColor: '#274237', fontKey: 'pretendard' }),
        blocks: childBlocks,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isAssetReference(value: unknown) {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.type === 'string' && typeof value.size === 'number'
}

function hasValidOptionalAsset(content: Record<string, unknown>, key: string) {
  return content[key] === undefined || isAssetReference(content[key])
}

function isValidDestination(value: unknown): value is LinkDestination {
  if (!isRecord(value)) return false
  if (value.kind === 'external') return typeof value.url === 'string'
  return value.kind === 'page' && typeof value.pageId === 'string'
}

function hasValidOptionalDestination(content: Record<string, unknown>) {
  return content.destination === undefined || isValidDestination(content.destination)
}

function isValidBlockContent(value: unknown, kind: LinkBlockKind): value is LinkBlockContent {
  if (!isRecord(value) || value.kind !== kind) return false

  if (kind === 'profile') {
    return typeof value.title === 'string' && typeof value.description === 'string'
      && ['avatar', 'dark', 'overlap', 'cover'].includes(String(value.layout))
      && ['small', 'medium', 'large'].includes(String(value.size))
      && hasValidOptionalAsset(value, 'image') && hasValidOptionalAsset(value, 'cover')
  }
  if (kind === 'singleLink') {
    return typeof value.title === 'string' && (value.url === undefined || typeof value.url === 'string') && typeof value.highlighted === 'boolean'
      && ['small', 'medium', 'large'].includes(String(value.layout)) && hasValidOptionalAsset(value, 'image')
      && hasValidOptionalDestination(value) && (typeof value.url === 'string' || value.destination !== undefined)
  }
  if (kind === 'groupLink') {
    return typeof value.title === 'string' && typeof value.collapsible === 'boolean'
      && ['list', 'twoColumn', 'threeColumn', 'carousel', 'doubleCarousel'].includes(String(value.layout))
      && Array.isArray(value.items) && value.items.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' && (item.url === undefined || typeof item.url === 'string') && hasValidOptionalAsset(item, 'image') && hasValidOptionalDestination(item) && (typeof item.url === 'string' || item.destination !== undefined))
  }
  if (kind === 'text') {
    return typeof value.title === 'string' && typeof value.body === 'string'
      && ['plain', 'toggle'].includes(String(value.layout)) && ['left', 'center', 'right'].includes(String(value.align))
      && ['small', 'medium', 'large'].includes(String(value.size))
  }
  if (kind === 'gallery') {
    return typeof value.title === 'string' && typeof value.keepRatio === 'boolean' && typeof value.slideshow === 'boolean'
      && ['single', 'carousel', 'list', 'thumbnail', 'masonry'].includes(String(value.layout))
      && Array.isArray(value.items) && value.items.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.alt === 'string' && hasValidOptionalAsset(item, 'asset') && hasValidOptionalDestination(item))
  }
  if (kind === 'video') {
    return typeof value.title === 'string' && typeof value.autoplayMuted === 'boolean'
      && ['list', 'carousel', 'twoColumn'].includes(String(value.layout))
      && Array.isArray(value.items) && value.items.every((item) => isRecord(item) && typeof item.id === 'string' && typeof item.url === 'string')
  }
  return typeof value.title === 'string' && typeof value.description === 'string' && value.collectFields === false
    && hasValidOptionalAsset(value, 'image') && Array.isArray(value.files)
    && value.files.every((item) => isRecord(item) && typeof item.id === 'string' && isAssetReference(item.asset))
}

function isValidTheme(value: unknown): value is LinkPageTheme {
  if (!isRecord(value)) return false
  return (value.recipeId === undefined || typeof value.recipeId === 'string')
    && typeof value.backgroundColor === 'string'
    && hasValidOptionalAsset(value, 'backgroundImage')
    && (value.backgroundImageUrl === undefined || typeof value.backgroundImageUrl === 'string')
    && typeof value.surfaceColor === 'string'
    && typeof value.textColor === 'string'
    && typeof value.buttonColor === 'string'
    && typeof value.buttonTextColor === 'string'
    && ['tidy', 'soft', 'pill'].includes(String(value.buttonShape))
    && ['none', 'lift', 'press', 'arrow', 'outline'].includes(String(value.buttonAction))
    && ['all', 'highlighted'].includes(String(value.buttonScope))
    && ['editorial', 'clean', 'compact'].includes(String(value.typographyPreset))
    && ['light', 'ink', 'minimal'].includes(String(value.topMenuStyle))
    && typeof value.showNavigation === 'boolean'
    && typeof value.showShare === 'boolean'
    && typeof value.showSubscribe === 'boolean'
    && ['default', 'custom', 'hidden'].includes(String(value.logoMode))
    && hasValidOptionalAsset(value, 'logo')
    && (value.logoUrl === undefined || typeof value.logoUrl === 'string')
    && (value.fontKey === undefined || ['pretendard', 'roundwind', 'serif'].includes(String(value.fontKey)))
}

function isRecognizedV1State(value: unknown): value is Record<string, unknown> & { version: 1; pages: Array<Record<string, unknown>>; selectedPageId: string } {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.pages) || value.pages.length === 0 || typeof value.selectedPageId !== 'string') return false
  for (const page of value.pages) {
    if (!isRecord(page) || typeof page.id !== 'string' || typeof page.slug !== 'string' || !Array.isArray(page.slugAliases)) return false
    if ((typeof page.parentId !== 'string' && page.parentId !== null) || !Array.isArray(page.blocks) || !isRecord(page.theme)) return false
    if (typeof page.theme.backgroundColor !== 'string' || typeof page.theme.buttonColor !== 'string' || !['pretendard', 'roundwind', 'serif'].includes(String(page.theme.fontKey))) return false
    for (const block of page.blocks) {
      if (!isRecord(block) || typeof block.kind !== 'string' || !isValidBlockContent(block.content, block.kind as LinkBlockKind)) return false
    }
  }
  return true
}

function migrateBlockContent(content: LinkBlockContent): LinkBlockContent {
  if (content.kind === 'singleLink') {
    return { ...content, destination: content.destination ?? { kind: 'external', url: content.url ?? '' } }
  }
  if (content.kind === 'groupLink') {
    return {
      ...content,
      items: content.items.map((item) => ({
        ...item,
        destination: item.destination ?? { kind: 'external', url: item.url ?? '' },
      })),
    }
  }
  if (content.kind === 'gallery') {
    return {
      ...content,
      items: content.items.map((item) => item.destination || !item.url
        ? item
        : { ...item, destination: { kind: 'external' as const, url: item.url } }),
    }
  }
  return content
}

export class UnrecognizedLinkPageStateError extends Error {
  constructor() {
    super('Stored link-page data is not a recognized V1 or V2 state. Reset is required explicitly.')
    this.name = 'UnrecognizedLinkPageStateError'
  }
}

function backfillV2NavigationVisibility(raw: unknown): unknown {
  if (!isRecord(raw) || raw.version !== 2 || !Array.isArray(raw.pages)) return raw

  let changed = false
  const pages = raw.pages.map((page) => {
    if (!isRecord(page) || !isRecord(page.theme) || page.theme.showNavigation !== undefined) return page
    changed = true
    return { ...page, theme: { ...page.theme, showNavigation: true } }
  })

  return changed ? { ...raw, pages } : raw
}

export function migrateLinkPageState(raw: unknown): LinkPageStateV2 {
  if (isLinkPageStateV2(raw)) return raw
  const backfilledV2 = backfillV2NavigationVisibility(raw)
  if (isLinkPageStateV2(backfilledV2)) return backfilledV2
  if (!isRecognizedV1State(raw)) throw new UnrecognizedLinkPageStateError()

  const pages = raw.pages.map((legacyPage) => {
    const parentId = legacyPage.parentId as string | null
    const legacyTheme = legacyPage.theme as Pick<LinkPageTheme, 'backgroundColor' | 'buttonColor' | 'fontKey'>
    const blocks = (legacyPage.blocks as LinkBlock[]).map((block) => ({
      ...block,
      content: migrateBlockContent(block.content),
    }))
    return {
      ...legacyPage,
      parentId,
      role: parentId === null ? 'navigation' as const : 'child' as const,
      theme: createDefaultLinkPageTheme(legacyTheme),
      blocks,
    } as LinkPage
  })

  const migrated: LinkPageStateV2 = {
    version: 2,
    pages,
    selectedPageId: raw.selectedPageId,
  }
  if (!isLinkPageStateV2(migrated)) throw new UnrecognizedLinkPageStateError()
  return migrated
}

export function isLinkPageStateV2(value: unknown): value is LinkPageStateV2 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LinkPageState>
  if (candidate.version !== 2 || !Array.isArray(candidate.pages) || candidate.pages.length === 0 || typeof candidate.selectedPageId !== 'string') return false

  const pageIds = new Set<string>()
  const blockIds = new Set<string>()
  const itemIds = new Set<string>()
  const slugs = new Set<string>()
  const allowedKinds = new Set<LinkBlockKind>(['profile', 'singleLink', 'groupLink', 'text', 'gallery', 'video', 'fileShare'])

  for (const unknownPage of candidate.pages) {
    if (!unknownPage || typeof unknownPage !== 'object') return false
    const page = unknownPage as Partial<LinkPage>
    if (typeof page.id !== 'string' || pageIds.has(page.id) || typeof page.slug !== 'string' || !isValidSlug(page.slug)) return false
    if (typeof page.parentId !== 'string' && page.parentId !== null) return false
    if (typeof page.sortOrder !== 'number' || !Number.isInteger(page.sortOrder) || page.sortOrder < 0 || !Array.isArray(page.blocks)) return false
    if (typeof page.title !== 'string' || (page.status !== 'draft' && page.status !== 'published')) return false
    if ((page.role !== 'navigation' && page.role !== 'child') || !isValidTheme(page.theme)) return false
    if ((page.role === 'navigation' && page.parentId !== null) || (page.role === 'child' && page.parentId === null)) return false
    if (!Array.isArray(page.slugAliases) || page.slugAliases.some((slug) => typeof slug !== 'string' || !isValidSlug(slug))) return false
    pageIds.add(page.id)
    for (const slug of [page.slug, ...page.slugAliases]) {
      if (slugs.has(slug)) return false
      slugs.add(slug)
    }

    let profileCount = 0
    for (const unknownBlock of page.blocks) {
      if (!unknownBlock || typeof unknownBlock !== 'object') return false
      const block = unknownBlock as Partial<LinkBlock>
      if (typeof block.id !== 'string' || blockIds.has(block.id) || block.pageId !== page.id) return false
      if (typeof block.kind !== 'string' || !allowedKinds.has(block.kind as LinkBlockKind) || typeof block.enabled !== 'boolean') return false
      if (typeof block.sortOrder !== 'number' || !Number.isInteger(block.sortOrder) || block.sortOrder < 0) return false
      if (!isValidBlockContent(block.content, block.kind as LinkBlockKind)) return false
      blockIds.add(block.id)
      if (block.kind === 'profile') profileCount += 1

      const content = block.content
      const items = content.kind === 'fileShare' ? content.files : content.kind === 'groupLink' || content.kind === 'gallery' || content.kind === 'video' ? content.items : []
      for (const item of items) {
        if (!item || typeof item.id !== 'string' || itemIds.has(item.id)) return false
        itemIds.add(item.id)
      }
    }
    if (profileCount !== 1) return false
  }

  if (!pageIds.has(candidate.selectedPageId)) return false
  for (const page of candidate.pages) {
    if (page.parentId && !pageIds.has(page.parentId)) return false
    const visited = new Set([page.id])
    let parentId = page.parentId
    while (parentId) {
      if (visited.has(parentId)) return false
      visited.add(parentId)
      parentId = candidate.pages.find((item) => item.id === parentId)?.parentId ?? null
    }
  }

  return true
}

export const isLinkPageState = isLinkPageStateV2

export function resolvePageBySlug(state: LinkPageState, slug: string) {
  const canonical = state.pages.find((page) => page.slug === slug)
  if (canonical) return { page: canonical, isAlias: false }
  const alias = state.pages.find((page) => page.slugAliases.includes(slug))
  return alias ? { page: alias, isAlias: true } : null
}

export function normalizeBlockOrders(blocks: LinkBlock[]) {
  return blocks.map((block, index) => ({ ...block, sortOrder: index }))
}

export function normalizePageOrders(pages: LinkPage[]) {
  const siblingGroups = new Map<string, LinkPage[]>()
  for (const page of pages) {
    const key = page.parentId ?? '__root__'
    const siblings = siblingGroups.get(key) ?? []
    siblings.push(page)
    siblingGroups.set(key, siblings)
  }
  for (const siblings of siblingGroups.values()) siblings.sort((a, b) => a.sortOrder - b.sortOrder)

  return pages.map((page) => {
    const siblings = siblingGroups.get(page.parentId ?? '__root__') ?? []
    return { ...page, sortOrder: siblings.findIndex((candidate) => candidate.id === page.id) }
  })
}

export function duplicateBlock(block: LinkBlock): LinkBlock {
  const clone = structuredClone(block)
  clone.id = createId()
  clone.content = remapItemIds(clone.content)
  return clone
}

function remapItemIds(content: LinkBlockContent): LinkBlockContent {
  if (content.kind === 'groupLink' || content.kind === 'gallery' || content.kind === 'video') {
    return { ...content, items: content.items.map((item) => ({ ...item, id: createId() })) } as LinkBlockContent
  }
  if (content.kind === 'fileShare') {
    return { ...content, files: content.files.map((item) => ({ ...item, id: createId() })) }
  }
  return content
}

export function isValidSlug(slug: string) {
  return /^[A-Za-z0-9_.-]{4,50}$/.test(slug)
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function isSlugAvailable(state: LinkPageState, slug: string, exceptPageId?: string) {
  return !state.pages.some(
    (page) => page.id !== exceptPageId && (page.slug === slug || page.slugAliases.includes(slug)),
  )
}

export function updatePageSlug(page: LinkPage, slug: string) {
  if (page.slug === slug) return page
  return {
    ...page,
    slug,
    slugAliases: Array.from(new Set([...page.slugAliases.filter((alias) => alias !== slug), page.slug])),
  }
}

export {
  canSetPageParent,
  createPageTreeIndex,
  getAncestorIds,
  getOrderedPageTree,
  getPageDepth,
  getPageDescendantIds,
  getVisibleTreeRows,
} from './tree'
export { getInboundPageReferences, getNavigationPages, resolveDestination } from './navigation'
