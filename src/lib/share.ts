export const DEFAULT_SHARE_DESCRIPTION = '문장군 디지털 쇼룸'

export type ShareBreadcrumbItem = {
  name: string
  href?: string
}

export type KakaoFeedTemplate = {
  objectType: 'feed'
  content: {
    title: string
    description?: string
    imageUrl: string
    link: { mobileWebUrl: string; webUrl: string }
  }
  buttons?: Array<{
    title: string
    link: { mobileWebUrl: string; webUrl: string }
  }>
}

export const SHARE_MENU_ITEMS = [
  { id: 'kakao', label: '카카오톡으로 공유' },
  { id: 'native', label: '다른 방법으로 공유' },
] as const

function normalizeText(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function buildShareDescription({
  breadcrumbItems,
  description,
  fallback = DEFAULT_SHARE_DESCRIPTION,
}: {
  breadcrumbItems?: ShareBreadcrumbItem[]
  description?: string | null
  fallback?: string
}) {
  const stageNames = (breadcrumbItems || [])
    .map(item => normalizeText(item.name))
    .filter((name): name is string => Boolean(name))

  const stage = stageNames.length > 0 ? `단계: ${stageNames.join(' > ')}` : null
  const body = normalizeText(description) || fallback

  return [stage, body].filter(Boolean).join('\n')
}

export function buildNativeShareData({
  title,
  url,
}: {
  title: string
  url: string
}): ShareData {
  return {
    title,
    url,
  }
}

export function buildKakaoFeedTemplate({
  title,
  description,
  imageUrl,
  pageUrl,
  reservationUrl,
  storeUrl,
}: {
  title: string
  description?: string | null
  imageUrl: string
  pageUrl: string
  reservationUrl?: string | null
  storeUrl?: string | null
}): KakaoFeedTemplate {
  const buttons = [
    reservationUrl
      ? {
          title: '무료방문견적',
          link: { mobileWebUrl: reservationUrl, webUrl: reservationUrl },
        }
      : null,
    storeUrl
      ? {
          title: '브랜드스토어',
          link: { mobileWebUrl: storeUrl, webUrl: storeUrl },
        }
      : null,
  ].filter((button): button is NonNullable<typeof button> => Boolean(button))

  return {
    objectType: 'feed',
    content: {
      title,
      description: normalizeText(description) || DEFAULT_SHARE_DESCRIPTION,
      imageUrl,
      link: { mobileWebUrl: pageUrl, webUrl: pageUrl },
    },
    buttons: buttons.length > 0 ? buttons.slice(0, 2) : undefined,
  }
}
