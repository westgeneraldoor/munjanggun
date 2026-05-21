import { createPublicShowroomClient } from '@/lib/supabase/public'
import { selectCtaUrl } from '@/lib/ctaRedirect'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const showroomDb = createPublicShowroomClient().schema('showroom')
  const { data } = await showroomDb
    .from('site_settings')
    .select('store_url')
    .eq('id', 'singleton')
    .single()

  const targetUrl = selectCtaUrl(data, 'store') || new URL('/', request.url).toString()
  return Response.redirect(targetUrl, 302)
}
