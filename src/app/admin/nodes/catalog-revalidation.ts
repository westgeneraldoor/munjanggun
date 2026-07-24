'use server'

import 'server-only'

import { revalidatePath, updateTag } from 'next/cache'
import { SHOWROOM_CATALOG_CACHE_TAG } from '@/lib/showroom/cache-tags'
import { createShowroomClient } from '@/lib/supabase/server'

async function requireAdministrator() {
  const supabase = await createShowroomClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('관리자 로그인이 필요합니다.')

  const { data: profile, error: profileError } = await supabase
    .schema('platform')
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'administrator') {
    throw new Error('관리자 권한이 필요합니다.')
  }
}

export async function refreshShowroomCatalogCache() {
  await requireAdministrator()

  // A node save can change names, paths, hierarchy, order, publication, and
  // gallery ownership at once. Expire the shared data first, then refresh the
  // public home and all showroom-node pages that consume it.
  updateTag(SHOWROOM_CATALOG_CACHE_TAG)
  revalidatePath('/')
  revalidatePath('/[...slugs]', 'page')
}
