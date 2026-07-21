import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const queue = await readFile(new URL('../src/app/admin/platform/AdminQueueClient.tsx', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/app/admin/platform/platform-admin.module.css', import.meta.url), 'utf8')

assert.match(queue, /\bPlatformTable\b/, 'unified queue must use the shared table primitive')
assert.match(queue, /\bPlatformList\b/, 'unified queue must use the shared list primitive')
assert.match(queue, /<PlatformTable[\s\S]*aria-label="통합 접수 목록"/, 'desktop queue must name its native table')
assert.match(queue, /<PlatformList[\s\S]*aria-label="통합 접수 모바일 목록"/, 'mobile queue must name its native list')
assert.doesNotMatch(queue, /<table\b|<ul\b/, 'unified queue must not duplicate native table or list wrappers')
assert.doesNotMatch(styles, /\.(?:tableWrap|table)\b/, 'route styles must not duplicate shared table surface and cell styles')
assert.match(styles, /\.desktopTable\s*\{[\s\S]*?display:\s*none/, 'desktop table must stay hidden below the route breakpoint')
assert.match(styles, /@media\s*\(min-width:\s*900px\)[\s\S]*?\.desktopTable\s*\{[\s\S]*?display:\s*block/, 'desktop table must reappear at 900px')
assert.match(styles, /@media\s*\(min-width:\s*900px\)[\s\S]*?\.mobileList\s*\{[\s\S]*?display:\s*none/, 'mobile list must hide at the desktop breakpoint')
assert.match(styles, /@media\s*\(max-width:\s*1179px\)[\s\S]*?\.mobileDetailScreen\s*\{[\s\S]*?display:\s*block/, 'single-detail view must remain available below the split-pane breakpoint')

console.log('admin unified list primitive contract passed')
