import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const client = await readFile(new URL('../src/app/admin/platform/assets/ContentAssetsClient.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/app/admin/platform/assets/assets.module.css', import.meta.url), 'utf8')

for (const primitive of [
  'PlatformButton',
  'PlatformField',
  'PlatformIconButton',
  'PlatformPageHeader',
  'PlatformPanel',
  'PlatformSegmentedControl',
  'PlatformStatePanel',
  'PlatformStatusBadge',
]) {
  assert.match(client, new RegExp(`\\b${primitive}\\b`), `${primitive} must be used by the assets route`)
}

assert.doesNotMatch(client, /className=\{styles\.(?:primaryButton|secondaryButton|errorState|emptyState)\}/, 'shared control and state styles must not be reimplemented')
assert.doesNotMatch(styles, /\.(?:primaryButton|secondaryButton|errorState|emptyState)\s*\{/, 'duplicate primitive CSS must be removed')
assert.doesNotMatch(styles, /\.(?:uploadFields|detailForm|selectedPreviewBody)\s+(?:input|textarea)/, 'route CSS must not override shared field controls')
assert.doesNotMatch(styles, /#[0-9a-f]{3,8}|rgba?\(/i, 'route CSS must use semantic tokens instead of raw colors')
assert.match(client, /aria-pressed=\{isSelected\}/, 'asset selection must expose its pressed state')
assert.match(client, /role="status" aria-live="polite"/, 'asset detail save feedback must be announced')
assert.match(client, /autoFocus onClick=\{onClose\}/, 'mobile detail must receive focus when the list is hidden')
assert.match(client, /requestAnimationFrame\(\(\) => returnTarget\?\.focus\(\)\)/, 'closing mobile detail must restore card focus')
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/, 'asset route animation must respect reduced motion')
assert.match(styles, /content-visibility:\s*auto/, 'large asset collections should skip off-screen rendering work')

console.log('admin assets primitive contract passed')
