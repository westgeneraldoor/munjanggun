import assert from 'node:assert/strict'
import test from 'node:test'

import { getCompressedImageMimeType } from './imageUpload.ts'

test('getCompressedImageMimeType preserves PNG uploads', () => {
  assert.equal(getCompressedImageMimeType('image/png'), 'image/png')
})

test('getCompressedImageMimeType preserves WebP uploads', () => {
  assert.equal(getCompressedImageMimeType('image/webp'), 'image/webp')
})

test('getCompressedImageMimeType uses JPEG for other image uploads', () => {
  assert.equal(getCompressedImageMimeType('image/jpeg'), 'image/jpeg')
  assert.equal(getCompressedImageMimeType('image/gif'), 'image/jpeg')
})
