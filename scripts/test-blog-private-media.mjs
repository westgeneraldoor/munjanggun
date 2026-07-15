import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const helperPath = new URL('../src/lib/content-os/blog-private-media.ts', import.meta.url)
const routePath = new URL('../src/app/admin/platform/blog/media/[mediaId]/route.ts', import.meta.url)
const editorPagePath = new URL('../src/app/admin/platform/blog/[id]/page.tsx', import.meta.url)
const renderingPath = new URL('../src/lib/content-os/blog-rendering.ts', import.meta.url)

async function readRequiredFile(url, label) {
  try {
    return await readFile(url, 'utf8')
  } catch (error) {
    throw new Error(`${label} does not exist: ${url.pathname}`, { cause: error })
  }
}

async function importTypeScriptModule(url) {
  const source = await readRequiredFile(url, 'private media helper')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: url.pathname,
  }).outputText

  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const {
  ALLOWED_BLOG_IMAGE_TYPES,
  normalizeBlogImageContentType,
  isAllowedBlogPrivateMediaUrl,
  blogPrivateMediaHeaders,
} = await importTypeScriptModule(helperPath)

assert.deepEqual(
  [...ALLOWED_BLOG_IMAGE_TYPES].sort(),
  ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'],
  'the MIME allowlist must remain explicit and image-only',
)

for (const contentType of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']) {
  assert.equal(normalizeBlogImageContentType(contentType), contentType)
}
assert.equal(normalizeBlogImageContentType(' Image/JPEG; charset=binary '), 'image/jpeg')
assert.equal(normalizeBlogImageContentType('application/octet-stream'), null)
assert.equal(normalizeBlogImageContentType('image/svg+xml'), null)
assert.equal(normalizeBlogImageContentType(null), null)

const allowedHostname = 'project-ref.supabase.co'
assert.equal(
  isAllowedBlogPrivateMediaUrl(
    'https://project-ref.supabase.co/storage/v1/object/public/blog-media/post/photo.webp?version=1',
    allowedHostname,
  ),
  true,
)

for (const value of [
  'not a url',
  'http://project-ref.supabase.co/storage/photo.webp',
  'https://project-ref.supabase.co.evil.example/storage/photo.webp',
  'https://evil.example/storage/photo.webp',
  'https://project-ref.supabase.co:8443/storage/photo.webp',
  'https://user:pass@project-ref.supabase.co/storage/photo.webp',
  'https://project-ref.supabase.co/storage/v1/object/sign/blog-media-private/photo.webp?token=opaque',
  'https://project-ref.supabase.co/storage/v1/object/public/content-assets-public/photo.webp',
  'https://project-ref.supabase.co/storage/v1/object/public/blog-media/',
]) {
  assert.equal(isAllowedBlogPrivateMediaUrl(value, allowedHostname), false, value)
}

for (const [value, hostname] of [
  ['https://127.0.0.1/photo.png', '127.0.0.1'],
  ['https://10.0.0.8/photo.png', '10.0.0.8'],
  ['https://172.16.0.8/photo.png', '172.16.0.8'],
  ['https://192.168.0.8/photo.png', '192.168.0.8'],
  ['https://[::1]/photo.png', '[::1]'],
]) {
  assert.equal(isAllowedBlogPrivateMediaUrl(value, hostname), false, value)
}

assert.deepEqual(blogPrivateMediaHeaders('image/webp'), {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Disposition': 'inline',
  'Content-Type': 'image/webp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
})

const [routeSource, editorPageSource, renderingSource] = await Promise.all([
  readRequiredFile(routePath, 'private media route'),
  readRequiredFile(editorPagePath, 'blog editor page'),
  readRequiredFile(renderingPath, 'blog rendering adapter'),
])

