export const BLOG_BODY_BLOCK_FORBIDDEN_PUBLIC_TERMS = [
  'AEO',
  'GEO',
  'LLMO',
  '콘텐츠 그래프',
  '검색 노출',
] as const

export type BlogBodyBlockInput = {
  text: string | null | undefined
  metadata: Record<string, string | null | undefined>
}

export type NormalizedLinkButtonBlock = {
  label: string
  href: string
  description: string | null
}

export type GuideBoxTone = 'guide' | 'notice' | 'condition' | 'caution'

export type NormalizedGuideBoxBlock = {
  title: string | null
  body: string
  tone: GuideBoxTone
  label: string
}

export type NormalizedQuoteBlock = { quote: string; attribution: string | null; sourceUrl: string | null }
export type NormalizedVideoBlock = { videoId: string }
export type NormalizedRelatedPostBlock = { title: string; slug: string }
export type NormalizedPlaceBlock = { name: string; href: string; provider: 'Kakao' | 'Naver' | 'Google' }
export type NormalizedQuizBlock = { question: string; answer: string; explanation: string | null }
export type NormalizedChecklistBlock = { title: string | null; items: string[] }

const GUIDE_BOX_LABEL: Record<GuideBoxTone, string> = {
  guide: '안내',
  notice: '알아두세요',
  condition: '현장 조건',
  caution: '주의',
}

function cleanInline(value: string | null | undefined) {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanBody(value: string | null | undefined) {
  const trimmed = (value ?? '')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return trimmed.length > 0 ? trimmed : null
}

function isSafeInternalHref(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return false
  if (/[\u0000-\u001f\s]/.test(value)) return false

  try {
    const parsed = new URL(value, 'https://munjanggun.local')
    const restrictedPrefixes = ['/admin', '/api', '/preview', '/drafts', '/private']

    return parsed.origin === 'https://munjanggun.local'
      && restrictedPrefixes.every(prefix => parsed.pathname !== prefix && !parsed.pathname.startsWith(`${prefix}/`))
  } catch {
    return false
  }
}

const PLACE_HOSTS: Record<string, NormalizedPlaceBlock['provider']> = {
  'map.kakao.com': 'Kakao',
  'place.map.kakao.com': 'Kakao',
  'map.naver.com': 'Naver',
  'm.map.naver.com': 'Naver',
  'maps.google.com': 'Google',
  'www.google.com': 'Google',
  'google.com': 'Google',
}

function safeHttpsUrl(value: string | null | undefined) {
  const raw = cleanInline(value)
  if (!raw || /[\u0000-\u001f]/.test(raw)) return null
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

export function youtubeVideoId(value: string | null | undefined) {
  const url = safeHttpsUrl(value)
  if (!url) return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    id = url.searchParams.get('v')
      ?? (url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1] ?? null)
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

export function isSafePlaceUrl(value: string | null | undefined) {
  const url = safeHttpsUrl(value)
  if (!url) return null
  const hostname = url.hostname.toLowerCase()
  const provider = PLACE_HOSTS[hostname]
  if (!provider) return null
  if (provider === 'Google' && !(/^\/maps(?:\/search|\/place|\/dir)?(?:\/|$)/.test(url.pathname) || url.searchParams.has('query'))) return null
  return { href: url.toString(), provider }
}

function normalizeGuideTone(value: string | null | undefined): GuideBoxTone {
  if (value === 'notice' || value === 'condition' || value === 'caution') return value
  return 'guide'
}

export function normalizeLinkButtonBlock(input: BlogBodyBlockInput): NormalizedLinkButtonBlock | null {
  const label = cleanInline(input.text) ?? cleanInline(input.metadata.label)
  const href = cleanInline(input.metadata.href ?? input.metadata.url)
  const description = cleanInline(input.metadata.description)

  if (!label || !href || !isSafeInternalHref(href)) return null

  return {
    label,
    href,
    description,
  }
}

export function normalizeGuideBoxBlock(input: BlogBodyBlockInput): NormalizedGuideBoxBlock | null {
  const body = cleanBody(input.text)
  const title = cleanInline(input.metadata.title ?? input.metadata.heading)
  const tone = normalizeGuideTone(input.metadata.tone)

  if (!body) return null

  return {
    title,
    body,
    tone,
    label: GUIDE_BOX_LABEL[tone],
  }
}

export function normalizeQuoteBlock(input: BlogBodyBlockInput): NormalizedQuoteBlock | null {
  const quote = cleanBody(input.text)
  if (!quote) return null
  const rawSource = cleanInline(input.metadata.source_url)
  const source = safeHttpsUrl(rawSource)
  if (rawSource && !source) return null
  return { quote, attribution: cleanInline(input.metadata.attribution), sourceUrl: source?.toString() ?? null }
}

export function normalizeVideoBlock(input: BlogBodyBlockInput): NormalizedVideoBlock | null {
  const videoId = youtubeVideoId(input.metadata.youtube_url ?? input.metadata.url)
  return videoId ? { videoId } : null
}

export function normalizeRelatedPostBlock(input: BlogBodyBlockInput): NormalizedRelatedPostBlock | null {
  const title = cleanInline(input.metadata.related_post_title)
  const slug = cleanInline(input.metadata.related_post_slug)
  if (!title || !slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  return { title, slug }
}

export function normalizePlaceBlock(input: BlogBodyBlockInput): NormalizedPlaceBlock | null {
  const place = isSafePlaceUrl(input.metadata.place_url ?? input.metadata.url)
  const name = cleanInline(input.text) ?? cleanInline(input.metadata.name)
  return place && name ? { name, ...place } : null
}

export function normalizeQuizBlock(input: BlogBodyBlockInput): NormalizedQuizBlock | null {
  const question = cleanBody(input.text)
  const answer = cleanBody(input.metadata.answer)
  if (!question || !answer) return null
  return { question, answer, explanation: cleanBody(input.metadata.explanation) }
}

export function normalizeChecklistBlock(input: BlogBodyBlockInput): NormalizedChecklistBlock | null {
  const items = (input.metadata.items ?? input.text ?? '').split('\n').map(item => cleanInline(item)).filter((item): item is string => Boolean(item)).slice(0, 20)
  return items.length > 0 ? { title: cleanInline(input.metadata.title), items } : null
}
