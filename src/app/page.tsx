import { createClient } from '@/lib/supabase/server'
import CollectionCard from '@/components/customer/CollectionCard'
import HomeHero from '@/components/customer/HomeHero'
import CTABar from '@/components/customer/CTABar'
import ScrollRestorer from '@/components/customer/ScrollRestorer'
import styles from './page.module.css'

export const revalidate = 0

export default async function Home() {
  const supabase = await createClient()

  // Fetch site settings
  const { data: siteSettings } = await supabase
    .schema('colorbook')
    .from('site_settings')
    .select('reservation_url, store_url')
    .single()

  // Fetch published collections (with thumbnail)
  const { data: collections } = await supabase
    .schema('colorbook')
    .from('collections')
    .select('id, name, slug, description, thumbnail_url')
    .eq('status', 'published')
    .order('display_order')

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      <HomeHero />

      <div className={styles.content}>
        {(collections || []).length > 0 ? (
          <div className={styles.collectionGrid}>
            {(collections || []).map(collection => (
              <CollectionCard
                key={collection.id}
                collection={collection}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>현재 준비 중인 컬렉션입니다.</p>
            <p className={styles.emptySubtext}>곧 만나보세요!</p>
          </div>
        )}
      </div>

      <CTABar
        reservationUrl={siteSettings?.reservation_url || null}
        storeUrl={siteSettings?.store_url || null}
      />
    </main>
  )
}
