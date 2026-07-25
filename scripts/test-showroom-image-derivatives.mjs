import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const root = process.cwd()
const read = relativePath => readFile(path.join(root, relativePath), 'utf8')

const derivativeModule = await import('../src/lib/showroom/showroom-image-derivatives.mjs')
const {
  SHOWROOM_IMAGE_RECIPE_VERSION,
  SHOWROOM_IMAGE_VARIANT_SPECS,
  buildShowroomDerivativeObjectPath,
  transformShowroomImage,
} = derivativeModule
const {
  createShowroomBackfillEstimate,
  shouldProcessShowroomBackfillState,
  showroomBackfillStateComplete,
} = await import('../src/lib/showroom/showroom-image-backfill-estimate.mjs')

assert.equal(SHOWROOM_IMAGE_RECIPE_VERSION, 1)
assert.deepEqual(
  SHOWROOM_IMAGE_VARIANT_SPECS,
  {
    thumbnail: { width: 192, quality: 76 },
    card: { width: 960, quality: 80 },
    display: { width: 1600, quality: 84 },
    large: { width: 2560, quality: 86 },
  },
  'the four variants must preserve the canonical measured widths and WebP qualities',
)

const source = await sharp({
  create: {
    width: 3000,
    height: 1800,
    channels: 3,
    background: { r: 121, g: 83, b: 57 },
  },
}).png().toBuffer()
const transformed = await transformShowroomImage(source, 'image/png')
const repeatedTransform = await transformShowroomImage(source, 'image/png')

assert.deepEqual(transformed.original.buffer, source, 'the original bytes must be preserved exactly')
assert.equal(transformed.original.width, 3000)
assert.equal(transformed.original.height, 1800)
assert.equal(transformed.variants.thumbnail.status, 'ready')
assert.equal(transformed.variants.thumbnail.width, 192)
assert.equal(transformed.variants.card.status, 'ready')
assert.equal(transformed.variants.card.width, 960)
assert.equal(transformed.variants.display.status, 'ready')
assert.equal(transformed.variants.display.width, 1600)
assert.equal(transformed.variants.large.status, 'ready')
assert.equal(transformed.variants.large.width, 2560)

for (const variant of Object.values(transformed.variants)) {
  if (variant.status !== 'ready') continue
  assert.equal(variant.mimeType, 'image/webp')
  assert.ok(variant.sizeBytes > 0)
  assert.ok(variant.width <= 3000)
  assert.ok(variant.height <= 1800)
}
assert.deepEqual(
  Object.fromEntries(Object.entries(repeatedTransform.variants).map(([variant, result]) => [
    variant,
    result.checksumSha256,
  ])),
  Object.fromEntries(Object.entries(transformed.variants).map(([variant, result]) => [
    variant,
    result.checksumSha256,
  ])),
  'the same source and recipe must produce identical derivative identities',
)

const tiny = await sharp({
  create: {
    width: 100,
    height: 50,
    channels: 3,
    background: { r: 20, g: 30, b: 40 },
  },
}).jpeg().toBuffer()
const tinyResult = await transformShowroomImage(tiny, 'image/jpeg')
assert.ok(
  Object.values(tinyResult.variants).every(variant => variant.status === 'skipped' && variant.skipReason === 'no-upscale'),
  'very small images must fall back to the original instead of creating redundant upscaled objects',
)

const exifRotated = await sharp({
  create: {
    width: 600,
    height: 1200,
    channels: 3,
    background: { r: 80, g: 90, b: 100 },
  },
})
  .jpeg()
  .withMetadata({ orientation: 6 })
  .toBuffer()
const exifResult = await transformShowroomImage(exifRotated, 'image/jpeg')
assert.equal(exifResult.original.width, 1200, 'source width must reflect EXIF auto-orientation')
assert.equal(exifResult.original.height, 600, 'source height must reflect EXIF auto-orientation')
assert.equal(exifResult.variants.card.status, 'ready')
assert.equal(exifResult.variants.card.width, 960)

