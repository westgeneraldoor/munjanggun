import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BlogPostRenderer from '@/components/blog/BlogPostRenderer'
import { getAdminPreviewBlogPost } from '@/lib/content-os/blog-rendering'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import styles from './preview.module.css'

export const metadata: Metadata = {
  title: '블로그 미리보기 | 문장군 관리자',
  robots: {
    index: false,
    follow: false,
  },
}

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
}

async function requireAdministrator() {
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

export default async function BlogPreviewPage({ params }: Props) {
  const { id } = await params
  await requireAdministrator()

  const data = await getAdminPreviewBlogPost(id)

  if (!data) {
    notFound()
  }

  return (
    <>
      <div className={styles.previewNav}>
        <Link href={`/admin/platform/blog/${id}`}>
          <ArrowLeft size={16} aria-hidden="true" />
          에디터로 돌아가기
        </Link>
      </div>
      <BlogPostRenderer data={data} mode="preview" />
    </>
  )
}
