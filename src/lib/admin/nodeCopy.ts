import type { Database } from '@/types/database'

export type CopyableNode = Database['showroom']['Tables']['nodes']['Row']
export type CopiedNodeInsert = Database['showroom']['Tables']['nodes']['Insert']

type CreateCopiedNodeInsertOptions = {
  source: CopyableNode
  parentId: string | null
  displayOrder: number
  siblingSlugs: Set<string>
}

export function collectNodeTree(sourceId: string, nodes: CopyableNode[]): CopyableNode[] {
  const byParent = new Map<string | null, CopyableNode[]>()

  for (const node of nodes) {
    const siblings = byParent.get(node.parent_id) ?? []
    siblings.push(node)
    byParent.set(node.parent_id, siblings)
  }

  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.display_order - b.display_order)
  }

  const source = nodes.find(node => node.id === sourceId)
  if (!source) return []

  const ordered: CopyableNode[] = []
  const visit = (node: CopyableNode) => {
    ordered.push(node)
    for (const child of byParent.get(node.id) ?? []) {
      visit(child)
    }
  }

  visit(source)
  return ordered
}

export function makeUniqueCopySlug(slug: string, siblingSlugs: Set<string>) {
  let index = 1
  let candidate = `${slug}-copy`

  while (siblingSlugs.has(candidate)) {
    index += 1
    candidate = `${slug}-copy-${index}`
  }

  return candidate
}

export function createCopiedNodeInsert({
  source,
  parentId,
  displayOrder,
  siblingSlugs,
}: CreateCopiedNodeInsertOptions): CopiedNodeInsert {
  return {
    parent_id: parentId,
    type: source.type,
    name: source.name,
    slug: makeUniqueCopySlug(source.slug, siblingSlugs),
    status: 'draft',
    display_order: displayOrder,
    image_url: source.image_url,
    card_subtitle: source.card_subtitle,
    hero_enabled: source.hero_enabled,
    hero_video_url: source.hero_video_url,
    hero_mobile_video_url: source.hero_mobile_video_url,
    hero_title: source.hero_title,
    hero_subtitle: source.hero_subtitle,
    hero_description: source.hero_description,
    hero_slide_interval: source.hero_slide_interval,
    hero_slide_transition: source.hero_slide_transition,
    tagline: source.tagline,
    description: source.description,
    card_text_position: source.card_text_position,
  }
}
