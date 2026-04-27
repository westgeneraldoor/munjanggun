import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HeroTexture from '@/components/customer/HeroTexture'
import ColorInfo from '@/components/customer/ColorInfo'
import InstallationGallery from '@/components/customer/InstallationGallery'
import CTABar from '@/components/customer/CTABar'
import styles from './color-detail.module.css'

interface PageProps {
  params: Promise<{
    collectionSlug: string
    colorSlug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { collectionSlug, colorSlug } = await params
  const supabase = await createClient()
  
  const { data: collection } = await supabase
    .schema('colorbook')
    .from('collections')
    .select('id, name')
    .eq('slug', collectionSlug)
    .single()

  if (!collection) return {}

  const { data: color } = await supabase
    .schema('colorbook')
    .from('colors')
    .select('name, tagline, description, texture_image_url')
    .eq('collection_id', collection.id)
    .eq('slug', colorSlug)
    .single()

  if (!color) return {}

  const description = color.tagline || color.description?.substring(0, 100) || ''

  return {
    title: `${color.name} | ${collection.name} — 문장군 디지털 컬러북`,
    description,
    openGraph: {
      title: `${color.name} | ${collection.name} — 문장군 디지털 컬러북`,
      description,
      images: color.texture_image_url ? [color.texture_image_url] : [],
    },
  }
}

export default async function ColorDetailPage({ params }: PageProps) {
  const { collectionSlug, colorSlug } = await params
  const supabase = await createClient()

  // 컬렉션 조회
  const { data: collection } = await supabase
    .schema('colorbook')
    .from('collections')
    .select('id, name')
    .eq('slug', collectionSlug)
    .eq('status', 'published')
    .single()

  if (!collection) {
    notFound()
  }

  // 컬러 조회
  const { data: color } = await supabase
    .schema('colorbook')
    .from('colors')
    .select('*')
    .eq('collection_id', collection.id)
    .eq('slug', colorSlug)
    .eq('status', 'published')
    .single()

  if (!color) {
    notFound()
  }

  // 시공 사진 조회
  const { data: photos } = await supabase
    .schema('colorbook')
    .from('installation_photos')
    .select('*')
    .eq('color_id', color.id)
    .order('display_order', { ascending: true })

  // 설정 조회
  const { data: settings } = await supabase
    .schema('colorbook')
    .from('site_settings')
    .select('reservation_url, store_url')
    .single()

  return (
    <main className={styles.main}>
      <div className={styles.splitLayout}>
        <div className={styles.leftPane}>
          <HeroTexture
            imageUrl={color.texture_image_url}
            colorName={color.name}
            collectionName={collection.name}
            tagline={color.tagline}
          />
        </div>
        
        <div className={styles.rightPane}>
          <Link href={`/collection/${collectionSlug}`} className={styles.backNav}>
            ← {collection.name}
          </Link>

          <ColorInfo
            collectionName={collection.name}
            colorName={color.name}
            tagline={color.tagline}
            description={color.description}
          />

          <InstallationGallery photos={photos || []} />

          <div className={styles.bottomNav}>
            <Link href="/" className={styles.backButton}>
              전체 컬러 보기
            </Link>
          </div>
        </div>
      </div>

      <CTABar
        reservationUrl={settings?.reservation_url || null}
        storeUrl={settings?.store_url || null}
        hideUntilScroll={true}
      />
    </main>
  )
}