const gif = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64',
)
const gifResult = await transformShowroomImage(gif, 'image/gif')
assert.deepEqual(gifResult.original.buffer, gif)
assert.ok(
  Object.values(gifResult.variants).every(variant => variant.status === 'skipped' && variant.skipReason === 'animated-or-gif'),
  'GIF bytes and animation policy must use the original directly',
)

const hash = 'a'.repeat(64)
assert.equal(
  buildShowroomDerivativeObjectPath(hash, 'card'),
  `showroom-derivatives/v${SHOWROOM_IMAGE_RECIPE_VERSION}/${hash}/card.webp`,
  'derivative paths must be deterministic and immutable per recipe',
)

const duplicateReady = {
  status: 'ready',
  sizeBytes: 100,
}
const estimate = createShowroomBackfillEstimate([
  buildShowroomDerivativeObjectPath(hash, 'thumbnail'),
])
const estimateTransform = {
  original: { sizeBytes: 1_000, checksumSha256: hash },
  variants: {
    thumbnail: duplicateReady,
    card: { status: 'skipped' },
    display: { status: 'skipped' },
    large: { status: 'skipped' },
  },
}
estimate.add(estimateTransform, new Map([
  ['thumbnail', {
    status: 'ready',
    derivativeObjectPath: buildShowroomDerivativeObjectPath(hash, 'thumbnail'),
    sizeBytes: 100,
  }],
  ['card', { status: 'skipped' }],
]))
estimate.add(estimateTransform, new Map())
const estimateSummary = estimate.snapshot()
assert.equal(estimateSummary.sourceCount, 2)
assert.equal(estimateSummary.sourceBytes, 2_000)
assert.equal(estimateSummary.sourceAverageBytes, 1_000)
assert.equal(estimateSummary.sourceMaxBytes, 1_000)
assert.equal(estimateSummary.readyDerivativeRecords, 2)
assert.equal(estimateSummary.outputDerivativeFiles, 1)
assert.equal(estimateSummary.outputDerivativeBytes, 100)
assert.equal(estimateSummary.newDerivativeFiles, 0)
assert.equal(estimateSummary.newDerivativeBytes, 0)
assert.equal(estimateSummary.newDerivativeRecords, 6)
assert.equal(estimateSummary.pendingVariantWrites, 6)
assert.equal(estimateSummary.variants.thumbnail.readyRecords, 2)
assert.equal(estimateSummary.variants.thumbnail.uniqueFiles, 1)
assert.equal(estimateSummary.variants.thumbnail.newUniqueFiles, 0)
assert.equal(estimateSummary.variants.thumbnail.selectedRecords, 2)
assert.equal(estimateSummary.variants.thumbnail.originalFallbackRecords, 0)
assert.equal(estimateSummary.variants.thumbnail.selectedBytes, 200)
assert.equal(estimateSummary.variants.thumbnail.selectedAverageBytes, 100)
assert.equal(estimateSummary.variants.thumbnail.selectedMaxBytes, 100)
assert.equal(estimateSummary.variants.card.originalFallbackRecords, 2)
assert.equal(estimateSummary.variants.card.selectedBytes, 2_000)
assert.equal(estimateSummary.variants.card.selectedAverageBytes, 1_000)
assert.equal(estimateSummary.variants.card.selectedMaxBytes, 1_000)

const completeStates = new Map([
  ['thumbnail', { status: 'ready' }],
  ['card', { status: 'ready' }],
  ['display', { status: 'skipped' }],
  ['large', { status: 'skipped' }],
])
assert.equal(showroomBackfillStateComplete(completeStates), true)
assert.equal(shouldProcessShowroomBackfillState(completeStates), false)
assert.equal(
  shouldProcessShowroomBackfillState(completeStates, { metadataRefreshRequired: true }),
  true,
  'a canonical source URL change must refresh metadata even when all variants are complete',
)
const failedStates = new Map([['thumbnail', { status: 'failed' }]])
assert.equal(shouldProcessShowroomBackfillState(failedStates), false)
assert.equal(shouldProcessShowroomBackfillState(failedStates, { retryFailed: true }), true)

