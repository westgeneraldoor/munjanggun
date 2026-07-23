import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import MeasureForm from './MeasureForm'

export const metadata = {
  title: '무료방문 실측 견적상담 신청 | 문장군',
  description: '전문 매니저가 직접 방문하여 정확한 치수 측정과 견적을 제공합니다.',
}

type MeasureNewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

function cleanSearchParam(value: string | undefined) {
  return value?.trim().slice(0, 160).replace(/[<>]/g, '') || ''
}

const MEASURE_CONCERNS = {
  cabinet: { id: 'cabinet' as const, label: '신발장 간섭' },
  finish: { id: 'finish' as const, label: '스위치·몰딩 간섭' },
  level: { id: 'level' as const, label: '바닥 단차·수직' },
}

export default async function MeasureNewPage({ searchParams }: MeasureNewPageProps) {
  const params = await searchParams
  const source = cleanSearchParam(firstSearchParam(params?.source))
  const post = cleanSearchParam(firstSearchParam(params?.post))
  const concernParam = firstSearchParam(params?.concern)
  const concern = concernParam && Object.hasOwn(MEASURE_CONCERNS, concernParam)
    ? MEASURE_CONCERNS[concernParam as keyof typeof MEASURE_CONCERNS]
    : null
  const supabase = await createPlatformClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const nextParams = new URLSearchParams()

    if (source) nextParams.set('source', source)
    if (post) nextParams.set('post', post)
    if (concern) nextParams.set('concern', concern.id)

    const next = `/portal/measure/new${nextParams.size > 0 ? `?${nextParams.toString()}` : ''}`
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const blogQuestionContext = source === 'blog-question' && post
    ? { source: 'blog-question' as const, postSlug: post }
    : null

  return <MeasureForm userId={user.id} blogQuestionContext={blogQuestionContext} measureConcernContext={concern} />
}
