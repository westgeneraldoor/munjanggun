import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ShowroomImage from '@/components/showroom/ShowroomImage'
import NodeCard from '@/components/customer/NodeCard'
import NodeHero from '@/components/customer/NodeHero'
import CTABar from '@/components/customer/CTABar'
import ScrollToTop from '@/components/customer/ScrollToTop'
import NodeInfo from '@/components/customer/NodeInfo'
import NodeGallery from '@/components/customer/NodeGallery'
import ScrollAnimationWrapper from '@/components/customer/ScrollAnimationWrapper'
import Breadcrumb from '@/components/customer/Breadcrumb'
import ScrollRestorer from '@/components/customer/ScrollRestorer'
import { getOptimalCols } from '@/lib/grid-utils'
import { createPublicShowroomClient } from '@/lib/supabase/public'
import { EMPTY_STATE_TITLE, EMPTY_STATE_SUBTITLE, GALLERY_SECTION_TITLE } from '@/lib/constants'
import { buildShareDescription } from '@/lib/share'
import { BreadcrumbItem, NodeRow, resolveSlugChain } from '@/lib/nodes'
import { loadShowroomImageSources } from '@/lib/showroom/image-sources'
import styles from './page.module.css'

export const revalidate = 60

export async function generateMetadata(
  props: { params: Promise<{ slugs: string[] }> }
): Promise<Metadata> {
  const { slugs } = await props.params
  const resolved = await resolveSlugChain(slugs)

  if (!resolved) {
    return {}
  }

  const { currentNode, breadcrumbItems } = resolved
  const shareDescription = buildShareDescription({
    breadcrumbItems,
    description: currentNode.tagline || currentNode.description,
  })

  return {
    title: `${currentNode.name} | 문장군`,
    description: shareDescription,
    openGraph: {
      title: currentNode.name,
      description: shareDescription,
      images: currentNode.image_url ? [currentNode.image_url] : [],
    }
  }
}

export default async function CatchAllPage(
  props: { params: Promise<{ slugs: string[] }> }
) {
  const { slugs } = await props.params
  const resolved = await resolveSlugChain(slugs)

  if (!resolved) {
    notFound()
  }

  const { currentNode, breadcrumbItems } = resolved

  // 노드 타입에 따라 분기
  if (currentNode.type === 'listing') {
    return <ListingPage node={currentNode} slugPath={slugs} breadcrumbItems={breadcrumbItems} />
  } else {
    return <DetailPage node={currentNode} breadcrumbItems={breadcrumbItems} />
  }
}

