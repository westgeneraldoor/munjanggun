import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const source = relativePath => readFile(path.join(projectRoot, relativePath), 'utf8')

const [client, css] = await Promise.all([
  source('src/app/admin/platform/settings/SettingsClient.tsx'),
  source('src/app/admin/platform/settings/settings.module.css'),
])

for (const primitive of [
  'PlatformButton',
  'PlatformCheckbox',
  'PlatformField',
  'PlatformIconButton',
  'PlatformLinkButton',
  'PlatformPageHeader',
  'PlatformPanel',
  'PlatformSegmentedControl',
  'PlatformStatePanel',
  'PlatformStatusBadge',
]) {
  assert.match(client, new RegExp(`\\b${primitive}\\b`), `settings must use ${primitive}`)
}

assert.doesNotMatch(client, /\balert\s*\(/, 'settings feedback must use the shared state contract')
assert.doesNotMatch(client, /<input[^>]*type="checkbox"/, 'booking rules must use the shared checkbox')
assert.match(client, /aria-live|PlatformStatePanel/, 'async feedback must be announced')
assert.match(client, /label="견적 운영설정 구분"/)
assert.match(client, /label="예외 날짜 예약 상태"/)
assert.match(client, /등록된 견적 품목이 없습니다/)
assert.match(client, /등록된 예외 일정이 없습니다/)
assert.match(client, /설정 데이터를 불러오지 못했습니다/)
assert.match(client, /role="status" aria-live="polite"/, 'selected file names must be announced')
assert.match(client, /htmlFor="new-category-image"/)
assert.match(client, /htmlFor=\{`edit-category-image-\$\{cat\.id\}`\}/)
assert.match(client, /type=['"]file['"][\s\S]*accept=['"]image\/jpeg,image\/png,image\/webp['"]/, 'category image MIME boundary must stay unchanged')
for (const preservedDataBoundary of [
  'measurement_product_categories',
  'measurement_booking_settings',
  'measurement_date_overrides',
  'platform-category-images',
]) {
  assert.match(client, new RegExp(preservedDataBoundary), `${preservedDataBoundary} boundary must stay intact`)
}

assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\brgba?\s*\(/i, 'settings CSS must not introduce raw colors')
assert.match(css, /\.categoryActions\s*>\s*:last-child[\s\S]*grid-column:\s*1\s*\/\s*-1/, 'mobile actions must wrap safely')
for (const removedClass of [
  '.pageHeader',
  '.tabs',
  '.tabActive',
  '.section {',
  '.submitBtn',
  '.iconBtn',
  '.statusBadge',
  '.emptyText',
  '.loading',
  '.spinner',
  '.checkboxLabel',
  '.checkbox {',
]) {
  assert.equal(css.includes(removedClass), false, `shared primitive styling must replace ${removedClass}`)
}

console.log('admin settings primitive contract passed')
