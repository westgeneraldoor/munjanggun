import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'
import { Database } from '@/types/database'
import CollectionList from '@/components/admin/CollectionList'
import styles from './collections.module.css'

type CollectionRow = Database['colorbook']['Tables']['collections']['Row']
type CollectionWithCount = CollectionRow & { colors: { count: number }[] | { count: number } | null }

export default async function CollectionsPage() {
  const supabase = await createClient()
  
  // 컬렉션 목록 조회 (display_order 순)
  // 색상 갯수(count) 포함 조회
  const { data: collections, error } = await supabase
    .schema('colorbook')
    .from('collections')
    .select(`
      id, 
      name, 
      slug, 
      description, 
      thumbnail_url,
      status, 
      display_order,
      colors (count)
    `)
    .order('display_order', { ascending: true })

  if (error) {
    logError('컬렉션 로드 에러:', error)
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>데이터를 불러오는 중 오류가 발생했습니다.</h2>
          <p className={styles.emptyText}>{error.message}</p>
        </div>
      </div>
    )
  }

  // 데이터 가공 (colors count 파싱)
  const collectionsData = collections as unknown as CollectionWithCount[]
  
  const formattedCollections = collectionsData?.map(col => {
    // Supabase JS v2에서 count 조회의 결과는 배열 형태임
    // col.colors는 [{ count: number }] 형태이거나 빈 배열일 수 있음
    let colorsCount = 0;
    if (col.colors && Array.isArray(col.colors)) {
      colorsCount = col.colors[0]?.count || 0;
    } else if (col.colors && typeof col.colors === 'object' && 'count' in col.colors) {
      colorsCount = col.colors.count || 0;
    }

    return {
      id: col.id,
      name: col.name,
      slug: col.slug,
      description: col.description,
      thumbnail_url: col.thumbnail_url,
      status: col.status,
      display_order: col.display_order,
      _count: {
        colors: colorsCount
      }
    }
  }) || []

  return (
    <div className={styles.container}>
      <CollectionList initialCollections={formattedCollections} />
    </div>
  )
}