async function ListingPage({ node, slugPath, breadcrumbItems }: { node: NodeRow; slugPath: string[]; breadcrumbItems: BreadcrumbItem[] }) {
  const supabase = createPublicShowroomClient()
  const showroomDb = supabase.schema('showroom')

  const [heroMediaResult, childrenResult, settingsResult] = await Promise.all([
    showroomDb
      .from('hero_media')
      .select('*')
      .eq('node_id', node.id)
      .order('display_order'),
    showroomDb
      .from('nodes')
      .select('id, name, slug, tagline, card_subtitle, image_url, type, status, card_text_position')
      .eq('parent_id', node.id)
      .eq('status', 'published')
      .order('display_order'),
    showroomDb
      .from('site_settings')
      .select('reservation_url, store_url')
      .eq('id', 'singleton')
      .single(),
  ])

  const heroMedia = heroMediaResult.data
  const children = childrenResult.data
  const settings = settingsResult.data
  const imageSources = await loadShowroomImageSources(supabase, [
    ...(heroMedia ?? []).map(media => media.image_url),
    ...(children ?? []).map(child => child.image_url),
  ])
  const heroMediaWithSources = (heroMedia ?? []).map(media => ({
    ...media,
    image_source: imageSources[media.image_url],
  }))
  const childrenWithSources = (children ?? []).map(child => ({
    ...child,
    image_source: child.image_url ? imageSources[child.image_url] : undefined,
  }))

  const basePath = '/' + slugPath.join('/')
  const heroHasContent = (heroMedia && heroMedia.length > 0) || node.hero_video_url || node.hero_mobile_video_url || node.hero_title || node.hero_subtitle || node.hero_description

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      
      {/* 히어로 (있으면) */}
      {node.hero_enabled && heroHasContent && (
        <NodeHero 
          desktopMedia={heroMediaWithSources.filter(m => m.device_type === 'desktop' && m.media_type === 'image')}
          mobileMedia={heroMediaWithSources.filter(m => m.device_type === 'mobile' && m.media_type === 'image')}
          title={node.hero_title || node.name} 
          subtitle={node.hero_subtitle} 
          description={node.hero_description} 
          videoUrl={node.hero_video_url}
          mobileVideoUrl={node.hero_mobile_video_url}
          slideInterval={node.hero_slide_interval ?? 5}
          slideTransition={(node.hero_slide_transition as 'fade' | 'slide') || 'fade'}
        />
      )}
      
      {/* 노드 정보 */}
      <div className={styles.content}>
        <Breadcrumb items={breadcrumbItems} />
        <ScrollAnimationWrapper delay={0}>
          <h1 className={styles.nodeTitle}>{node.name}</h1>
        </ScrollAnimationWrapper>
        {node.tagline && (
          <ScrollAnimationWrapper delay={100}>
            <p className={styles.tagline}>{node.tagline}</p>
          </ScrollAnimationWrapper>
        )}
        {node.description && (
          <ScrollAnimationWrapper delay={200}>
            <p className={styles.description}>{node.description}</p>
          </ScrollAnimationWrapper>
        )}
        
        {/* 자식 카드 그리드 */}
        {childrenWithSources.length > 0 ? (
          <div className={styles.nodeGrid} data-cols={getOptimalCols(childrenWithSources.length)}>
            {childrenWithSources.map((child, idx) => (
              <ScrollAnimationWrapper key={child.id} delay={Math.min(idx * 40, 160)}>
                <NodeCard 
                  node={child} 
                  basePath={basePath} 
                  textPosition={(child.card_text_position as 'overlay' | 'below') || (node.card_text_position as 'overlay' | 'below') || 'overlay'}
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
        reservationUrl={settings?.reservation_url || null}
        storeUrl={settings?.store_url || null}
      />
    </main>
  )
}

async function DetailPage({ node, breadcrumbItems }: { node: NodeRow; breadcrumbItems: BreadcrumbItem[] }) {
  const supabase = createPublicShowroomClient()
  const showroomDb = supabase.schema('showroom')

  const [photosResult, settingsResult] = await Promise.all([
    showroomDb
      .from('gallery_photos')
      .select('*')
      .eq('node_id', node.id)
      .order('display_order'),
    showroomDb
      .from('site_settings')
      .select('reservation_url, store_url')
      .eq('id', 'singleton')
      .single(),
  ])

  const photos = photosResult.data
  const settings = settingsResult.data
  const imageSources = await loadShowroomImageSources(supabase, [
    node.image_url,
    ...(photos ?? []).map(photo => photo.image_url),
  ])
  const nodeImageSource = node.image_url ? imageSources[node.image_url] : undefined
  const photosWithSources = (photos ?? []).map(photo => ({
    ...photo,
    image_source: imageSources[photo.image_url],
  }))

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      
      <div className={styles.mobileHero}>
        {node.image_url && (
          <div className={styles.mobileDetailImageWrap}>
            <ShowroomImage
              source={nodeImageSource ?? node.image_url}
              purpose="display"
              alt={node.name}
              fill
              className={styles.mobileDetailImage}
              sizes="100vw"
              priority
            />
          </div>
        )}
      </div>
      
      <div className={styles.detailSplit}>
        {/* 데스크탑 좌측 이미지 */}
        <div className={styles.splitLeft}>
          {node.image_url && (
            <div className={styles.splitImageFrame}>
              <ShowroomImage
                source={nodeImageSource ?? node.image_url}
                purpose="display"
                alt={node.name}
                fill
                className={styles.splitImage}
                sizes="(min-width: 768px) 50vw, 100vw"
                priority
              />
            </div>
          )}
        </div>

        {/* 우측 스크롤 영역 */}
        <div className={styles.splitRight}>
          {/* 노드 정보 */}
          <div className={styles.content} style={{ paddingBottom: 0, flex: 'none' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>
          <NodeInfo node={node} />
          
          {/* 갤러리 */}
          {photosWithSources.length > 0 && (
            <div className={styles.gallerySection}>
              <ScrollAnimationWrapper delay={0}>
                <hr className={styles.galleryDivider} />
                <h2 className={styles.galleryTitle}>{GALLERY_SECTION_TITLE}</h2>
              </ScrollAnimationWrapper>
              <NodeGallery photos={photosWithSources} nodeName={node.name} />
            </div>
          )}
        </div>
      </div>
      
      <ScrollToTop />
      <CTABar
        reservationUrl={settings?.reservation_url || null}
        storeUrl={settings?.store_url || null}
      />
    </main>
  )
}
