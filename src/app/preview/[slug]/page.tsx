import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HeroTexture from '@/components/customer/HeroTexture'
import ColorInfo from '@/components/customer/ColorInfo'
import InstallationGallery from '@/components/customer/InstallationGallery'
import CTABar from '@/components/customer/CTABar'
import styles from './preview.module.css'

interface PageProps {
  params: Promise<{
    slug: string // This is the token
  }>
}

export default async function PreviewPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  const token = slug

  // 토큰 검증
  const { data: previewData } = await supabase
    .schema('colorbook')
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
          <p>보안을 위해 24시간이 지난 미리보기 링크는 사용할 수 없습니다.<br/>관리자에게 새로운 링크를 요청해주세요.</p>
        </div>
      </div>
    )
  }

  // 컬러 조회 (status 무관)
  const { data: color } = await supabase
    .schema('colorbook')
    .from('colors')
    .select('*')
    .eq('id', previewData.color_id)
    .single()

  if (!color) {
    notFound()
  }

  // 컬렉션 정보 조회
  const { data: collection } = await supabase
    .schema('colorbook')
    .from('collections')
    .select('name')
    .eq('id', color.collection_id)
    .single()

  const collectionName = collection?.name || '알 수 없음'

  // 시공 사진 조회
  const { data: photos } = await supabase
    .schema('colorbook')
    .from('installation_photos')
    .select('*')
    .eq('color_id', color.id)
    .order('display_order', { ascending: true })

  // 설정 조회
  const { data: settings } = await supabase
    .schema('colorbook')
    .from('site_settings')
    .select('reservation_url, store_url')
    .single()

  return (
    <main className={styles.main}>
      <div className={styles.previewBanner}>
        ⚠️ 미리보기 모드입니다. (실제 고객에게는 보이지 않는 배너입니다)
      </div>

      <HeroTexture imageUrl={color.texture_image_url} colorName={color.name} />
      
      <ColorInfo
        collectionName={collectionName}
        colorName={color.name}
        tagline={color.tagline}
        description={color.description}
      />

      <InstallationGallery photos={photos || []} />

      <CTABar
        reservationUrl={settings?.reservation_url || null}
        storeUrl={settings?.store_url || null}
        hideUntilScroll={true}
      />
    </main>
  )
}
