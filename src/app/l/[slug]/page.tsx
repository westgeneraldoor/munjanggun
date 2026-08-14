import type { Metadata } from 'next'
import { PublicLinkPageClient } from '@/components/link-pages/PublicLinkPageClient'

export const metadata: Metadata = {
  title: '문장군 상담 자료',
  description: '문장군 무료방문실측 견적상담 자료',
}

export default async function PublicLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PublicLinkPageClient slug={slug} />
}
