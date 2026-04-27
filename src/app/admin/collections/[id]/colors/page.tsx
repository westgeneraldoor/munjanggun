import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowLeft } from 'lucide-react'
import ColorList from '@/components/admin/ColorList'
import styles from './colors.module.css'

export const dynamic = 'force-dynamic'

export default async function ColorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  // 1. 컬렉션 정보 조회
  const { data: collection, error: collectionError } = await supabase
    .schema('colorbook')
    .from('collections')
    .select('id, name, slug')
    .eq('id', id)
    .single()
    
  if (collectionError || !collection) {
    notFound()
  }

  // 2. 컬러 목록 조회 (시공사진 수 포함)
  // supabase count 사용 시 배열로 반환될 수 있음
  const { data: colors, error: colorsError } = await supabase
    .schema('colorbook')
    .from('colors')
    .select(`
      id, name, slug, status, display_order, texture_image_url,
      installation_photos ( count )
    `)
    .eq('collection_id', id)
    .order('display_order', { ascending: true })

  if (colorsError) {
    logError('컬러 목록 조회 실패:', colorsError)
  }

  // 포맷팅
  const formattedColors = (colors || []).map(c => {
    // Supabase JS v2 select with count returns array like [{ count: 0 }]
    const photosCount = Array.isArray(c.installation_photos) 
      ? c.installation_photos[0]?.count || 0 
      : 0;
      
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status as 'draft' | 'published',
      display_order: c.display_order,
      texture_image_url: c.texture_image_url,
      _count: {
        installation_photos: photosCount
      }
    }
  })

  return (
    <div className={styles.container}>
      <div className={styles.headerNav}>
        <Link href="/admin/collections" className={styles.backLink}>
          <ArrowLeft size={16} />
          컬렉션 목록으로 돌아가기
        </Link>
      </div>
      
      <div className={styles.header}>
        <h1 className={styles.title}>
          {collection.name} 컬러 관리
        </h1>
        <Link href={`/admin/collections/${collection.id}/colors/new`} className={styles.addBtn}>
          <Plus size={20} />
          <span>컬러 추가</span>
        </Link>
      </div>

      <ColorList initialColors={formattedColors} collectionId={collection.id} />
    </div>
  )
}
