import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
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
import { EMPTY_STATE_TITLE, EMPTY_STATE_SUBTITLE, GALLERY_SECTION_TITLE } from '@/lib/constants'
import styles from './page.module.css'

export async function generateMetadata(
  props: { params: Promise<{ slugs: string[] }> }
): Promise<Metadata> {
  const { slugs } = await props.params
  const supabase = await createClient()
  const showroomDb = supabase.schema('showroom')

  let parentId: string | null = null
  let currentNode = null

  for (const slug of slugs) {
    let query = showroomDb
      .from('nodes')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')

    if (parentId === null) {
      query = query.is('parent_id', null)
    } else {
      query = query.eq('parent_id', parentId)
    }

    const { data: node } = await query.single()

    if (!node) {
      return {}
    }

    currentNode = node
    parentId = node.id
  }

  if (!currentNode) {
    return {}
  }

  return {
    title: `${currentNode.name} | 문장군`,
    description: currentNode.tagline || currentNode.description || '문장군 디지털 쇼룸',
    openGraph: {
      images: currentNode.image_url ? [currentNode.image_url] : [],
    }
  }
}

export default async function CatchAllPage(
  props: { params: Promise<{ slugs: string[] }> }
) {
  const { slugs } = await props.params
  const supabase = await createClient()
  const showroomDb = supabase.schema('showroom')

  // 슬러그 경로를 따라가며 노드 찾기
  let parentId: string | null = null
  let currentNode = null
  const breadcrumbItems = [{ name: '홈', href: '/' }]

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    let query = showroomDb
      .from('nodes')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')

    if (parentId === null) {
      query = query.is('parent_id', null)
    } else {
      query = query.eq('parent_id', parentId)
    }

    const { data: node } = await query.single()

    if (!node) {
      notFound() // 경로가 유효하지 않으면 404
    }

    currentNode = node
    parentId = node.id
    breadcrumbItems.push({ name: node.name, href: '/' + slugs.slice(0, i + 1).join('/') })
  }

  if (!currentNode) {
    notFound()
  }

  // 노드 타입에 따라 분기
  if (currentNode.type === 'listing') {
    return <ListingPage node={currentNode} slugPath={slugs} breadcrumbItems={breadcrumbItems} />
  } else {
    return <DetailPage node={currentNode} breadcrumbItems={breadcrumbItems} />
  }
}

import { Database } from '@/types/database'

type NodeRow = Database['showroom']['Tables']['nodes']['Row']

async function ListingPage({ node, slugPath, breadcrumbItems }: { node: NodeRow; slugPath: string[]; breadcrumbItems: { name: string; href: string }[] }) {
  const supabase = await createClient()
  const showroomDb = supabase.schema('showroom')

  // 히어로 미디어
  const { data: heroMedia } = await showroomDb
    .from('hero_media')
    .select('*')
    .eq('node_id', node.id)
    .order('display_order')

  // 자식 노드 (published만)
  const { data: children } = await showroomDb
    .from('nodes')
    .select('id, name, slug, tagline, card_subtitle, image_url, type, status, card_text_position')
    .eq('parent_id', node.id)
    .eq('status', 'published')
    .order('display_order')

  // CTA
  const { data: settings } = await showroomDb
    .from('site_settings')
    .select('reservation_url, store_url')
    .eq('id', 'singleton')
    .single()

  const basePath = '/' + slugPath.join('/')
  const heroHasContent = (heroMedia && heroMedia.length > 0) || node.hero_video_url || node.hero_mobile_video_url || node.hero_title || node.hero_subtitle || node.hero_description

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      
      {/* 히어로 (있으면) */}
      {node.hero_enabled && heroHasContent && (
        <NodeHero 
          desktopMedia={heroMedia?.filter(m => m.device_type === 'desktop' && m.media_type === 'image') || []}
          mobileMedia={heroMedia?.filter(m => m.device_type === 'mobile' && m.media_type === 'image') || []}
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
        {children && children.length > 0 ? (
          <div className={styles.nodeGrid} data-cols={getOptimalCols(children.length)}>
            {children.map((child, idx) => (
              <ScrollAnimationWrapper key={child.id} delay={idx * 150}>
                <NodeCard 
                  node={child} 
                  basePath={basePath} 
                  textPosition={(node.card_text_position as 'overlay' | 'below') || 'overlay'} 
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

async function DetailPage({ node, breadcrumbItems }: { node: NodeRow; breadcrumbItems: { name: string; href: string }[] }) {
  const supabase = await createClient()
  const showroomDb = supabase.schema('showroom')

  // 갤러리 사진
  const { data: photos } = await showroomDb
    .from('gallery_photos')
    .select('*')
    .eq('node_id', node.id)
    .order('display_order')

  // CTA
  const { data: settings } = await showroomDb
    .from('site_settings')
    .select('reservation_url, store_url')
    .eq('id', 'singleton')
    .single()

  return (
    <main className={styles.main}>
      <ScrollRestorer />
      
      <div className={styles.mobileHero}>
        {node.image_url && (
          <NodeHero 
            desktopMedia={[]}
            mobileMedia={[{ image_url: node.image_url, display_order: 0 }]} 
            title={node.name} 
          />
        )}
      </div>
      
      <div className={styles.detailSplit}>
        {/* 데스크탑 좌측 이미지 */}
        <div className={styles.splitLeft}>
          {node.image_url && (
            <Image
              src={node.image_url}
              alt={node.name}
              fill
              className={styles.splitImage}
              sizes="(min-width: 768px) 50vw, 100vw"
              priority
            />
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
          {photos && photos.length > 0 && (
            <div className={styles.gallerySection}>
              <ScrollAnimationWrapper delay={0}>
                <hr className={styles.galleryDivider} />
                <h2 className={styles.galleryTitle}>{GALLERY_SECTION_TITLE}</h2>
              </ScrollAnimationWrapper>
              <NodeGallery photos={photos} nodeName={node.name} />
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
