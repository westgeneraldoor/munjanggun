import { notFound } from 'next/navigation'
import SiteSettingsForm from '@/components/admin/SiteSettingsForm'
import styles from './site-settings-fixture.module.css'

export default function AdminSiteSettingsFixturePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <main className={styles.page} data-mg-theme="admin">
      <SiteSettingsForm
        initialData={{
          id: 'singleton',
          site_title: '문장군 디지털 쇼룸',
          site_description: '현장 경험을 바탕으로 제품 선택을 돕는 문장군 쇼룸입니다.',
          og_image_url: null,
          reservation_url: 'https://example.com/reservation',
          store_url: 'https://example.com/store',
          hero_enabled: true,
          hero_video_url: null,
          hero_mobile_video_url: null,
          hero_title: '문장군 쇼룸',
          hero_subtitle: '현장에 맞는 선택',
          hero_description: '제품과 공간을 함께 살펴보세요.',
          hero_slide_interval: 5,
          hero_slide_transition: 'fade',
          card_text_position: 'overlay',
        }}
        heroMedia={[
          {
            image_url: '/icon.png',
            device_type: 'desktop',
            media_type: 'image',
            display_order: 0,
          },
        ]}
      />
    </main>
  )
}
