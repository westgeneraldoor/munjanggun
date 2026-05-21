export const DEFAULT_SHARE_DESCRIPTION = '문장군 디지털 쇼룸'

export type ShareBreadcrumbItem = {
  name: string
  href?: string
}

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
