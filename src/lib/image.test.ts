import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldBypassNextImageOptimization } from './image.ts'

test('shouldBypassNextImageOptimization uses original URLs for Supabase public storage images', () => {
  assert.equal(
    shouldBypassNextImageOptimization('https://cebafroyvmllbyivevjd.supabase.co/storage/v1/object/public/showroom-images/nodes/full-window/sample.png'),
    true
  )
})

test('shouldBypassNextImageOptimization keeps non-storage images optimized', () => {
  assert.equal(shouldBypassNextImageOptimization('/icon.png'), false)
  assert.equal(shouldBypassNextImageOptimization('https://example.com/image.png'), false)
  assert.equal(shouldBypassNextImageOptimization(null), false)
})
