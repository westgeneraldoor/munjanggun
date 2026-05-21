import assert from 'node:assert/strict'
import test from 'node:test'

import { buildShareDescription } from './share.ts'

test('buildShareDescription includes the browsing stage before the node copy', () => {
  assert.equal(
    buildShareDescription({
      breadcrumbItems: [
        { name: '홈', href: '/' },
        { name: 'Design', href: '/design' },
        { name: '라운드아치', href: '/design/round-arch' },
      ],
      description: '상하 아치, 갤러리, 우아함',
    }),
    '단계: 홈 > Design > 라운드아치\n상하 아치, 갤러리, 우아함'
  )
})

test('buildShareDescription falls back cleanly when there is no breadcrumb or body copy', () => {
  assert.equal(buildShareDescription({ breadcrumbItems: [], description: '' }), '문장군 디지털 쇼룸')
})
