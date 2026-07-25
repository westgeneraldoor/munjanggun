import { notFound } from 'next/navigation'
import { createPublicShowroomClient, hasPublicShowroomEnv } from '@/lib/supabase/public'
import styles from './preview.module.css'
import ShowroomImage from '@/components/showroom/ShowroomImage'
import { loadShowroomImageSources } from '@/lib/showroom/image-sources'
import type { Database } from '@/types/database'

type NodeRow = Database['showroom']['Tables']['nodes']['Row']

type PreviewPayload = {
  expired: boolean
  node?: Pick<NodeRow, 'id' | 'type' | 'name' | 'status' | 'image_url' | 'tagline' | 'description'>
  heroMedia?: Array<Pick<Database['showroom']['Tables']['hero_media']['Row'], 'id' | 'image_url' | 'device_type' | 'media_type' | 'display_order'>>
  childNodes?: Array<{ id: string; name: string; image_url: string | null }>
  galleryPhotos?: Array<Pick<Database['showroom']['Tables']['gallery_photos']['Row'], 'id' | 'image_url' | 'caption' | 'display_order'>>
}

type PreviewRpcClient = {
  rpc(
    name: 'get_preview_payload',
    args: { p_token: string },
  ): PromiseLike<{ data: Database['showroom']['Functions']['get_preview_payload']['Returns'] | null; error: unknown }>
}

interface PageProps {
  params: Promise<{
    token: string
  }>
}

function toPreviewPayload(value: unknown): PreviewPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as PreviewPayload
}

export default async function PreviewPage(props: PageProps) {
  if (!hasPublicShowroomEnv()) {
    notFound()
  }

  const { token } = await props.params
  const supabase = createPublicShowroomClient()
  const previewClient = supabase as unknown as PreviewRpcClient
  const { data, error } = await previewClient.rpc('get_preview_payload', { p_token: token })

  if (error) notFound()

  const previewData = toPreviewPayload(data)

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

  if (previewData.expired) {
    return (
      <div className={styles.expiredContainer}>
        <div className={styles.expiredCard}>
          <h2>링크가 만료되었습니다</h2>
          <p>보안을 위해 72시간이 지난 미리보기 링크는 사용할 수 없습니다.<br/>관리자에게 새로운 링크를 요청해주세요.</p>
        </div>
      </div>
    )
  }

  const node = previewData.node

  if (!node) {
    notFound()
  }

  const heroMedia = previewData.heroMedia ?? []
  const childNodes = previewData.childNodes ?? []
  const galleryPhotos = previewData.galleryPhotos ?? []
  const imageSources = await loadShowroomImageSources(supabase, [
    node.image_url,
    ...heroMedia.map(media => media.image_url),
    ...galleryPhotos.map(photo => photo.image_url),
  ], { previewToken: token })

  return (
    <main className={styles.main}>
      <div className={styles.previewBanner}>
        ⚠️ 미리보기 모드입니다. (실제 고객에게는 보이지 않는 배너입니다)
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>{node.name}</h1>
        <div className={styles.metaList}>
          <span className={styles.metaChip}>
            타입: {node.type}
          </span>
          <span className={styles.metaChip}>
            상태: {node.status}
          </span>
        </div>

        {node.image_url && (
          <div className={styles.coverSection}>
            <h3 className={styles.coverHeading}>대표 이미지</h3>
            <div className={styles.coverFrame}>
              <ShowroomImage
                className={styles.coverImage}
                source={imageSources[node.image_url] ?? node.image_url}
                purpose="display"
                alt={node.name}
                fill
              />
            </div>
          </div>
        )}

        {node.tagline && <p className={styles.tagline}>{node.tagline}</p>}
        {node.description && <p className={styles.description}>{node.description}</p>}

        {node.type === 'listing' && (
          <>
            <h3 className={styles.sectionHeading}>히어로 미디어 ({heroMedia.length})</h3>
            <div className={styles.heroGrid}>
              {heroMedia.map(m => (
                <div key={m.id} className={styles.heroFrame}>
                  <ShowroomImage
                    className={styles.gridImage}
                    source={imageSources[m.image_url] ?? m.image_url}
                    purpose="display"
                    alt=""
                    fill
                  />
                </div>
              ))}
            </div>

            <h3 className={styles.sectionHeading}>하위 노드 ({childNodes.length})</h3>
            <ul className={styles.childList}>
              {childNodes.map((child, i) => (
                <li key={i}>{child.name}</li>
              ))}
            </ul>
          </>
        )}

        {node.type === 'detail' && (
          <>
            <h3 className={styles.sectionHeading}>갤러리 사진 ({galleryPhotos.length})</h3>
            <div className={styles.galleryGrid}>
              {galleryPhotos.map(p => (
                <div key={p.id} className={styles.galleryFrame}>
                  <ShowroomImage
                    className={styles.gridImage}
                    source={imageSources[p.image_url] ?? p.image_url}
                    purpose="display"
                    alt={p.caption || ''}
                    fill
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
