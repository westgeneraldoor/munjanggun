import test from 'node:test'
import assert from 'node:assert/strict'

import {
  collectNodeTree,
  createCopiedNodeInsert,
  makeUniqueCopySlug,
  type CopyableNode,
} from './nodeCopy.ts'

const baseNode: CopyableNode = {
  id: 'source',
  parent_id: null,
  type: 'listing',
  name: 'Source',
  slug: 'source',
  status: 'published',
  display_order: 0,
  image_url: null,
  card_subtitle: null,
  hero_enabled: false,
  hero_video_url: null,
  hero_mobile_video_url: null,
  hero_title: null,
  hero_subtitle: null,
  hero_description: null,
  hero_slide_interval: 5000,
  hero_slide_transition: 'fade',
  tagline: null,
  description: null,
  card_text_position: 'overlay',
}

function node(overrides: Partial<CopyableNode>): CopyableNode {
  return { ...baseNode, ...overrides }
}

test('collectNodeTree returns the selected node before all descendants in display order', () => {
  const nodes = [
    node({ id: 'root', name: 'Root', display_order: 0 }),
    node({ id: 'child-b', parent_id: 'root', display_order: 1 }),
    node({ id: 'grandchild', parent_id: 'child-a', display_order: 0 }),
    node({ id: 'child-a', parent_id: 'root', display_order: 0 }),
    node({ id: 'outside', parent_id: null, display_order: 1 }),
  ]

  assert.deepEqual(
    collectNodeTree('root', nodes).map(item => item.id),
    ['root', 'child-a', 'grandchild', 'child-b']
  )
})

test('makeUniqueCopySlug appends copy suffixes until the sibling slug is unused', () => {
  assert.equal(
    makeUniqueCopySlug('oak', new Set(['oak', 'oak-copy', 'oak-copy-2'])),
    'oak-copy-3'
  )
})

test('createCopiedNodeInsert makes a draft copy without carrying generated fields', () => {
  const insert = createCopiedNodeInsert({
    source: node({ id: 'oak-id', name: 'Oak', slug: 'oak', status: 'published' }),
    parentId: 'target-parent',
    displayOrder: 7,
    siblingSlugs: new Set(['oak', 'oak-copy']),
  })

  assert.equal(insert.parent_id, 'target-parent')
  assert.equal(insert.display_order, 7)
  assert.equal(insert.status, 'draft')
  assert.equal(insert.slug, 'oak-copy-2')
  assert.equal('id' in insert, false)
  assert.equal('created_at' in insert, false)
  assert.equal('updated_at' in insert, false)
})
