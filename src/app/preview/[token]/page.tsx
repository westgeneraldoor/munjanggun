import { notFound } from 'next/navigation'
import { hasPublicShowroomEnv } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import styles from './preview.module.css'
import Image from 'next/image'
import { Database } from '@/types/database'

interface PageProps {
  params: Promise<{
    token: string
  }>
}

export default async function PreviewPage(props: PageProps) {
  if (!hasPublicShowroomEnv()) {
    notFound()
  }

  const { token } = await props.params
  const supabase = await createClient()

  // 토큰 검증
  const showroomDb = supabase.schema('showroom')
  const { data: previewData } = await showroomDb
    .from('preview_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (!previewData) {
    return (
      <div className={styles.expiredContainer}>
        <div className={styles.expiredCard}>
          <h2>유효하지 않은 링크입니다</h2>
          <p>미리보기 링크가 만료되었거나 존재하지 않습니다.</p>
        </div>
      </div>
    )
  }

  const expiresAt = new Date(previewData.expires_at)
  const now = new Date()

  if (now > expiresAt) {
    return (
      <div className={styles.expiredContainer}>
        <div className={styles.expiredCard}>
          <h2>링크가 만료되었습니다</h2>
          <p>보안을 위해 72시간이 지난 미리보기 링크는 사용할 수 없습니다.<br/>관리자에게 새로운 링크를 요청해주세요.</p>
        </div>
      </div>
    )
  }

  // 노드 조회 (status 무관)
  const { data: node } = await showroomDb
    .from('nodes')
    .select('*')
    .eq('id', previewData.node_id)
    .single()

  if (!node) {
    notFound()
  }

  // 데이터 로딩
  let heroMedia: Database['showroom']['Tables']['hero_media']['Row'][] = []
  let childNodes: { name: string, image_url: string | null }[] = []
  let galleryPhotos: Database['showroom']['Tables']['gallery_photos']['Row'][] = []

  if (node.type === 'listing') {
    const { data: hm } = await showroomDb
      .from('hero_media')
      .select('*')
      .eq('node_id', node.id)
      .order('display_order', { ascending: true })
    heroMedia = hm || []

    const { data: children } = await showroomDb
      .from('nodes')
      .select('name, image_url')
      .eq('parent_id', node.id)
      .order('display_order', { ascending: true })
    childNodes = children || []
  }

  if (node.type === 'detail') {
    const { data: gp } = await showroomDb
      .from('gallery_photos')
      .select('*')
      .eq('node_id', node.id)
      .order('display_order', { ascending: true })
    galleryPhotos = gp || []
  }

  return (
    <main className={styles.main}>
      <div className={styles.previewBanner}>
        ⚠️ 미리보기 모드입니다. (실제 고객에게는 보이지 않는 배너입니다)
      </div>

      <div style={{ padding: 'var(--space-6)', maxWidth: '800px', margin: '0 auto', color: 'var(--color-text)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>{node.name}</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <span style={{ padding: '4px 8px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
            타입: {node.type}
          </span>
          <span style={{ padding: '4px 8px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
            상태: {node.status}
          </span>
        </div>

        {node.image_url && (
          <div style={{ marginBottom: 'var(--space-6)', position: 'relative', width: '100%', aspectRatio: '16/9' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>대표 이미지</h3>
            <Image src={node.image_url} alt={node.name} fill style={{ objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
          </div>
        )}

        {node.tagline && <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>{node.tagline}</p>}
        {node.description && <p style={{ marginBottom: 'var(--space-6)', whiteSpace: 'pre-wrap' }}>{node.description}</p>}

        {node.type === 'listing' && (
          <>
            <h3 style={{ marginBottom: 'var(--space-3)' }}>히어로 미디어 ({heroMedia.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
              {heroMedia.map(m => (
                <div key={m.id} style={{ position: 'relative', width: '100%', aspectRatio: '3/4' }}>
                  <Image src={m.image_url} alt="" fill style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                </div>
              ))}
            </div>

            <h3 style={{ marginBottom: 'var(--space-3)' }}>하위 노드 ({childNodes.length})</h3>
            <ul style={{ listStyle: 'disc', paddingLeft: 'var(--space-4)' }}>
              {childNodes.map((child, i) => (
                <li key={i}>{child.name}</li>
              ))}
            </ul>
          </>
        )}

        {node.type === 'detail' && (
          <>
            <h3 style={{ marginBottom: 'var(--space-3)' }}>갤러리 사진 ({galleryPhotos.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              {galleryPhotos.map(p => (
                <div key={p.id} style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
                  <Image src={p.image_url} alt={p.caption || ''} fill style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
