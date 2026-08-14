import { redirect } from 'next/navigation'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import type {
  BlogContentCategory,
  BlogPostStatus,
  Database,
} from '@/types/database'
import BlogDraftQueueClient, { type BlogDraftQueueRow } from './BlogDraftQueueClient'

export const metadata = {
  title: '블로그 콘텐츠 큐 | 문장군 관리자',
}

export const dynamic = 'force-dynamic'

type BlogPostRow = Pick<
  Database['showroom']['Tables']['blog_posts']['Row'],
  | 'id'
  | 'title'
  | 'status'
  | 'category'
  | 'updated_at'
>

export default async function AdminPlatformBlogPage() {
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

  const showroomAdmin = createShowroomAdminClient()

  const { data: postsData, error: postsError } = await showroomAdmin
    .from('blog_posts')
    .select('id, title, status, category, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200)

  if (postsError) {
    return <BlogDraftQueueClient initialRows={[]} loadError="블로그 콘텐츠 목록을 불러오지 못했습니다." />
  }

  const posts = (postsData ?? []) as BlogPostRow[]
  const rows: BlogDraftQueueRow[] = posts.map(post => ({
    id: post.id,
    title: post.title,
    status: post.status as BlogPostStatus,
    category: post.category as BlogContentCategory,
    updatedAt: post.updated_at,
  }))

  return <BlogDraftQueueClient initialRows={rows} loadError={null} />
}
