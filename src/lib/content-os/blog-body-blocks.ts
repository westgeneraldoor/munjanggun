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
