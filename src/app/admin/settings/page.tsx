import { createClient } from '@/lib/supabase/server'
import SiteSettingsForm from '@/components/admin/SiteSettingsForm'
import styles from './settings.module.css'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  const { data: settings } = await supabase
    .schema('showroom')
    .from('site_settings')
    .select('*')
    .eq('id', 'singleton')
    .single()

  const { data: heroMedia } = await supabase
    .schema('showroom')
    .from('site_hero_media')
    .select('*')
    .order('display_order', { ascending: true })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>사이트 설정</h1>
      </div>

      <div className={styles.content}>
        <SiteSettingsForm initialData={settings} heroMedia={heroMedia || []} />
      </div>
    </div>
  )
}
