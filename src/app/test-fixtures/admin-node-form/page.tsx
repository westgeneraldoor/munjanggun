import { notFound } from 'next/navigation'
import NodeForm from '@/components/admin/NodeForm'
import type { Database } from '@/types/database'
import styles from './node-form-fixture.module.css'

type NodeRow = Database['showroom']['Tables']['nodes']['Row']
type GalleryRow = Database['showroom']['Tables']['gallery_photos']['Row']
type HeroRow = Database['showroom']['Tables']['hero_media']['Row']

export default function AdminNodeFormFixturePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  const node: NodeRow = {
    id: '11111111-1111-4111-8111-111111111111',
    parent_id: null,
    type: 'detail',
    name: '베이직 제품',
    slug: 'basic-product',
    status: 'draft',
    display_order: 0,
    image_url: 'https://example.com/card.jpg',
    card_subtitle: '기본에 충실한 제품',
    card_text_position: 'overlay',
    hero_enabled: false,
    hero_video_url: null,
    hero_mobile_video_url: null,
    hero_title: null,
    hero_subtitle: null,
    hero_description: null,
    hero_slide_interval: 5,
    hero_slide_transition: 'fade',
    tagline: '현장에 맞는 기본 선택',
    description: '제품 상세 설명입니다.',
    created_at: '2026-07-16T00:00:00.000Z',
    updated_at: '2026-07-16T00:00:00.000Z',
  }
  const galleryPhotos: GalleryRow[] = [{
    id: '22222222-2222-4222-8222-222222222222',
    node_id: node.id,
    image_url: 'https://example.com/gallery.jpg',
    caption: '샘플',
    display_order: 0,
    created_at: '2026-07-16T00:00:00.000Z',
  }]
  const heroMedia: HeroRow[] = [{
    id: '33333333-3333-4333-8333-333333333333',
    node_id: node.id,
    image_url: 'https://example.com/hero.jpg',
    mobile_image_url: null,
    device_type: 'desktop',
    media_type: 'image',
    display_order: 0,
    created_at: '2026-07-16T00:00:00.000Z',
  }]

  return (
    <main className={styles.page} data-mg-theme="admin">
      <NodeForm node={node} heroMedia={heroMedia} galleryPhotos={galleryPhotos} childCount={0} />
    </main>
  )
}
