import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const component = await readFile(new URL('../src/components/admin/AdminRouteLoading.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/components/admin/AdminRouteLoading.module.css', import.meta.url), 'utf8')

assert.match(component, /PlatformPageHeader/, 'admin loading must reuse the shared page header')
assert.match(component, /role="status"/, 'admin loading must announce its current state')
assert.match(component, /aria-live="polite"/, 'admin loading announcement must be polite')
assert.match(component, /aria-hidden="true"/, 'decorative skeletons must be hidden from assistive technology')
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/, 'shimmer must stop for reduced motion')
assert.doesNotMatch(styles, /var\(--admin-|var\(--(?:space|radius|text|font)-|#[0-9a-f]{3,8}|rgba?\(/i, 'loading CSS must use v5 semantic tokens only')

console.log('admin loading standard contract passed')
