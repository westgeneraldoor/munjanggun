import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createPublicShowroomClient } from '@/lib/supabase/public'
import { Database } from '@/types/database'
import styles from './preview.module.css'

type NodeRow = Database['showroom']['Tables']['nodes']['Row']
type HeroMediaRow = Database['showroom']['Tables']['hero_media']['Row']
type GalleryPhotoRow = Database['showroom']['Tables']['gallery_photos']['Row']

type PreviewPayload = {
  expired: boolean
  node?: NodeRow
  heroMedia?: HeroMediaRow[]
  childNodes?: { id: string, name: string, image_url: string | null }[]
  galleryPhotos?: GalleryPhotoRow[]
}

interface PageProps {
  params: Promise<{
    token: string
  }>
}

function toPreviewPayload(value: unknown): PreviewPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as PreviewPayload
}

export default async function PreviewPage(props: PageProps) {
  const { token } = await props.params
  const supabase = createPublicShowroomClient()

  const { data, error } = await supabase.rpc('get_preview_payload', {
    p_token: token,
  })

  if (error) {
    notFound()
  }

  const payload = toPreviewPayload(data)

  if (!payload) {
    return (
      <div className={styles.expiredContainer}>
        <div className={styles.expiredCard}>
          <h2>유효하지 않은 링크입니다</h2>
          <p>미리보기 링크가 만료되었거나 존재하지 않습니다.</p>
        </div>
      </div>
    )
  }

  if (payload.expired) {
    return (
      <div className={styles.expiredContainer}>
        <div className={styles.expiredCard}>
          <h2>링크가 만료되었습니다</h2>
          <p>
            보안을 위해 72시간이 지난 미리보기 링크는 사용할 수 없습니다.
            <br />
            관리자에게 새로운 링크를 요청해주세요.
          </p>
        </div>
      </div>
    )
  }

  if (!payload.node) {
    notFound()
  }

  const node = payload.node
  const heroMedia = payload.heroMedia || []
  const childNodes = payload.childNodes || []
  const galleryPhotos = payload.galleryPhotos || []

  return (
    <main className={styles.main}>
      <div className={styles.previewBanner}>
        미리보기 모드입니다. 실제 고객에게는 보이지 않는 배너입니다.
      </div>

      <div className={styles.previewContent}>
        <h1 className={styles.previewTitle}>{node.name}</h1>
        <div className={styles.metaRow}>
          <span className={styles.metaBadge}>타입: {node.type}</span>
          <span className={styles.metaBadge}>상태: {node.status}</span>
        </div>

        {node.image_url && (
          <section className={styles.mediaBlock}>
            <h3 className={styles.sectionTitle}>대표 이미지</h3>
            <div className={styles.imageFrame}>
              <Image
                src={node.image_url}
                alt={node.name}
                fill
                sizes="(max-width: 800px) 100vw, 800px"
                className={styles.previewImage}
              />
            </div>
          </section>
        )}

        {node.tagline && (
          <p className={styles.tagline}>{node.tagline}</p>
        )}
        {node.description && (
          <p className={styles.description}>{node.description}</p>
        )}

        {node.type === 'listing' && (
          <>
            <section className={styles.mediaBlock}>
              <h3 className={styles.sectionTitle}>히어로 미디어 ({heroMedia.length})</h3>
              <div className={styles.heroGrid}>
                {heroMedia.map(m => (
                  <div key={m.id} className={styles.portraitFrame}>
                    <Image
                      src={m.image_url}
                      alt=""
                      fill
                      sizes="(max-width: 800px) 50vw, 180px"
                      className={styles.previewImage}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.mediaBlock}>
              <h3 className={styles.sectionTitle}>하위 노드 ({childNodes.length})</h3>
              <ul className={styles.childList}>
                {childNodes.map(child => (
                  <li key={child.id}>{child.name}</li>
                ))}
              </ul>
            </section>
          </>
        )}

        {node.type === 'detail' && (
          <section className={styles.mediaBlock}>
            <h3 className={styles.sectionTitle}>갤러리 사진 ({galleryPhotos.length})</h3>
            <div className={styles.galleryGrid}>
              {galleryPhotos.map(p => (
                <div key={p.id} className={styles.squareFrame}>
                  <Image
                    src={p.image_url}
                    alt={p.caption || ''}
                    fill
                    sizes="(max-width: 800px) 50vw, 240px"
                    className={styles.previewImage}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
