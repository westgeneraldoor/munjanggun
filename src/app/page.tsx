import { Metadata } from 'next'
import { createPublicShowroomClient } from '@/lib/supabase/public'
import NodeCard from '@/components/customer/NodeCard'
import HomeHeroV2 from '@/components/customer/HomeHeroV2'
import { getOptimalCols } from '@/lib/grid-utils'
import CTABar from '@/components/customer/CTABar'
import ScrollRestorer from '@/components/customer/ScrollRestorer'
import ScrollAnimationWrapper from '@/components/customer/ScrollAnimationWrapper'
import { EMPTY_STATE_TITLE, EMPTY_STATE_SUBTITLE } from '@/lib/constants'
import styles from './page.module.css'

export async function generateMetadata(): Promise<Metadata> {
  const showroomDb = createPublicShowroomClient().schema('showroom')

  const { data: siteSettings } = await showroomDb
    .from('site_settings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  return {
    title: siteSettings?.hero_title || '문장군 디지털 쇼룸',
    description: siteSettings?.hero_description || '문장군 디지털 쇼룸',
    openGraph: {
      title: siteSettings?.hero_title || siteSettings?.site_title || '문장군 디지털 쇼룸',
      description: siteSettings?.hero_description || siteSettings?.site_description || '문장군 디지털 쇼룸',
      images: siteSettings?.og_image_url ? [siteSettings.og_image_url] : [],
    },
  }
}

export const revalidate = 60

export default async function Home() {
  const showroomDb = createPublicShowroomClient().schema('showroom')

  const [settingsResult, heroMediaResult, rootNodesResult] = await Promise.all([
    showroomDb
      .from('site_settings')
      .select('*')
      .eq('id', 'singleton')
      .single(),
    showroomDb
      .from('site_hero_media')
      .select('*')
      .order('display_order', { ascending: true }),
    showroomDb
      .from('nodes')
      .select('id, name, slug, tagline, card_subtitle, image_url, type, status, card_text_position')
      .is('parent_id', null)
      .eq('status', 'published')
      .order('display_order'),
  ])

  const siteSettings = settingsResult.data
  const siteHeroMedia = heroMediaResult.data
  const rootNodes = rootNodesResult.data

  const heroHasContent = (siteHeroMedia && siteHeroMedia.length > 0) || siteSettings?.hero_video_url || siteSettings?.hero_mobile_video_url || siteSettings?.hero_title || siteSettings?.hero_subtitle || siteSettings?.hero_description

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      
      {siteSettings?.hero_enabled && heroHasContent && (
        <HomeHeroV2
          settings={siteSettings}
          desktopMedia={siteHeroMedia?.filter(m => m.device_type === 'desktop' && m.media_type === 'image') || []}
          mobileMedia={siteHeroMedia?.filter(m => m.device_type === 'mobile' && m.media_type === 'image') || []}
        />
      )}

      <div className={styles.content}>
        {(rootNodes || []).length > 0 ? (
          <div className={styles.nodeGrid} data-cols={getOptimalCols(rootNodes?.length || 0)}>
            {(rootNodes || []).map((node, idx) => (
              <ScrollAnimationWrapper key={node.id} delay={Math.min(idx * 40, 160)}>
                <NodeCard 
                  node={node} 
                  textPosition={(node.card_text_position as 'overlay' | 'below') || (siteSettings?.card_text_position as 'overlay' | 'below') || 'overlay'}
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
        shareTitle={siteSettings?.hero_title || siteSettings?.site_title || null}
        shareDescription={siteSettings?.hero_description || siteSettings?.site_description || null}
      />
    </main>
  )
}
