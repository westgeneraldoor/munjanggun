import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ColorCard from '@/components/customer/ColorCard'
import CTABar from '@/components/customer/CTABar'
import Link from 'next/link'
import styles from './page.module.css'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: collection } = await supabase
    .schema('colorbook')
    .from('collections')
    .select('name, description')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!collection) return { title: '컬렉션 - 문장군' }

  return {
    title: `${collection.name} — 문장군 디지털 컬러북`,
    description: collection.description || `${collection.name} 컬렉션의 컬러를 탐색하세요.`,
  }
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch collection
  const { data: collection } = await supabase
    .schema('colorbook')
    .from('collections')
    .select('id, name, slug, description, thumbnail_url')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!collection) notFound()

  // Fetch colors in this collection
  const { data: colors } = await supabase
    .schema('colorbook')
    .from('colors')
    .select('id, name, slug, tagline, texture_image_url')
    .eq('collection_id', collection.id)
    .eq('status', 'published')
    .order('display_order')

  // Fetch site settings for CTA
  const { data: siteSettings } = await supabase
    .schema('colorbook')
    .from('site_settings')
    .select('reservation_url, store_url')
    .single()

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← 전체 컬렉션
        </Link>
        <h1 className={styles.title}>{collection.name}</h1>
        {collection.description && (
          <p className={styles.description}>{collection.description}</p>
        )}
      </header>

      <div className={styles.grid}>
        {(colors || []).map((color) => (
          <ColorCard
            key={color.id}
            color={color}
            collectionSlug={collection.slug}
          />
        ))}
      </div>

      {(!colors || colors.length === 0) && (
        <div className={styles.emptyState}>
          <p>이 컬렉션에 아직 등록된 컬러가 없습니다.</p>
        </div>
      )}

      <CTABar
        reservationUrl={siteSettings?.reservation_url || null}
        storeUrl={siteSettings?.store_url || null}
      />
    </main>
  )
}
