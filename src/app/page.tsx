import { Metadata } from 'next'
import { createPublicShowroomClient, hasPublicShowroomEnv } from '@/lib/supabase/public'
import NodeCard from '@/components/customer/NodeCard'
import HomeHeroV2 from '@/components/customer/HomeHeroV2'
import { getOptimalCols } from '@/lib/grid-utils'
import CTABar from '@/components/customer/CTABar'
import ScrollRestorer from '@/components/customer/ScrollRestorer'
import ScrollAnimationWrapper from '@/components/customer/ScrollAnimationWrapper'
import DescendantGallery from '@/components/customer/DescendantGallery'
import { EMPTY_STATE_TITLE, EMPTY_STATE_SUBTITLE } from '@/lib/constants'
import { loadShowroomImageSources } from '@/lib/showroom/image-sources'
import { logError } from '@/lib/logger'
import {
  ROOT_DESCENDANT_GALLERY_ID,
  loadRenderableRootDescendantGalleryPage,
} from '@/lib/showroom/descendant-gallery-data'
import styles from './page.module.css'

export async function generateMetadata(): Promise<Metadata> {
  if (!hasPublicShowroomEnv()) {
    return {
      title: '문장군',
      description: '좋은 문을 고르는 일, 어렵지 않게 도와드립니다.',
    }
  }

  const supabase = createPublicShowroomClient()
  const showroomDb = supabase.schema('showroom')

  const { data: siteSettings } = await showroomDb
    .from('site_settings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  return {
    title: siteSettings?.hero_title || '문장군 디지털 쇼룸',
    description: siteSettings?.hero_description || '문장군 디지털 쇼룸',
  }
}

export const revalidate = 60

export default async function Home() {
  if (!hasPublicShowroomEnv()) {
    return (
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{EMPTY_STATE_TITLE}</p>
            <p className={styles.emptySubtext}>{EMPTY_STATE_SUBTITLE}</p>
          </div>
        </div>

        <CTABar storeUrl={null} />
      </main>
    )
  }

  const supabase = createPublicShowroomClient()
  const showroomDb = supabase.schema('showroom')
  const rootGalleryResult = loadRenderableRootDescendantGalleryPage().catch(error => {
    logError('Failed to load the root showroom gallery.', error)
    return null
  })

  // Fetch site settings
  const { data: siteSettings } = await showroomDb
    .from('site_settings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  // Fetch published root nodes
  const { data: rootNodes } = await showroomDb
    .from('nodes')
    .select('id, name, slug, tagline, card_subtitle, image_url, type, status, card_text_position')
    .is('parent_id', null)
    .eq('status', 'published')
    .order('display_order')

  const imageSources = await loadShowroomImageSources(supabase, [
    ...(rootNodes ?? []).map(node => node.image_url),
  ])
  const rootNodesWithSources = (rootNodes ?? []).map(node => ({
    ...node,
    image_source: node.image_url ? imageSources[node.image_url] : undefined,
  }))
  const rootGallery = await rootGalleryResult
  const rootGalleryDescription = '문 하나가 공간의 첫인상을 바꾸는 순간들. 문장군이 완성한 실제 현장을 천천히 둘러보세요.'

  const heroHasContent = Boolean(siteSettings?.hero_title || siteSettings?.hero_subtitle || siteSettings?.hero_description)

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      
      {siteSettings?.hero_enabled && heroHasContent && (
        <HomeHeroV2
          settings={siteSettings}
        />
      )}

      <div className={styles.content}>
        {rootNodesWithSources.length > 0 ? (
          <div className={styles.nodeGrid} data-cols={getOptimalCols(rootNodesWithSources.length)}>
            {rootNodesWithSources.map((node, idx) => (
              <ScrollAnimationWrapper key={node.id} delay={idx * 150}>
                <NodeCard 
                  node={node} 
                  textPosition={(siteSettings?.card_text_position as 'overlay' | 'below') || 'overlay'} 
                />
              </ScrollAnimationWrapper>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{EMPTY_STATE_TITLE}</p>
            <p className={styles.emptySubtext}>{EMPTY_STATE_SUBTITLE}</p>
          </div>
        )}
        {rootGallery && rootGallery.total > 0 && (
          <DescendantGallery
            key={ROOT_DESCENDANT_GALLERY_ID}
            nodeId={ROOT_DESCENDANT_GALLERY_ID}
            galleryScope="root"
            description={rootGalleryDescription}
            initialItems={rootGallery.items}
            initialNextOffset={rootGallery.nextOffset}
            initialHasMore={rootGallery.hasMore}
            initialSnapshot={rootGallery.snapshot}
          />
        )}
      </div>

      <CTABar
        storeUrl={siteSettings?.store_url || null}
      />
    </main>
  )
}
