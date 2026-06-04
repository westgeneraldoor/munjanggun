import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import SettingsClient from './SettingsClient'

export const metadata = {
  title: '플랫폼 설정 | 문장군 관리자',
}

export default async function AdminPlatformSettingsPage() {
  // 관리자 인증 확인
  const supabase = await createPlatformClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'customer' | 'sales_manager' | 'administrator' } | null

  if (!profile || profile.role !== 'administrator') {
    redirect('/portal')
  }

  return <SettingsClient />
}
