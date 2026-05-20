import 'server-only'
import { cache } from 'react'
import { createPublicShowroomClient } from '@/lib/supabase/public'
import { Database } from '@/types/database'

export type NodeRow = Database['showroom']['Tables']['nodes']['Row']
export type BreadcrumbItem = { name: string; href: string }

export type ResolvedSlugChain = {
  currentNode: NodeRow
  breadcrumbItems: BreadcrumbItem[]
}

const resolveSlugPath = cache(async (slugPath: string): Promise<ResolvedSlugChain | null> => {
  const slugs = slugPath.split('/').filter(Boolean)
  const showroomDb = createPublicShowroomClient().schema('showroom')

  let parentId: string | null = null
  let currentNode: NodeRow | null = null
  const breadcrumbItems: BreadcrumbItem[] = [{ name: '홈', href: '/' }]

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    let query = showroomDb
      .from('nodes')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')

    query = parentId === null
      ? query.is('parent_id', null)
      : query.eq('parent_id', parentId)

    const { data: node } = await query.maybeSingle()

    if (!node) {
      return null
    }

    currentNode = node
    parentId = node.id
    breadcrumbItems.push({
      name: node.name,
      href: `/${slugs.slice(0, i + 1).join('/')}`,
    })
  }

  if (!currentNode) {
    return null
  }

  return { currentNode, breadcrumbItems }
})

export async function resolveSlugChain(slugs: string[]) {
  return resolveSlugPath(slugs.join('/'))
}

export function buildNodeUrl(node: Pick<NodeRow, 'slug'>, basePath = '') {
  return basePath ? `${basePath}/${node.slug}` : `/${node.slug}`
}
