import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import sharp from 'sharp'

import {
  CONTENT_ASSET_ALLOWED_IMAGE_TYPES,
  MAX_CONTENT_ASSET_GIF_BYTES,
  createStaticContentAssetDerivatives,
  inspectContentAssetImage,
} from '../src/lib/content-assets/content-asset-validation.mjs'
import {
  CentralAssetValidationError,
  isCentralAssetPubliclyEligible,
  loadOfficialBrandAsset,
} from '../src/lib/content-assets/official-brand-asset.mjs'
import { centralBrandPublicationBlocker } from '../src/lib/content-assets/official-brand-publication.mjs'
import { mergeContentAssetLabelsWithTags } from '../src/lib/content-assets/content-asset-labels.mjs'
import { prepareBlogMediaForPublication } from '../src/lib/content-os/blog-media-publication.mjs'

const actionsPath = new URL('../src/app/admin/platform/blog/[id]/actions.ts', import.meta.url)
const migrationPath = new URL('../supabase/migrations/20260715090227_official_asset_gif_support.sql', import.meta.url)
const hardeningMigrationPath = new URL('../supabase/migrations/20260715233310_official_asset_provenance_hardening.sql', import.meta.url)
const privateDerivativeMigrationPath = new URL('../supabase/migrations/20260715235109_private_candidate_derivatives.sql', import.meta.url)
const privateDerivativeFixMigrationPath = new URL('../supabase/migrations/20260715235349_fix_private_derivative_rpc_role_cast.sql', import.meta.url)
const crashSafeDerivativeCleanupMigrationPath = new URL('../supabase/migrations/20260720084910_crash_safe_private_derivative_cleanup.sql', import.meta.url)
const atomicPlacementMigrationPath = new URL('../supabase/migrations/20260720005052_atomic_official_asset_blog_placement.sql', import.meta.url)
const commandPath = new URL('./register-official-brand-asset.mjs', import.meta.url)
const rendererPath = new URL('../src/components/blog/BlogPostRenderer.tsx', import.meta.url)
const assetClientPath = new URL('../src/app/admin/platform/assets/ContentAssetsClient.tsx', import.meta.url)
const assetActionsPath = new URL('../src/app/admin/platform/assets/actions.ts', import.meta.url)
const blogEditorClientPath = new URL('../src/app/admin/platform/blog/[id]/BlogEditorClient.tsx', import.meta.url)

const tinyGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')
const gifHash = createHash('sha256').update(tinyGif).digest('hex')

assert.deepEqual(
  [...CONTENT_ASSET_ALLOWED_IMAGE_TYPES].sort(),
  ['image/gif', 'image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp'],
)
assert.equal(MAX_CONTENT_ASSET_GIF_BYTES, 20 * 1024 * 1024)

assert.equal(centralBrandPublicationBlocker({
  centralBrand: {
    privacyStatus: 'official_reviewed',
    usageStatus: 'candidate',
    claimRisk: 'low',
    externalPublish: 'allowed_after_context_check',
  },
}), null)
assert.match(centralBrandPublicationBlocker({
  centralBrand: {
    privacyStatus: 'official_reviewed',
    usageStatus: 'approved',
    claimRisk: 'high',
    externalPublish: 'requires_claim_freshness_check',
  },
}), /claim risk/i)
assert.equal(centralBrandPublicationBlocker({
  centralBrand: {
    privacyStatus: 'official_reviewed',
    usageStatus: 'approved',
    claimRisk: 'low',
    externalPublish: 'allowed_after_context_check',
  },
}), null)

const preservedLabels = mergeContentAssetLabelsWithTags({
  tags: ['old'],
  centralBrand: { assetId: 'mg-basic-001', sha256: gifHash, usageStatus: 'candidate' },
}, ['new'])
assert.deepEqual(preservedLabels, {
  tags: ['new'],
  centralBrand: { assetId: 'mg-basic-001', sha256: gifHash, usageStatus: 'candidate' },
})

const gifInspection = await inspectContentAssetImage(tinyGif, 'image/gif')
assert.equal(gifInspection.mimeType, 'image/gif')
assert.equal(gifInspection.width, 1)
assert.equal(gifInspection.height, 1)
assert.equal(gifInspection.checksumSha256, gifHash)

const gifDerivatives = await createStaticContentAssetDerivatives(tinyGif)
for (const derivative of [gifDerivatives.web, gifDerivatives.thumbnail]) {
  const metadata = await sharp(derivative.buffer).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.pages ?? 1, 1, 'GIF poster and thumbnail derivatives must remain static')
}

await assert.rejects(
  () => inspectContentAssetImage(tinyGif, 'image/png'),
  /declared MIME type does not match/i,
)
await assert.rejects(
  () => inspectContentAssetImage(Buffer.from('version https://git-lfs.github.com/spec/v1\n'), 'image/gif'),
  /Git LFS pointer/i,
)

