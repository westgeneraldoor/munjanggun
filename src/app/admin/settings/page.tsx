import { createClient } from '@/lib/supabase/server'
import SiteSettingsForm from '@/components/admin/SiteSettingsForm'
import {
  PlatformLinkButton,
  PlatformPageHeader,
  PlatformPanel,
  PlatformStatePanel,
} from '@/components/platform/ui'
import { logError } from '@/lib/logger'
import styles from './settings.module.css'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  const { data: profile, error: profileError } = user
    ? await supabase
        .schema('platform')
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null, error: null }

  const accessError = userError ?? profileError
  const isAdministrator = profile?.role === 'administrator'

  if (accessError) {
    logError('Failed to verify site settings access:', accessError)
  }

  if (!user || accessError || !isAdministrator) {
    return (
      <div className={styles.container}>
        <PlatformPageHeader title="사이트 설정" />
        <PlatformPanel className={styles.content}>
          <PlatformStatePanel
            tone="error"
            title="사이트 설정에 접근할 수 없습니다"
            description="관리자 권한을 확인할 수 없어 설정 폼을 열지 않았습니다."
            action={<PlatformLinkButton href="/admin" variant="secondary">관리자 홈</PlatformLinkButton>}
          />
        </PlatformPanel>
      </div>
    )
  }

  const [
    { data: settings, error: settingsError },
    { data: heroMedia, error: heroMediaError },
  ] = await Promise.all([
    supabase
      .schema('showroom')
      .from('site_settings')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle(),
    supabase
      .schema('showroom')
      .from('site_hero_media')
      .select('*')
      .order('display_order', { ascending: true }),
  ])

  const loadError = settingsError ?? heroMediaError
  if (loadError) {
    logError('Failed to load site settings:', loadError)
  }

  return (
    <div className={styles.container}>
      <PlatformPageHeader
        title="사이트 설정"
        description="쇼룸의 기본 정보와 메인 히어로 노출을 관리합니다."
      />

      <PlatformPanel className={styles.content}>
        {loadError ? (
          <PlatformStatePanel
            tone="error"
            title="사이트 설정을 불러오지 못했습니다"
            description="기존 설정을 보호하기 위해 저장 폼을 열지 않았습니다. 잠시 후 다시 시도해 주세요."
            action={<PlatformLinkButton href="/admin/settings" variant="secondary">다시 시도</PlatformLinkButton>}
          />
        ) : (
          <SiteSettingsForm initialData={settings} heroMedia={heroMedia ?? []} />
        )}
      </PlatformPanel>
    </div>
  )
}
