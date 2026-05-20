import { notFound } from 'next/navigation'
import { createShowroomClient } from '@/lib/supabase/server'
import NodeForm from '@/components/admin/NodeForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { Database } from '@/types/database'

export default async function NodeEditPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createShowroomClient()
  const showroomDb = supabase.schema('showroom')

  // 1. Fetch node data
  const { data: node, error: nodeError } = await showroomDb
    .from('nodes')
    .select('*')
    .eq('id', id)
    .single()

  if (nodeError || !node) {
    notFound()
  }

  // 2. Fetch hero_media if listing
  let heroMedia: Database['showroom']['Tables']['hero_media']['Row'][] = []
  if (node.type === 'listing') {
    const { data: media } = await showroomDb
      .from('hero_media')
      .select('*')
      .eq('node_id', id)
      .order('display_order', { ascending: true })
    if (media) heroMedia = media
  }

  // 3. Fetch gallery_photos if detail
  let galleryPhotos: Database['showroom']['Tables']['gallery_photos']['Row'][] = []
  if (node.type === 'detail') {
    const { data: photos } = await showroomDb
      .from('gallery_photos')
      .select('*')
      .eq('node_id', id)
      .order('display_order', { ascending: true })
    if (photos) galleryPhotos = photos
  }

  // 4. Fetch child count for type conversion protection
  const { count } = await showroomDb
    .from('nodes')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', id)

  const childCount = count || 0

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <Link 
          href="/admin/nodes" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            color: 'var(--admin-text-sub)',
            textDecoration: 'none',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)'
          }}
        >
          <ChevronLeft size={16} style={{ marginRight: '4px' }} />
          돌아가기
        </Link>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--admin-text)', margin: 0 }}>
          노드 편집: {node.name}
        </h1>
      </div>

      <NodeForm 
        node={node} 
        heroMedia={heroMedia} 
        galleryPhotos={galleryPhotos} 
        childCount={childCount} 
      />
    </div>
  )
}