const workRoot = await mkdtemp(path.join(tmpdir(), 'official-brand-asset-'))
try {
  const assetDirectory = path.join(workRoot, 'products', 'basic')
  await mkdir(assetDirectory, { recursive: true })
  await writeFile(path.join(assetDirectory, 'motion.gif'), tinyGif)

  const manifest = {
    schema: 'munjanggun.productDetailAssets.v1',
    version: '1.0',
    productId: 'PROD-BASIC',
    sourceId: 'SRC-BASIC',
    proofId: 'PROOF-BASIC',
    assets: [{
      assetId: 'mg-basic-motion-001',
      productId: 'PROD-BASIC',
      sourceId: 'SRC-BASIC',
      proofId: 'PROOF-BASIC',
      product: 'basic',
      repositoryPath: 'products/basic/motion.gif',
      fileName: 'motion.gif',
      extension: '.gif',
      byteSize: tinyGif.byteLength,
      width: 1,
      height: 1,
      gifFrameCount: 1,
      sha256: gifHash,
      usageStatus: 'candidate',
      privacyStatus: 'official_reviewed',
      claimRisk: 'high',
      externalPublish: 'requires_claim_freshness_check',
      notes: 'fixture',
    }],
  }
  await writeFile(
    path.join(workRoot, 'products', 'asset-manifest.json'),
    `\uFEFF${JSON.stringify(manifest, null, 2)}`,
    'utf8',
  )

  const loaded = await loadOfficialBrandAsset({
    brandRoot: workRoot,
    assetId: 'mg-basic-motion-001',
    centralCommit: '0123456789abcdef0123456789abcdef01234567',
  })

  assert.equal(loaded.assetId, 'mg-basic-motion-001')
  assert.equal(loaded.absolutePath, path.join(assetDirectory, 'motion.gif'))
  assert.equal(loaded.inspection.checksumSha256, gifHash)
  assert.deepEqual(loaded.manifestIdentity, {
    schema: 'munjanggun.productDetailAssets.v1',
    version: '1.0',
    productId: 'PROD-BASIC',
    sourceId: 'SRC-BASIC',
    proofId: 'PROOF-BASIC',
  })
  assert.equal(loaded.privacyStatus, 'official_reviewed')
  assert.equal(loaded.requiresClaimReview, true)
  assert.equal(isCentralAssetPubliclyEligible(loaded), false)

  manifest.assets[0].repositoryPath = '../outside.gif'
  await writeFile(
    path.join(workRoot, 'products', 'asset-manifest.json'),
    JSON.stringify(manifest),
    'utf8',
  )
  await assert.rejects(
    () => loadOfficialBrandAsset({
      brandRoot: workRoot,
      assetId: 'mg-basic-motion-001',
      centralCommit: '0123456789abcdef0123456789abcdef01234567',
    }),
    error => error instanceof CentralAssetValidationError && /path/i.test(error.message),
  )
} finally {
  await rm(workRoot, { recursive: true, force: true })
}

const preparedGif = await prepareBlogMediaForPublication(tinyGif, 'image/gif')
assert.equal(preparedGif.contentType, 'image/gif')
assert.equal(preparedGif.extension, 'gif')
assert.equal(preparedGif.originalAnimationPreserved, true)
assert.deepEqual(preparedGif.buffer, tinyGif)

const jpeg = await sharp({
  create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
}).jpeg().toBuffer()
const preparedJpeg = await prepareBlogMediaForPublication(jpeg, 'image/jpeg')
assert.equal(preparedJpeg.contentType, 'image/webp')
assert.equal(preparedJpeg.extension, 'webp')
assert.equal(preparedJpeg.originalAnimationPreserved, false)
assert.equal((await sharp(preparedJpeg.buffer).metadata()).format, 'webp')

const [actionsSource, migrationSource, hardeningMigrationSource, privateDerivativeMigrationSource, privateDerivativeFixMigrationSource, crashSafeDerivativeCleanupMigrationSource, atomicPlacementMigrationSource, commandSource, rendererSource, assetClientSource, assetActionsSource, blogEditorClientSource] = await Promise.all([
  readFile(actionsPath, 'utf8'),
  readFile(migrationPath, 'utf8'),
  readFile(hardeningMigrationPath, 'utf8'),
  readFile(privateDerivativeMigrationPath, 'utf8'),
  readFile(privateDerivativeFixMigrationPath, 'utf8'),
  readFile(crashSafeDerivativeCleanupMigrationPath, 'utf8'),
  readFile(atomicPlacementMigrationPath, 'utf8'),
  readFile(commandPath, 'utf8'),
  readFile(rendererPath, 'utf8'),
  readFile(assetClientPath, 'utf8'),
  readFile(assetActionsPath, 'utf8'),
  readFile(blogEditorClientPath, 'utf8'),
])

