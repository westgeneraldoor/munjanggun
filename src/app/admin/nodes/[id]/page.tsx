import { notFound } from 'next/navigation'
import { createShowroomClient } from '@/lib/supabase/server'
import NodeForm from '@/components/admin/NodeForm'
import {
  PlatformLinkButton,
  PlatformPageHeader,
  PlatformPanel,
  PlatformStatePanel,
} from '@/components/platform/ui'
import { logError } from '@/lib/logger'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function NodeEditPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createShowroomClient()
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
    logError('Failed to verify node editor access:', accessError)
  }

  if (!user || accessError || !isAdministrator) {
    return (
      <div className={styles.container}>
        <PlatformPageHeader title="노드 편집" />
        <PlatformPanel>
          <PlatformStatePanel
            tone="error"
            title="노드 편집에 접근할 수 없습니다"
            description="관리자 권한을 확인할 수 없어 편집 폼을 열지 않았습니다."
            action={<PlatformLinkButton href="/admin/nodes" variant="secondary">노드 목록</PlatformLinkButton>}
          />
        </PlatformPanel>
      </div>
    )
  }

  const showroomDb = supabase.schema('showroom')
  const { data: node, error: nodeError } = await showroomDb
    .from('nodes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (nodeError) {
    logError('Failed to load node:', nodeError)
    return (
      <div className={styles.container}>
        <PlatformPageHeader title="노드 편집" />
        <PlatformPanel>
          <PlatformStatePanel
            tone="error"
            title="노드를 불러오지 못했습니다"
            description="기존 데이터를 보호하기 위해 편집 폼을 열지 않았습니다."
            action={<PlatformLinkButton href={`/admin/nodes/${id}`} variant="secondary">다시 시도</PlatformLinkButton>}
          />
        </PlatformPanel>
      </div>
    )
  }

  if (!node) notFound()

  const [heroResult, galleryResult, childResult] = await Promise.all([
    showroomDb.from('hero_media').select('*').eq('node_id', id).order('display_order', { ascending: true }),
    showroomDb.from('gallery_photos').select('*').eq('node_id', id).order('display_order', { ascending: true }),
    showroomDb.from('nodes').select('*', { count: 'exact', head: true }).eq('parent_id', id),
  ])

  const { data: heroMedia, error: heroMediaError } = heroResult
  const { data: galleryPhotos, error: galleryPhotosError } = galleryResult
  const { count: childCount, error: childCountError } = childResult
  const loadError = heroMediaError ?? galleryPhotosError ?? childCountError

  if (loadError) {
    logError('Failed to load node editor dependencies:', loadError)
  }

  return (
    <div className={styles.container}>
      <PlatformPageHeader
        title={`노드 편집: ${node.name}`}
        description="쇼룸 노드의 공개 상태와 콘텐츠, 미디어를 한 번에 저장합니다."
        actions={<PlatformLinkButton href="/admin/nodes" variant="secondary">노드 목록</PlatformLinkButton>}
      />
      {loadError ? (
        <PlatformPanel>
          <PlatformStatePanel
            tone="error"
            title="노드 편집 데이터를 불러오지 못했습니다"
            description="미디어나 하위 항목을 빈 값으로 덮어쓰지 않도록 편집 폼을 열지 않았습니다."
            action={<PlatformLinkButton href={`/admin/nodes/${id}`} variant="secondary">다시 시도</PlatformLinkButton>}
          />
        </PlatformPanel>
      ) : (
        <NodeForm
          node={node}
          heroMedia={heroMedia ?? []}
          galleryPhotos={galleryPhotos ?? []}
          childCount={childCount ?? 0}
        />
      )}
    </div>
  )
}
