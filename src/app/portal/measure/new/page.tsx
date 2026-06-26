import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import MeasureForm from './MeasureForm'

export const metadata = {
  title: '무료방문 실측 견적상담 신청 | 문장군',
  description: '전문 매니저가 직접 방문하여 정확한 치수 측정과 견적을 제공합니다.',
}

export default async function MeasureNewPage() {
  const supabase = await createPlatformClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/portal/measure/new')
  }

  return <MeasureForm userId={user.id} />
}