assert.match(routeSource, /RouteContext<'\/admin\/platform\/blog\/media\/\[mediaId\]'>/)
assert.match(routeSource, /await\s+context\.params/)
const uuidPatternLiteral = routeSource.match(/const UUID_PATTERN = (\/\^.*\/[a-z]*)/i)?.[1]
assert.ok(uuidPatternLiteral, 'the route must define an explicit UUID pattern')
const uuidPattern = Function(`"use strict"; return (${uuidPatternLiteral})`)()
assert.equal(uuidPattern.test('0f8fad5b-d9cb-469f-a165-70867728950e'), true)
for (const invalidId of ['', 'not-a-uuid', '../secret', '0f8fad5b-d9cb-469f-a165-70867728950e/extra']) {
  assert.equal(uuidPattern.test(invalidId), false, invalidId)
}
assert.match(routeSource, /if \(!UUID_PATTERN\.test\(mediaId\)\) return rejectedResponse\(\)/)
assert.match(routeSource, /auth\.getUser\(\)/)
assert.match(routeSource, /role\s*!==\s*['"]administrator['"]/)
assert.match(routeSource, /normalizeBlogImageContentType/)
assert.match(routeSource, /isAllowedBlogPrivateMediaUrl/)
assert.match(routeSource, /blogPrivateMediaHeaders/)
assert.match(
  routeSource,
  /new Set\(\[\s*['"]blog-media-private['"],\s*['"]content-assets-private['"],?\s*\]\)/,
  'service-role downloads must be limited to the two legitimate private buckets',
)
assert.match(routeSource, /ALLOWED_PRIVATE_BUCKETS\.has\(bucket\)/)
assert.match(
  routeSource,
  /isAllowedPrivateStorageSource\(media\.private_bucket, media\.private_object_path\)/,
)
assert.match(routeSource, /media\.private_bucket !== null \|\| media\.private_object_path !== null/)
assert.match(routeSource, /AbortSignal\.timeout\(PRIVATE_MEDIA_FETCH_TIMEOUT_MS\)/)
assert.match(
  routeSource,
  /\.download\(\s*media\.private_object_path,\s*\{\},\s*\{\s*signal:\s*AbortSignal\.timeout\(PRIVATE_MEDIA_FETCH_TIMEOUT_MS\),?\s*\},?\s*\)/,
  'Storage download must receive the bounded abort signal as its third argument',
)
assert.match(routeSource, /redirect:\s*['"]manual['"]/)
assert.match(routeSource, /status:\s*404/)
assert.doesNotMatch(routeSource, /Response\.json/)

const pathValidatorSource = routeSource.match(/function isAllowedPrivateObjectPath\([\s\S]*?\n\}/)?.[0]
assert.ok(pathValidatorSource, 'the route must define a private object path validator')
const storageValidatorSource = routeSource.match(/function isAllowedPrivateStorageSource\([\s\S]*?\n\}/)?.[0]
assert.ok(storageValidatorSource, 'the route must define a private bucket and path validator')
const pathValidatorOutput = ts.transpileModule(
  `const ALLOWED_PRIVATE_BUCKETS = new Set(['blog-media-private', 'content-assets-private'])\n${pathValidatorSource}\n${storageValidatorSource}\nexport { isAllowedPrivateObjectPath, isAllowedPrivateStorageSource }`,
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText
const { isAllowedPrivateObjectPath, isAllowedPrivateStorageSource } = await import(
  `data:text/javascript;base64,${Buffer.from(pathValidatorOutput).toString('base64')}`
)
for (const bucket of ['blog-media-private', 'content-assets-private']) {
  assert.equal(isAllowedPrivateStorageSource(bucket, 'post/media/photo.webp'), true, bucket)
}
for (const [bucket, objectPath] of [
  ['arbitrary-private', 'post/media/photo.webp'],
  ['blog-media', 'post/media/photo.webp'],
  ['blog-media-private', '../secret'],
  ['content-assets-private', ''],
]) {
  assert.equal(isAllowedPrivateStorageSource(bucket, objectPath), false, `${bucket}:${objectPath}`)
}
for (const validPath of ['post-id/media-id/photo.webp', 'folder/사진 01.jpg']) {
  assert.equal(isAllowedPrivateObjectPath(validPath), true, validPath)
}
for (const invalidPath of [
  '',
  '/absolute/photo.webp',
  '\\absolute\\photo.webp',
  'folder\\photo.webp',
  './photo.webp',
  '../photo.webp',
  'folder/../photo.webp',
  'folder/%2e%2e/photo.webp',
  'folder/%2Fabsolute.webp',
  'folder/%5csecret.webp',
  'folder/./photo.webp',
  'folder//photo.webp',
  'folder/photo.webp?download=1',
  'folder/photo.webp#fragment',
  'folder/photo\u0000.webp',
  'folder/photo\n.webp',
]) {
  assert.equal(isAllowedPrivateObjectPath(invalidPath), false, JSON.stringify(invalidPath))
}

for (const [label, source] of [
  ['blog editor page', editorPageSource],
  ['blog rendering adapter', renderingSource],
]) {
  assert.match(source, /\/admin\/platform\/blog\/media\//, `${label} must use the same-origin opaque media route`)
  assert.doesNotMatch(source, /createSignedUrl/, `${label} must not create signed URLs`)
  assert.doesNotMatch(source, /signedUrl/, `${label} must not serialize signed URLs`)
}

assert.match(editorPageSource, /publicUrl:\s*null/, 'the editor must not serialize raw public media URLs')
assert.doesNotMatch(editorPageSource, /publicUrl:\s*item\.public_url/)
assert.match(editorPageSource, /signedPreviewUrl:\s*`\/admin\/platform\/blog\/media\/\$\{item\.id\}`/)
assert.match(renderingSource, /const url = `\/admin\/platform\/blog\/media\/\$\{media\.id\}`/)
const previewSelectSource = renderingSource.match(/const PREVIEW_MEDIA_SELECT = \[[\s\S]*?\]\.join/)?.[0] ?? ''
assert.doesNotMatch(previewSelectSource, /private_bucket|private_object_path|public_url/)
assert.doesNotMatch(renderingSource, /privateObjectPath\s*:/, 'render data must not serialize storage paths')
assert.doesNotMatch(renderingSource, /privateBucket\s*:/, 'render data must not serialize storage buckets')

console.log('blog private media contract passed')