assert.match(actionsSource, /['"]image\/gif['"]/, 'manual blog media upload must accept GIF')
assert.match(actionsSource, /prepareBlogMediaForPublication/, 'publish must preserve GIF originals')
assert.match(actionsSource, /publicObjectPathForMedia\(postId, media\.id, prepared\.extension\)/)
assert.match(migrationSource, /array_append\(allowed_mime_types, 'image\/gif'\)/)
assert.match(migrationSource, /content-assets-private/)
assert.match(migrationSource, /blog-media-private/)
assert.match(migrationSource, /blog-media/)
assert.match(migrationSource, /touched_buckets <> 3/)
assert.match(migrationSource, /content_assets_central_brand_asset_id_unique/)
assert.match(hardeningMigrationSource, /content_assets_central_brand_sha256_unique/)
assert.match(hardeningMigrationSource, /blog_media_active_content_asset_unique/)
assert.match(hardeningMigrationSource, /content_asset_blog_post_usage_unique/)
assert.match(hardeningMigrationSource, /content_asset_blog_block_ref_unique/)
assert.match(hardeningMigrationSource, /protect_central_brand_provenance/)
assert.match(hardeningMigrationSource, /IS DISTINCT FROM OLD\.labels -> 'centralBrand'/)
assert.match(privateDerivativeMigrationSource, /content_asset_files_derivative_storage_check/)
assert.match(privateDerivativeMigrationSource, /bucket = 'content-assets-private'[\s\S]*public_url IS NULL/)
assert.match(privateDerivativeMigrationSource, /privatize_central_asset_derivatives/)
assert.match(privateDerivativeMigrationSource, /auth\.role\(\)[\s\S]*service_role/)
assert.match(privateDerivativeMigrationSource, /content_asset_events[\s\S]*central_brand_derivatives_privatized/)
assert.match(privateDerivativeFixMigrationSource, /asset_file\.file_role::TEXT = file_record\.file_role/)
assert.match(privateDerivativeMigrationSource, /asset_file\.file_role = file_record\.file_role/)
assert.match(crashSafeDerivativeCleanupMigrationSource, /p_cleanup_event_id UUID/)
assert.match(crashSafeDerivativeCleanupMigrationSource, /central_brand_public_cleanup_pending/)
assert.match(crashSafeDerivativeCleanupMigrationSource, /'public_paths', v_public_paths/)
assert.match(crashSafeDerivativeCleanupMigrationSource, /INSERT INTO showroom\.content_asset_events \([\s\S]*?id,[\s\S]*?VALUES \([\s\S]*?p_cleanup_event_id,[\s\S]*?'central_brand_public_cleanup_pending'/)
assert.match(crashSafeDerivativeCleanupMigrationSource, /DROP FUNCTION IF EXISTS showroom\.privatize_central_asset_derivatives\(UUID, UUID, TEXT, JSONB\)/)
assert.match(crashSafeDerivativeCleanupMigrationSource, /GRANT EXECUTE ON FUNCTION showroom\.privatize_central_asset_derivatives\(UUID, UUID, TEXT, JSONB, UUID\) TO service_role/)
const metadataUpdateInMigrationIndex = crashSafeDerivativeCleanupMigrationSource.indexOf('UPDATE showroom.content_asset_files')
const durablePendingInMigrationIndex = crashSafeDerivativeCleanupMigrationSource.indexOf("'central_brand_public_cleanup_pending'")
const migrationReturnIndex = crashSafeDerivativeCleanupMigrationSource.indexOf('RETURN total_updated')
assert.ok(
  metadataUpdateInMigrationIndex >= 0
    && durablePendingInMigrationIndex > metadataUpdateInMigrationIndex
    && migrationReturnIndex > durablePendingInMigrationIndex,
  'metadata update and durable pending cleanup intent must commit in the same RPC transaction',
)
assert.doesNotMatch(migrationSource, /content-assets-public[\s\S]*image\/gif/)

for (const requiredFlag of ['--brand-root', '--asset-id', '--actor-id', '--post-id', '--block-id']) {
  assert.ok(commandSource.includes(requiredFlag), `command must document ${requiredFlag}`)
}
assert.match(commandSource, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/)
assert.match(commandSource, /persistSession:\s*false/)
assert.match(commandSource, /upsert:\s*false/)
assert.match(commandSource, /--untracked-files=all/)
assert.match(commandSource, /asset\.manifestRelativePath/)
assert.match(commandSource, /'hash-object'/)
assert.match(commandSource, /'hash-object', '--no-filters'/)
assert.match(commandSource, /git', \['-C', brandRoot, 'rev-parse'/)
assert.match(commandSource, /currentHeadOutput\.trim\(\)\.toLowerCase\(\) !== centralCommitSha/)
assert.match(commandSource, /gitBlobOid\(asset\.buffer\) !== committedBlob/)
assert.match(commandSource, /isDeepStrictEqual\(committedManifestAsset, asset\.provenance\.manifest_asset\)/)
assert.match(commandSource, /CODEX_AUDIT_ACTOR_ID/)
assert.match(commandSource, /\.rpc\('attach_official_asset_to_reviewing_post'/)
assert.match(atomicPlacementMigrationSource, /v_post_status IS DISTINCT FROM 'reviewing'/)
assert.doesNotMatch(commandSource, /execute_sql|insert into|storage\.objects/i)
assert.match(atomicPlacementMigrationSource, /showroom\.content_asset_usages/)
assert.match(atomicPlacementMigrationSource, /showroom\.blog_media/)
assert.match(atomicPlacementMigrationSource, /INSERT INTO showroom\.content_asset_events/)
assert.match(atomicPlacementMigrationSource, /INSERT INTO showroom\.blog_blocks/)
assert.match(commandSource, /centralBrandSnapshot\(asset\)/)
assert.match(commandSource, /privatizeExistingDerivatives/)
const privatizeStart = commandSource.indexOf('async function privatizeExistingDerivatives')
const privatizeEnd = commandSource.indexOf('async function assertNoChecksumCollision', privatizeStart)
const privatizeSource = commandSource.slice(privatizeStart, privatizeEnd)
const metadataCommitIndex = privatizeSource.indexOf(".rpc('privatize_central_asset_derivatives'")
const publicCleanupIndex = privatizeSource.indexOf('storage.from(PUBLIC_BUCKET).remove')
const cleanupCompletedIndex = privatizeSource.indexOf("eventType: 'central_brand_public_cleanup_completed'")
assert.ok(metadataCommitIndex >= 0 && publicCleanupIndex > metadataCommitIndex, 'metadata must switch to private before public objects are removed')
assert.ok(cleanupCompletedIndex > publicCleanupIndex, 'cleanup completion must only be recorded after public object removal succeeds')
assert.match(privatizeSource, /newlyUploaded[\s\S]*cleanupUploadedFiles/, 'new private orphans must be compensated when metadata commit fails')
assert.match(privatizeSource, /const cleanupEventId = randomUUID\(\)/)
assert.match(privatizeSource, /p_cleanup_event_id: cleanupEventId/)
assert.match(commandSource, /hasPendingPublicDerivativeCleanup/)
assert.match(privatizeSource, /metadataCommitted = true[\s\S]*Privatization transaction outcome is inconclusive; private Storage was retained/)
assert.match(privatizeSource, /eventType: 'central_brand_public_cleanup_completed'[\s\S]*pendingEventId: cleanupEventId/)
assert.doesNotMatch(privatizeSource, /eventType: 'central_brand_public_cleanup_pending'/, 'the pending event must be committed by the metadata RPC, not after Storage deletion fails')
assert.match(commandSource, /reconcilePendingPublicDerivativeCleanup/, 'a later idempotent run must retry audited public cleanup')
assert.match(commandSource, /central_brand_public_cleanup_completed/, 'successful retry must close the pending audit event')
assert.match(commandSource, /bucket: PRIVATE_BUCKET, path: webPath/)
assert.match(commandSource, /bucket: PRIVATE_BUCKET, path: thumbnailPath/)
assert.match(commandSource, /cleanupCreatedAssetIfUnreferenced/)
assert.match(rendererSource, /<img src=\{media\.url\}/, 'public renderer must preserve browser-native GIF playback')
assert.match(assetClientSource, /image\/gif/, 'asset library file input must allow GIF selection')
assert.match(assetActionsSource, /mergeContentAssetLabelsWithTags\(currentAsset\.labels, tagNames\)/, 'metadata edits must preserve central provenance')
assert.match(blogEditorClientSource, /image\/gif/, 'blog editor file input must allow GIF selection')
assert.match(actionsSource, /centralBrandMediaPublicationIssues/, 'approval and publish must enforce central claim state')
assert.match(actionsSource, /centralBrandBlocker = centralBrandPublicationBlocker\(asset\.labels\)/, 'asset attachment must enforce central claim state')
assert.match(actionsSource, /Promise\.allSettled\([\s\S]*rollbackPublishedMedia[\s\S]*cleanupPublicObjects/, 'publish compensation must attempt both rollback operations')
assert.match(actionsSource, /if \(error\) throw new Error\(`공개 사진 정리 실패:/, 'public object cleanup errors must be surfaced')
assert.match(actionsSource, /Promise\.allSettled\([\s\S]*rollbackPublishedPost/, 'publish compensation must verify post rollback too')

console.log('official brand asset import contract passed')
