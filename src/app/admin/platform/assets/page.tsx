import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import ContentAssetsClient from './ContentAssetsClient'
import { loadAssetLibraryServerPage } from './library-data'

export const metadata = {
  title: '사진보관함 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

async function requireAdministratorPage() {
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
}

export default async function AdminPlatformAssetsPage() {
  await requireAdministratorPage()

  const showroomAdmin = createShowroomAdminClient()

  const page = await loadAssetLibraryServerPage(showroomAdmin, 0, true)

  return (
    <ContentAssetsClient
      key={page.items.map(item => `${item.id}:${item.updatedAt}`).join('|')}
      initialItems={page.items}
      initialNextOffset={page.nextOffset}
      initialHasMore={page.hasMore}
      tagOptions={page.tagOptions}
      loadError={page.loadError}
    />
  )
}
