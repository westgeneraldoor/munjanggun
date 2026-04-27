import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ColorForm from '@/components/admin/ColorForm'
import styles from '../colors.module.css'

export const dynamic = 'force-dynamic'

export default async function ColorEditPage({ params }: { params: Promise<{ id: string, colorId: string }> }) {
  const { id, colorId } = await params
  const supabase = await createClient()
  const isNew = colorId === 'new'
  
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

  let colorData = null

  if (!isNew) {
    // 2. 기존 컬러 정보 + 시공사진 조회
    const { data: color, error: colorError } = await supabase
      .schema('colorbook')
      .from('colors')
      .select(`
        *,
        installation_photos (
          id, image_url, caption, display_order
        )
      `)
      .eq('id', colorId)
      .single()
      
    if (colorError || !color) {
      notFound()
    }
    
    colorData = color
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerNav}>
        <Link href={`/admin/collections/${collection.id}/colors`} className={styles.backLink}>
          <ArrowLeft size={16} />
          {collection.name} 컬러 목록으로
        </Link>
      </div>
      
      <div className={styles.header}>
        <h1 className={styles.title}>
          {isNew ? '새 컬러 추가' : '컬러 수정'}
        </h1>
      </div>

      <ColorForm 
        collectionId={collection.id} 
        collectionSlug={collection.slug}
        initialData={colorData} 
      />
    </div>
  )
}
