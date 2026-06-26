import { notFound, redirect } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import DetailClient from './DetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminPlatformDetailPage({ params }: Props) {
  const { id } = await params

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

  if (!profile || (profile.role !== 'administrator' && profile.role !== 'sales_manager')) {
    redirect('/portal')
  }

  // 접수 데이터 조회 (service role)
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'platform' } }
  )

  const { data: request } = await adminClient
    .from('measurement_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (!request) notFound()

  const { data: media } = await adminClient
    .from('measurement_media')
    .select('id, object_path, media_type, file_name, file_size')
    .eq('request_id', id)
    .order('created_at', { ascending: true })

  return (
    <DetailClient
      requestId={id}
      request={request}
      media={(media ?? []) as { id: string; object_path: string; media_type: 'image' | 'video'; file_name: string; file_size: number }[]}
    />
  )
}
