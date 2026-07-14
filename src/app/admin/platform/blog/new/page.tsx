import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import ApprovedManuscriptIntakeClient from './ApprovedManuscriptIntakeClient'

export const metadata = {
  title: '승인 원고 등록 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

export default async function ApprovedManuscriptIntakePage() {
  const platformClient = await createPlatformClient()
  const { data: { user } } = await platformClient.auth.getUser()

  if (!user) redirect('/admin/login')

  const { data: profileData } = await platformClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'customer' | 'sales_manager' | 'administrator' } | null
  if (!profile || profile.role !== 'administrator') {
    redirect('/portal')
  }

  return <ApprovedManuscriptIntakeClient />
}
