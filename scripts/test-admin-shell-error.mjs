import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function source(url) {
  try {
    return await readFile(url, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return ''
    throw error
  }
}

const [layoutCss, sidebarCss, sidebar, adminError, adminErrorCss, tokenPolicy] = await Promise.all([
  source(new URL('../src/app/admin/layout.module.css', import.meta.url)),
  source(new URL('../src/components/admin/AdminSidebar.module.css', import.meta.url)),
  source(new URL('../src/components/admin/AdminSidebar.tsx', import.meta.url)),
  source(new URL('../src/app/admin/error.tsx', import.meta.url)),
  source(new URL('../src/app/admin/error.module.css', import.meta.url)),
  source(new URL('./ui-token-policy.config.mjs', import.meta.url)),
])

assert.match(layoutCss, /\.main:only-child\s*\{[^}]*padding:\s*0/s, 'login main must remove the absent mobile-header offset')
assert.match(layoutCss, /@media \(min-width: 1024px\)[\s\S]*?\.main:only-child\s*\{[^}]*margin-left:\s*0/s, 'login main must remove the absent desktop sidebar offset')
assert.match(layoutCss, /--admin-route-block-inset:/, 'admin main must expose its real block inset to route states')
assert.match(layoutCss, /\.main:only-child\s*\{[^}]*--admin-route-block-inset:\s*0/s, 'login route state must not subtract an absent shell inset')
assert.match(sidebarCss, /background-color:\s*var\(--mg-overlay-scrim\)/, 'mobile sidebar overlay must use the canonical scrim token')
assert.doesNotMatch(sidebarCss, /#[\da-f]{3,8}\b|rgba?\(/i, 'admin sidebar must not contain raw colors')
assert.match(sidebar, /if \(!isOpen\) return[\s\S]*requestAnimationFrame\(\(\) => \{\s*focusFrame = requestAnimationFrame\(\(\) => closeButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)\)/, 'mobile sidebar must focus its visible close control after the open state paints')
assert.match(sidebar, /cancelAnimationFrame\(focusFrame\)/, 'mobile sidebar must cancel a stale focus frame')
assert.match(sidebar, /const openSidebar = \(\) => \{\s*setIsOpen\(true\)\s*\}/, 'mobile sidebar open handler must leave post-commit focus to its effect')

assert.match(adminError, /^['"]use client['"]/m, 'admin error boundary must be a client component')
assert.match(adminError, /PlatformStatePanel/, 'admin error boundary must use the shared state contract')
assert.match(adminError, /tone=["']error["']/, 'admin error boundary must expose an assertive error state')
assert.match(adminError, /PlatformButton/, 'admin error boundary retry must use the shared button')
assert.match(adminError, /onClick=\{unstable_retry\}/, 'admin error boundary must invoke the Next 16 retry callback')
assert.match(adminError, /console\.error\(['"]Admin route error:/, 'admin error boundary must preserve diagnostic logging')
assert.match(adminError, /digest:\s*error\.digest/, 'admin error logging must retain the safe server correlation digest')
assert.doesNotMatch(adminError, /console\.error\(['"]Admin route error:['"],\s*error\)/, 'admin error logging must not expose the full client error object')
assert.match(adminErrorCss, /min-height:\s*calc\(100dvh - var\(--admin-route-block-inset\)\)/, 'admin error state must center within the actual shell content box')
assert.doesNotMatch(adminErrorCss, /#[\da-f]{3,8}\b|rgba?\(|(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/i, 'admin error state must use canonical tokens')
assert.match(tokenPolicy, /['"]--admin-route-block-inset['"]/, 'admin error state must declare its inherited cross-file inset contract')

for (const governedFile of [
  'src/app/admin/layout.module.css',
  'src/app/admin/error.module.css',
  'src/components/admin/AdminSidebar.module.css',
]) {
  assert.match(tokenPolicy, new RegExp(governedFile.replaceAll('/', '\\/').replaceAll('.', '\\.')), `${governedFile} must be governed by the UI token policy`)
}

console.log('admin shell and error contract passed')