await assert.rejects(
  () => transformShowroomImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'),
  /Unsupported image MIME type/,
  'SVG must stay outside the raster upload contract',
)

const migrations = await readdir(path.join(root, 'supabase/migrations'))
const migrationName = migrations.find(name => name.includes('showroom_image_derivatives'))
assert.ok(migrationName, 'a showroom image derivative migration must exist')
const migration = await read(`supabase/migrations/${migrationName}`)

assert.match(migration, /CREATE TABLE\s+showroom\.image_sources/i)
assert.match(migration, /CREATE TABLE\s+showroom\.image_derivatives/i)
assert.match(migration, /CHECK\s*\(\s*variant\s+IN\s*\(\s*'thumbnail',\s*'card',\s*'display',\s*'large'\s*\)\s*\)/i)
assert.match(migration, /CHECK\s*\(\s*transform_status\s+IN\s*\(\s*'ready',\s*'skipped',\s*'failed'\s*\)\s*\)/i)
assert.match(migration, /UNIQUE\s*\(\s*source_bucket,\s*source_object_path\s*\)/i)
assert.match(migration, /UNIQUE\s*\(\s*source_id,\s*variant,\s*recipe_version\s*\)/i)
assert.match(
  migration,
  /recipe_version\s*<>\s*1[\s\S]*variant\s*=\s*'thumbnail'\s+AND\s+target_width\s*=\s*192[\s\S]*variant\s*=\s*'card'\s+AND\s+target_width\s*=\s*960[\s\S]*variant\s*=\s*'display'\s+AND\s+target_width\s*=\s*1600[\s\S]*variant\s*=\s*'large'\s+AND\s+target_width\s*=\s*2560/i,
  'recipe version 1 must enforce the canonical target width for every variant in the database',
)
assert.match(
  migration,
  /v_recipe_version\s*=\s*1[\s\S]*v_target_width\s*<>\s*\(\s*CASE\s+v_variant[\s\S]*WHEN\s+'thumbnail'\s+THEN\s+192[\s\S]*WHEN\s+'card'\s+THEN\s+960[\s\S]*WHEN\s+'display'\s+THEN\s+1600[\s\S]*WHEN\s+'large'\s+THEN\s+2560[\s\S]*RAISE EXCEPTION[\s\S]*recipe version 1 target width mismatch/i,
  'the commit RPC must reject a noncanonical recipe version 1 variant/target-width payload',
)
assert.match(
  migration,
  /shared transformer WebP quality contract is thumbnail=76, card=80, display=84, and large=86/i,
  'the recipe version 1 WebP quality contract must stay documented without inventing a database quality column',
)
assert.doesNotMatch(
  migration,
  /UNIQUE\s*\(\s*derivative_bucket,\s*derivative_object_path\s*\)/i,
  'different source rows with identical bytes must be allowed to share one immutable derivative object',
)
assert.match(migration, /public_url\s+IS NOT NULL[\s\S]*mime_type\s+IS NOT NULL/i)
assert.match(migration, /skip_reason\s+IS NOT NULL[\s\S]*skip_reason\s+IN\s*\(/i)
assert.match(migration, /transform_error\s+IS NOT NULL[\s\S]*length\s*\(\s*btrim\s*\(\s*transform_error\s*\)\s*\)\s*>\s*0/i)
assert.match(migration, /ENABLE ROW LEVEL SECURITY/i)
assert.match(migration, /platform_private\.is_admin/i)
assert.match(migration, /private\.is_node_visible/i)
assert.match(migration, /resolve_preview_image_derivatives[\s\S]*derivative\.recipe_version\s*=\s*1/i)
assert.match(migration, /GRANT SELECT[\s\S]*TO anon/i)
assert.match(migration, /GRANT SELECT[\s\S]*TO authenticated/i)
assert.doesNotMatch(migration, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[\s\S]*TO anon/i)

const uploader = await read('src/components/admin/ImageUploader.tsx')
const uploadAction = await read('src/app/admin/nodes/image-actions.ts')
assert.doesNotMatch(uploader, /\.storage\s*\.\s*from\(/, 'the browser must not upload showroom originals directly')
assert.match(uploadAction, /requireAdministrator/)
assert.match(uploadAction, /createAdminClient/)
assert.match(uploadAction, /upsert:\s*false/)
assert.match(uploadAction, /transformShowroomImage/)
assert.match(uploadAction, /isAlreadyExistsError/)
assert.match(uploadAction, /\.download\(params\.path\)/)
assert.match(uploadAction, /existingChecksum\s*!==\s*params\.checksumSha256/)
assert.match(uploadAction, /commit_image_derivatives/)

const backfill = await read('scripts/backfill-showroom-image-derivatives.mjs')
assert.match(backfill, /dryRun:\s*true/)
assert.match(backfill, /--apply/)
assert.match(backfill, /--retry-failed/)
assert.match(backfill, /SUPABASE_PROJECT_REF/)
assert.match(backfill, /options\.confirmProject\s*!==\s*projectRef/)
assert.match(backfill, /PRODUCTION_PROJECT_REF/)
assert.match(backfill, /production[\s\S]{0,160}(?:refus|prohibit|block)/i)
assert.match(backfill, /downloadAndTransform/)
assert.match(backfill, /estimatedReadyDerivativeRecords/)
assert.match(backfill, /estimatedOutputDerivativeFiles/)
assert.match(backfill, /estimatedOutputDerivativeBytes/)
assert.match(backfill, /estimatedNewDerivativeFiles/)
assert.match(backfill, /estimatedNewDerivativeBytes/)
assert.match(backfill, /estimatedSourceAverageBytes/)
assert.match(backfill, /estimatedVariants/)
assert.match(backfill, /if\s*\(identities\.length\s*===\s*0\)/)
assert.match(backfill, /sourceIdentitySha256/)
assert.match(
  backfill,
  /if\s*\(options\.dryRun\)[\s\S]*estimate\.add[\s\S]*\}\s*else\s*\{[\s\S]*processSource/,
  'dry-run estimation and apply mutations must stay in separate execution branches',
)
assert.match(backfill, /retry\s*\(\s*async\s*\(\)\s*=>\s*\{[\s\S]*commit_image_derivatives/)
assert.doesNotMatch(backfill, /\.remove\(/, 'backfill must never delete originals or derivatives')

const scopedRenderers = [
  'src/components/customer/NodeCard.tsx',
  'src/components/customer/NodeGallery.tsx',
  'src/components/customer/ImageLightbox.tsx',
  'src/components/customer/HomeHeroV2.tsx',
  'src/components/customer/NodeHero.tsx',
  'src/app/[...slugs]/page.tsx',
  'src/app/preview/[token]/page.tsx',
  'src/components/admin/NodeList.tsx',
]
for (const file of scopedRenderers) {
  const sourceText = await read(file)
  assert.doesNotMatch(sourceText, /from ['"]next\/image['"]/, `${file} must use the shared showroom image renderer`)
  assert.doesNotMatch(sourceText, /\/_(?:next|vercel)\/image/, `${file} must not construct optimizer URLs`)
}

const showroomImage = await read('src/components/showroom/ShowroomImage.tsx')
assert.match(showroomImage, /from ['"]next\/image['"]/)
assert.match(showroomImage, /unoptimized/)
assert.match(showroomImage, /fallback/i)

console.log('Showroom stored-image derivative contract passed.')
