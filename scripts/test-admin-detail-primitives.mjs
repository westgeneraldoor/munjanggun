import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPrivateMediaProxyResponse } from '../src/lib/platform-private-media-proxy.mjs'

const detail = await readFile(new URL('../src/app/admin/platform/[id]/DetailClient.tsx', import.meta.url), 'utf8')
const detailPage = await readFile(new URL('../src/app/admin/platform/[id]/page.tsx', import.meta.url), 'utf8')
const mediaRoute = await readFile(new URL('../src/app/api/platform/measure/media-url/route.ts', import.meta.url), 'utf8')
const mediaFileRoute = await readFile(new URL('../src/app/api/platform/measure/media-file/route.ts', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/app/admin/platform/[id]/platform-detail.module.css', import.meta.url), 'utf8')
const select = await readFile(new URL('../src/components/platform/ui/PlatformSelect.tsx', import.meta.url), 'utf8').catch(() => '')
const selectStyles = await readFile(new URL('../src/components/platform/ui/PlatformSelect.module.css', import.meta.url), 'utf8').catch(() => '')
const fieldStyles = await readFile(new URL('../src/components/platform/ui/PlatformField.module.css', import.meta.url), 'utf8')
const fixture = await readFile(new URL('../src/app/test-fixtures/admin-detail/page.tsx', import.meta.url), 'utf8')
const tokenPolicy = await readFile(new URL('./ui-token-policy.config.mjs', import.meta.url), 'utf8')

for (const primitive of [
  'PlatformButton',
  'PlatformField',
  'PlatformLinkButton',
  'PlatformPageHeader',
  'PlatformPanel',
  'PlatformSelect',
  'PlatformStatePanel',
  'PlatformStatusBadge',
]) {
  assert.match(detail, new RegExp(`\\b${primitive}\\b`), `${primitive} must be used in the admin detail route`)
}

assert.match(detail, /initialCategoryMap/, 'detail fixture must be able to bypass live category lookup')
assert.match(detail, /formatKoreanDateTime/, 'detail timestamps must use a deterministic server/client formatter')
assert.doesNotMatch(detail, /toLocaleString/, 'detail timestamps must not depend on host locale formatting')
assert.match(detail, /value:\s*['"]contacted['"],\s*label:\s*['"]연락 완료['"]/, 'detail status options must preserve the API contacted state')
assert.match(detail, /await navigator\.clipboard\.writeText/, 'copy feedback must follow the clipboard result')
assert.match(detail, /copyError/, 'clipboard failures must expose inline feedback')
assert.match(detail, /mediaErrors/, 'private-media failures must expose a retryable inline state')
assert.match(detail, /aria-describedby=\{mediaErrors\[item\.id\]/, 'media retry controls must reference their inline error')
assert.match(detail, /media\.length === 0[\s\S]*tone="empty"/, 'detail must distinguish an empty private-media collection')
assert.match(detail, /refreshMediaUrl/, 'private-media links must provide an explicit refresh action')
assert.doesNotMatch(detail, /object_path/, 'private Storage paths must not enter the Client Component contract')
assert.doesNotMatch(detailPage, /select\([^)]*object_path/, 'private Storage paths must not enter the detail RSC payload')
assert.match(mediaRoute, /searchParams\.get\(['"]media_id['"]\)/, 'private media lookup must accept only an opaque media id')
assert.match(mediaRoute, /\.eq\(['"]id['"],\s*mediaId\)/, 'private media lookup must resolve the media server-side by id')
assert.doesNotMatch(mediaRoute, /searchParams\.get\(['"]object_path['"]\)/, 'private media lookup must reject client-supplied object paths')
assert.doesNotMatch(mediaRoute, /createSignedUrl|signedData\.signedUrl/, 'the URL response must not expose a Storage signed URL')
assert.match(mediaRoute, /\/api\/platform\/measure\/media-file\?media_id=/, 'the URL response must use the same-origin opaque proxy')
assert.match(mediaFileRoute, /createSignedUrl\(media\.object_path,\s*60\)/, 'the proxy may resolve and sign the private path on the server only')
assert.match(mediaFileRoute, /fetch\(signedData\.signedUrl/, 'the proxy must relay the private file without redirecting the browser')
assert.doesNotMatch(mediaFileRoute, /NextResponse\.redirect|location['"]?\s*:/i, 'the proxy must not redirect the browser to Storage')
assert.match(detail, /saveFeedback.*tone/s, 'save feedback must use explicit success and error state instead of message parsing')
assert.match(detail, /getElementById\(['"]btn-save-status['"]\)\?\.focus/, 'save completion must restore focus after the loading-disabled state')
assert.doesNotMatch(detail, /saveMsg\.includes/, 'save feedback tone must not depend on localized message text')
assert.doesNotMatch(detail, /className=\{styles\.(?:backBtn|copyBtn|copyAllBtn|mediaFetchBtn|saveBtn)\}/, 'detail actions must use shared button/link contracts')
assert.doesNotMatch(styles, /#[\da-f]{3,8}\b|rgba?\(/i, 'detail route styles must not contain raw colors')
assert.doesNotMatch(styles, /font-family:(?!\s*var\()/, 'detail route font families must use canonical tokens')
assert.doesNotMatch(selectStyles, /#[\da-f]{3,8}\b|rgba?\(/i, 'shared select styles must not contain raw colors')
assert.doesNotMatch(fieldStyles, /#[\da-f]{3,8}\b|rgba?\(|(?<![-\w])(?:-?\d*\.\d+|-?\d+)(?:px|rem|em)\b/i, 'shared field styles must use canonical tokens')
assert.match(select, /aria-invalid/, 'shared select must expose invalid state')
assert.match(select, /aria-describedby/, 'shared select must connect hint and error copy')
assert.match(select, /\[styles\.control,\s*className/, 'shared select must preserve caller control classes')
assert.match(select, /callerDescribedBy,\s*hintId,\s*errorId/, 'shared select must preserve caller accessibility descriptions')
assert.match(select, /error\s*\?\s*true\s*:\s*callerInvalid/, 'shared select must preserve caller invalid state')
assert.match(fixture, /process\.env\.NODE_ENV === 'production'/, 'detail fixture must be disabled in production')
assert.match(fixture, /notFound\(\)/, 'detail fixture must return a production 404')
assert.doesNotMatch(fixture, /object_path/, 'detail fixture must prove the client contract is path-opaque')

for (const governedFile of [
  'src/app/admin/platform/[id]/platform-detail.module.css',
  'src/components/platform/ui/PlatformSelect.module.css',
  'src/components/platform/ui/PlatformField.module.css',
]) {
  assert.ok(tokenPolicy.includes(governedFile), `${governedFile} must be governed by the UI token policy`)
}

const partial = buildPrivateMediaProxyResponse(new Response('a', {
  status: 206,
  headers: {
    'Accept-Ranges': 'bytes',
    'Content-Range': 'bytes 0-0/10',
    'Content-Type': 'image/jpeg',
  },
}), { fileName: "현장 사진 (1).jpg", mediaType: 'image' })
assert.equal(partial?.status, 206, 'the proxy must preserve a satisfiable Range response')
assert.equal(partial?.headers.get('content-range'), 'bytes 0-0/10')
assert.equal(partial?.headers.get('cache-control'), 'private, no-store, max-age=0')
assert.equal(partial?.headers.get('x-content-type-options'), 'nosniff')
assert.equal(partial?.headers.get('cross-origin-resource-policy'), 'same-origin')
assert.match(partial?.headers.get('content-disposition') ?? '', /^inline; filename\*=UTF-8''/)

const unsatisfied = buildPrivateMediaProxyResponse(new Response(null, {
  status: 416,
  headers: { 'Content-Length': '21', 'Content-Range': 'bytes */10', 'Content-Type': 'video/mp4' },
}), { fileName: 'field-video.mp4', mediaType: 'video' })
assert.equal(unsatisfied?.status, 416, 'the proxy must preserve an unsatisfiable Range response')
assert.equal(unsatisfied?.headers.get('content-range'), 'bytes */10')
assert.equal(unsatisfied?.headers.get('content-length'), null, 'an empty 416 relay must not retain the upstream error-body length')
assert.equal(await unsatisfied?.text(), '')

const unsafeType = buildPrivateMediaProxyResponse(new Response('x', {
  status: 200,
  headers: { 'Content-Type': 'text/html' },
}), { fileName: 'field-image.jpg', mediaType: 'image' })
assert.equal(unsafeType?.headers.get('content-type'), 'application/octet-stream')
assert.equal(buildPrivateMediaProxyResponse(new Response('missing', { status: 404 }), {
  fileName: 'missing.jpg',
  mediaType: 'image',
}), null, 'the proxy must not relay unexpected upstream errors')

console.log('admin detail primitive contract passed')
