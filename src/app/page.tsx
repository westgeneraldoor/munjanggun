import { Metadata } from 'next'
import { hasPublicShowroomEnv } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import NodeCard from '@/components/customer/NodeCard'
import HomeHeroV2 from '@/components/customer/HomeHeroV2'
import { getOptimalCols } from '@/lib/grid-utils'
import CTABar from '@/components/customer/CTABar'
import ScrollRestorer from '@/components/customer/ScrollRestorer'
import ScrollAnimationWrapper from '@/components/customer/ScrollAnimationWrapper'
import { EMPTY_STATE_TITLE, EMPTY_STATE_SUBTITLE } from '@/lib/constants'
import { loadShowroomImageSources } from '@/lib/showroom/image-sources'
import styles from './page.module.css'

export async function generateMetadata(): Promise<Metadata> {
  if (!hasPublicShowroomEnv()) {
    return {
      title: '문장군',
      description: '좋은 문을 고르는 일, 어렵지 않게 도와드립니다.',
    }
  }

  const supabase = await createClient()
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

export const revalidate = 0

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

        <CTABar reservationUrl={null} storeUrl={null} />
      </main>
    )
  }

  const supabase = await createClient()
  const showroomDb = supabase.schema('showroom')

  // Fetch site settings
  const { data: siteSettings } = await showroomDb
    .from('site_settings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  // Fetch site hero media
  const { data: siteHeroMedia } = await showroomDb
    .from('site_hero_media')
    .select('*')
    .order('display_order', { ascending: true })

  // Fetch published root nodes
  const { data: rootNodes } = await showroomDb
    .from('nodes')
    .select('id, name, slug, tagline, card_subtitle, image_url, type, status, card_text_position')
    .is('parent_id', null)
    .eq('status', 'published')
    .order('display_order')

  const imageSources = await loadShowroomImageSources(supabase, [
    ...(siteHeroMedia ?? []).map(media => media.image_url),
    ...(rootNodes ?? []).map(node => node.image_url),
  ])
  const siteHeroWithSources = (siteHeroMedia ?? []).map(media => ({
    ...media,
    image_source: imageSources[media.image_url],
  }))
  const rootNodesWithSources = (rootNodes ?? []).map(node => ({
    ...node,
    image_source: node.image_url ? imageSources[node.image_url] : undefined,
  }))

  const heroHasContent = (siteHeroMedia && siteHeroMedia.length > 0) || siteSettings?.hero_video_url || siteSettings?.hero_mobile_video_url || siteSettings?.hero_title || siteSettings?.hero_subtitle || siteSettings?.hero_description

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      
      {siteSettings?.hero_enabled && heroHasContent && (
        <HomeHeroV2
          settings={siteSettings}
          desktopMedia={siteHeroWithSources.filter(m => m.device_type === 'desktop' && m.media_type === 'image')}
          mobileMedia={siteHeroWithSources.filter(m => m.device_type === 'mobile' && m.media_type === 'image')}
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
      </div>

      <CTABar
        reservationUrl={siteSettings?.reservation_url || null}
        storeUrl={siteSettings?.store_url || null}
      />
    </main>
  )
}
