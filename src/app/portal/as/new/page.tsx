import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import AsForm from './AsForm'

export const metadata = {
  title: 'A/S 접수 | 문장군',
  description: '문장군 시공 후 확인이 필요한 내용을 사진과 함께 남겨주세요.',
}

export default async function AsNewPage() {
  const supabase = await createPlatformClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/portal/as/new')
  }

  return <AsForm userId={user.id} />
}
