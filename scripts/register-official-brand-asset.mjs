import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { isDeepStrictEqual, promisify } from 'node:util'

import { createClient } from '@supabase/supabase-js'

import {
  createStaticContentAssetDerivatives,
  extensionForContentAssetMimeType,
} from '../src/lib/content-assets/content-asset-validation.mjs'
import {
  normalizeOfficialAssetPlacementResult,
  validateOfficialAssetPlacementOptions,
} from '../src/lib/content-assets/official-brand-blog-placement.mjs'
import { loadOfficialBrandAsset } from '../src/lib/content-assets/official-brand-asset.mjs'

const execFileAsync = promisify(execFile)
const PRIVATE_BUCKET = 'content-assets-private'
const PUBLIC_BUCKET = 'content-assets-public'

function usage() {
  return `Usage:
  node --env-file=.env.local scripts/register-official-brand-asset.mjs \\
    --brand-root <absolute-path> --asset-id <manifest-asset-id> \\
    --actor-id <administrator-uuid> [--post-id <reviewing-post-uuid>] \\
    [--block-id <existing-image-block-uuid>] [--alt <text>] [--caption <text>] \\
    [--insert-after-block-id <existing-block-uuid>] [--cover] [--title <text>] [--apply]

Default mode is validation-only. --apply performs server-side Storage and DB writes.
--block-id connects an existing empty image block. --insert-after-block-id creates a new image block
after the selected block while preserving order. --cover marks the imported media as the post cover.
All placement flags require --post-id; --block-id and --insert-after-block-id are mutually exclusive.`
}

function parseArgs(argv) {
  const values = {}
  const booleanFlags = new Set(['apply', 'cover', 'help'])

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (booleanFlags.has(key)) {
      values[key] = true
      continue
    }
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}.`)
    if (Object.hasOwn(values, key)) throw new Error(`Duplicate argument: --${key}.`)
    values[key] = value
    index += 1
  }

  const allowed = new Set([
    'apply', 'help', 'brand-root', 'asset-id', 'actor-id', 'post-id', 'block-id',
    'insert-after-block-id', 'cover', 'alt', 'caption', 'title',
  ])
  for (const key of Object.keys(values)) {
    if (!allowed.has(key)) throw new Error(`Unknown argument: --${key}.`)
  }
  if (values.help) return values
  for (const key of ['brand-root', 'asset-id', 'actor-id']) {
    if (!values[key]) throw new Error(`--${key} is required.`)
  }
  validateOfficialAssetPlacementOptions({
    postId: values['post-id'],
    cover: values.cover,
    blockId: values['block-id'],
    insertAfterBlockId: values['insert-after-block-id'],
  })
  if (values['post-id'] && !String(values.alt || '').trim()) {
    throw new Error('--alt is required when attaching an asset to a blog post.')
  }
  return values
}

function cleanText(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function objectPath(assetId, role, extension) {
  return `${assetId}/${role}/${Date.now()}-${randomUUID()}.${extension}`
}

function gitBlobOid(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`)
  return createHash('sha1').update(header).update(buffer).digest('hex')
}

async function centralCommit(brandRoot) {
  const allowedRoot = process.env.MUNJANGGUN_BRAND_ROOT
  if (!allowedRoot || path.resolve(allowedRoot) !== path.resolve(brandRoot)) {
    throw new Error('--brand-root must exactly match the server allowlist in MUNJANGGUN_BRAND_ROOT.')
  }
  const { stdout: status } = await execFileAsync(
    'git', ['-C', brandRoot, 'status', '--porcelain', '--untracked-files=all'],
    { windowsHide: true, timeout: 10_000 },
  )
  if (status.trim()) throw new Error('Central brand tracked files must be clean before import.')

  const { stdout } = await execFileAsync('git', ['-C', brandRoot, 'rev-parse', 'HEAD'], {
    windowsHide: true,
    timeout: 10_000,
  })
  const commit = stdout.trim().toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Central brand HEAD is not a full Git commit SHA.')
  return commit
}

async function assertTrackedCentralSource(brandRoot, asset, centralCommitSha) {
  const sourcePaths = [asset.manifestRelativePath, asset.repositoryPath]
  for (const sourcePath of sourcePaths) {
    try {
      await execFileAsync('git', ['-C', brandRoot, 'ls-files', '--error-unmatch', '--', sourcePath], {
        windowsHide: true,
        timeout: 10_000,
      })
    } catch (error) {
      throw new Error(`Central source is not tracked by Git: ${sourcePath}.`, { cause: error })
    }
  }

  try {
    await execFileAsync('git', ['-C', brandRoot, 'diff', '--quiet', centralCommitSha, '--', ...sourcePaths], {
      windowsHide: true,
      timeout: 10_000,
    })
  } catch (error) {
    throw new Error('Central manifest and asset bytes must exactly match the recorded commit.', { cause: error })
  }

  for (const sourcePath of sourcePaths) {
    let worktreeBlob
    let committedBlob
    try {
      const hashArgs = sourcePath === asset.repositoryPath
        ? ['-C', brandRoot, 'hash-object', '--no-filters', '--', sourcePath]
        : ['-C', brandRoot, 'hash-object', `--path=${sourcePath}`, '--', sourcePath]
      const worktreeResult = await execFileAsync(
        'git', hashArgs,
        { windowsHide: true, timeout: 20_000 },
      )
      const committedResult = await execFileAsync('git', ['-C', brandRoot, 'rev-parse', `${centralCommitSha}:${sourcePath}`], {
        windowsHide: true,
        timeout: 20_000,
      })
      worktreeBlob = worktreeResult.stdout.trim().toLowerCase()
      committedBlob = committedResult.stdout.trim().toLowerCase()
    } catch (error) {
      throw new Error(`Central source is absent from the recorded commit: ${sourcePath}.`, { cause: error })
    }
    if (worktreeBlob !== committedBlob) {
      throw new Error(`Central source bytes do not match the recorded commit: ${sourcePath}.`)
    }
    if (sourcePath === asset.repositoryPath && gitBlobOid(asset.buffer) !== committedBlob) {
      throw new Error('The validated central asset buffer does not match the recorded commit.')
    }
  }

  let committedManifest
  try {
    const { stdout } = await execFileAsync(
      'git', ['-C', brandRoot, 'show', `${centralCommitSha}:${asset.manifestRelativePath}`],
      { windowsHide: true, timeout: 20_000, maxBuffer: 20 * 1024 * 1024 },
    )
    committedManifest = JSON.parse(stdout.replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error('The recorded central manifest could not be parsed.', { cause: error })
  }
  const committedManifestAsset = committedManifest.assets?.find(item => item?.assetId === asset.assetId)
  const committedManifestIdentity = {
    schema: committedManifest.schema,
    version: committedManifest.version,
    productId: committedManifest.productId,
    sourceId: committedManifest.sourceId,
    proofId: committedManifest.proofId,
  }
  if (
    !isDeepStrictEqual(committedManifestAsset, asset.provenance.manifest_asset)
    || !isDeepStrictEqual(committedManifestIdentity, asset.manifestIdentity)
  ) {
    throw new Error('The validated central manifest record does not match the recorded commit.')
  }

  const { stdout: currentHeadOutput } = await execFileAsync('git', ['-C', brandRoot, 'rev-parse', 'HEAD'], {
    windowsHide: true,
    timeout: 10_000,
  })
  if (currentHeadOutput.trim().toLowerCase() !== centralCommitSha) {
    throw new Error('Central brand HEAD changed during validation; retry the import against one stable commit.')
  }
}

function createServerClient(url, key, schema) {
  return createClient(url, key, {
    db: { schema },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function requireAdministrator(platform, actorId) {
  if (!process.env.CODEX_AUDIT_ACTOR_ID || process.env.CODEX_AUDIT_ACTOR_ID !== actorId) {
    throw new Error('--actor-id must exactly match the server allowlist in CODEX_AUDIT_ACTOR_ID.')
  }
  const { data, error } = await platform
    .from('profiles')
    .select('id, role')
    .eq('id', actorId)
    .eq('role', 'administrator')
    .single()
  if (error || !data) throw new Error('The supplied --actor-id is not an administrator profile.')
}

function cleanupFailureMessage(result, label) {
  if (result.error) return `${label}: ${result.error.message}`
  return null
}

async function cleanupUploadedFiles(showroom, files) {
  const failures = []
  for (const file of files ?? []) {
    const result = await showroom.storage.from(file.bucket).remove([file.object_path])
    const failure = cleanupFailureMessage(result, `Storage cleanup failed for ${file.bucket}/${file.object_path}`)
    if (failure) failures.push(failure)
  }
  if (failures.length > 0) throw new Error(failures.join(' | '))
}

async function recordPublicDerivativeCleanupEvent(showroom, {
  assetId,
  actorId,
  eventType,
  publicPaths,
  pendingEventId = null,
  failureMessage = null,
}) {
  const { error } = await showroom.from('content_asset_events').insert({
    asset_id: assetId,
    event_type: eventType,
    actor_id: actorId,
    metadata: {
      public_bucket: PUBLIC_BUCKET,
      public_paths: publicPaths,
      pending_event_id: pendingEventId,
      failure: failureMessage,
    },
  })
  if (error) throw new Error(`Public derivative cleanup audit failed: ${error.message}`)
}

async function reconcilePendingPublicDerivativeCleanup(showroom, assetId, actorId) {
  const { data: pendingEvents, error: pendingError } = await showroom
    .from('content_asset_events')
    .select('id, metadata, created_at')
    .eq('asset_id', assetId)
    .eq('event_type', 'central_brand_public_cleanup_pending')
    .order('created_at', { ascending: true })
    .limit(50)
  if (pendingError) throw new Error(`Pending public cleanup lookup failed: ${pendingError.message}`)
  if (!pendingEvents?.length) return false

  const { data: completedEvents, error: completedError } = await showroom
    .from('content_asset_events')
    .select('metadata')
    .eq('asset_id', assetId)
    .eq('event_type', 'central_brand_public_cleanup_completed')
    .limit(50)
  if (completedError) throw new Error(`Completed public cleanup lookup failed: ${completedError.message}`)

  const completedIds = new Set((completedEvents ?? [])
    .map(event => event.metadata?.pending_event_id)
    .filter(id => typeof id === 'string'))
  let reconciled = false

  for (const pending of pendingEvents) {
    if (completedIds.has(pending.id)) continue
    const publicPaths = pending.metadata?.public_paths
    if (!Array.isArray(publicPaths)
      || publicPaths.length === 0
      || publicPaths.some(path => typeof path !== 'string' || path.length === 0)) {
      throw new Error(`Pending public cleanup event ${pending.id} has invalid paths.`)
    }

    const { error: removeError } = await showroom.storage.from(PUBLIC_BUCKET).remove(publicPaths)
    if (removeError) {
      throw new Error(`Pending public derivative cleanup failed: ${removeError.message}`)
    }

    await recordPublicDerivativeCleanupEvent(showroom, {
      assetId,
      actorId,
      eventType: 'central_brand_public_cleanup_completed',
      publicPaths,
      pendingEventId: pending.id,
    })
    reconciled = true
  }

  return reconciled
}

async function hasPendingPublicDerivativeCleanup(showroom, assetId, cleanupEventId) {
  const { data, error } = await showroom
    .from('content_asset_events')
    .select('id')
    .eq('id', cleanupEventId)
    .eq('asset_id', assetId)
    .eq('event_type', 'central_brand_public_cleanup_pending')
    .maybeSingle()
  if (error) throw new Error(`Privatization commit verification failed: ${error.message}`)
  return Boolean(data)
}

function withCleanupFailure(error, cleanupError) {
  const originalMessage = error instanceof Error ? error.message : String(error)
  const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
  return new Error(`${originalMessage} Cleanup also failed: ${cleanupMessage}`, { cause: error })
}

async function cleanupCreatedAssetIfUnreferenced(showroom, assetId, actorId, uploadedFiles = []) {
  const { data, error } = await showroom.rpc('delete_unreferenced_official_asset', {
    p_asset_id: assetId,
    p_actor_id: actorId,
  })
  if (error) {
    throw new Error(
      `New asset ${assetId} cleanup outcome is inconclusive; Storage was not touched: ${error.message}`,
    )
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.deleted !== 'boolean') {
    throw new Error(`New asset ${assetId} cleanup returned an invalid result; Storage was not touched.`)
  }
  if (!data.deleted) {
    throw new Error(`New asset ${assetId} was retained for reconciliation because committed references exist.`)
  }
  if (!Array.isArray(data.storageFiles)) {
    throw new Error(`New asset ${assetId} metadata was deleted but Storage paths were not returned.`)
  }

  const storageFiles = [...data.storageFiles, ...uploadedFiles.map(file => ({
    bucket: file.bucket,
    objectPath: file.object_path,
  }))]
  const uniqueFiles = new Map(storageFiles.map(file => [`${file?.bucket}/${file?.objectPath}`, file]))
  const failures = []
  for (const file of uniqueFiles.values()) {
    if (!file || typeof file.bucket !== 'string' || typeof file.objectPath !== 'string') {
      failures.push('Cleanup RPC returned an invalid Storage path')
      continue
    }
    const result = await showroom.storage.from(file.bucket).remove([file.objectPath])
    const failure = cleanupFailureMessage(
      result,
      `Orphan Storage cleanup failed for ${file.bucket}/${file.objectPath}`,
    )
    if (failure) failures.push(failure)
  }
  if (failures.length > 0) {
    throw new Error(`Asset metadata was deleted safely, but ${failures.join(' | ')}`)
  }
}

function centralBrandSnapshot(asset) {
  return {
    assetId: asset.assetId,
    productId: asset.productId,
    sourceId: asset.sourceId,
    proofId: asset.proofId,
    repositoryPath: asset.repositoryPath,
    manifestPath: asset.manifestRelativePath,
    centralCommit: asset.centralCommit,
    usageStatus: asset.usageStatus,
    privacyStatus: asset.privacyStatus,
    claimRisk: asset.claimRisk,
    externalPublish: asset.externalPublish,
    sha256: asset.inspection.checksumSha256,
    gifFrameCount: asset.inspection.gifFrameCount,
  }
}

function assertExistingFile(file, expected) {
  if (
    !file
    || file.transform_status !== 'ready'
    || file.mime_type !== expected.mimeType
    || file.size_bytes !== expected.sizeBytes
    || file.width !== expected.width
    || file.height !== expected.height
    || file.checksum_sha256 !== expected.checksumSha256
  ) {
    throw new Error(`Existing central asset ${expected.role} metadata does not match the validated source.`)
  }
}

async function existingCentralAsset(showroom, asset) {
  const { data, error } = await showroom
    .from('content_assets')
    .select('id, labels, library_state, privacy_checked, promotion_consent_checked')
    .contains('labels', { centralBrand: { assetId: asset.assetId } })
    .limit(2)
  if (error) throw new Error(`Central asset idempotency lookup failed: ${error.message}`)
  if ((data ?? []).length > 1) throw new Error('Multiple project assets claim the same central asset ID.')
  if (!data?.[0]) return null
  if (!isDeepStrictEqual(data[0].labels?.centralBrand, centralBrandSnapshot(asset))) {
    throw new Error('Existing central asset provenance does not match the current validated manifest record.')
  }

  const { data: files, error: fileError } = await showroom
    .from('content_asset_files')
    .select('id, file_role, bucket, object_path, public_url, mime_type, size_bytes, width, height, checksum_sha256, transform_status')
    .eq('asset_id', data[0].id)
  if (fileError) throw new Error(`Existing central asset files could not be verified: ${fileError.message}`)
  if ((files ?? []).length !== 3) throw new Error('Existing central asset must have exactly three file roles.')
  const derivatives = await createStaticContentAssetDerivatives(asset.buffer)
  const original = files.find(file => file.file_role === 'original')
  const web = files.find(file => file.file_role === 'web')
  const thumbnail = files.find(file => file.file_role === 'thumbnail')
  assertExistingFile(original, {
    role: 'original', mimeType: asset.mimeType, sizeBytes: asset.inspection.sizeBytes,
    width: asset.inspection.width, height: asset.inspection.height,
    checksumSha256: asset.inspection.checksumSha256,
  })
  assertExistingFile(web, { role: 'web', mimeType: 'image/webp', ...derivatives.web })
  assertExistingFile(thumbnail, { role: 'thumbnail', mimeType: 'image/webp', ...derivatives.thumbnail })
  if (original.bucket !== PRIVATE_BUCKET || original.public_url !== null) {
    throw new Error('Existing central original is not private.')
  }
  for (const derivative of [web, thumbnail]) {
    if (
      ![PRIVATE_BUCKET, PUBLIC_BUCKET].includes(derivative.bucket)
      || (derivative.bucket === PRIVATE_BUCKET && derivative.public_url !== null)
      || (derivative.bucket === PUBLIC_BUCKET && !derivative.public_url)
    ) {
      throw new Error(`Existing central ${derivative.file_role} storage boundary is invalid.`)
    }
  }
  return { asset: data[0], files, original, derivatives }
}

async function privatizeExistingDerivatives(showroom, assetRecord, asset, actorId) {
  const exposedFiles = assetRecord.files.filter(file => (
    ['web', 'thumbnail'].includes(file.file_role)
    && (file.bucket !== PRIVATE_BUCKET || file.public_url !== null)
  ))
  if (exposedFiles.length === 0) {
    const cleanupReconciled = await reconcilePendingPublicDerivativeCleanup(
      showroom,
      assetRecord.asset.id,
      actorId,
    )
    return { ...assetRecord, privatized: false, cleanupReconciled }
  }
  if (exposedFiles.length !== 2) throw new Error('Existing central derivatives are only partially private.')

  const derivativeByRole = {
    web: assetRecord.derivatives.web,
    thumbnail: assetRecord.derivatives.thumbnail,
  }
  const uploaded = []
  const newlyUploaded = []
  const cleanupEventId = randomUUID()
  let metadataCommitted = false

  try {
    for (const file of exposedFiles) {
      const derivative = derivativeByRole[file.file_role]
      const privatePath = objectPath(assetRecord.asset.id, file.file_role, 'webp')
      const upload = await showroom.storage.from(PRIVATE_BUCKET).upload(privatePath, derivative.buffer, {
        cacheControl: '3600', contentType: 'image/webp', upsert: false,
      })
      if (upload.error) {
        const existing = await showroom.storage.from(PRIVATE_BUCKET).download(privatePath)
        if (existing.error || !existing.data) {
          throw new Error(`Private derivative upload failed: ${upload.error.message}`)
        }
        const existingBuffer = Buffer.from(await existing.data.arrayBuffer())
        const existingChecksum = createHash('sha256').update(existingBuffer).digest('hex')
        if (existingBuffer.length !== derivative.sizeBytes || existingChecksum !== derivative.checksumSha256) {
          throw new Error('Existing private derivative does not match the validated derivative.')
        }
      } else {
        newlyUploaded.push({ bucket: PRIVATE_BUCKET, object_path: privatePath })
      }
      uploaded.push({ file, privatePath })
    }

    const { data: updatedCount, error: rpcError } = await showroom.rpc('privatize_central_asset_derivatives', {
      p_asset_id: assetRecord.asset.id,
      p_actor_id: actorId,
      p_central_asset_id: asset.assetId,
      p_files: uploaded.map(item => ({
        id: item.file.id,
        file_role: item.file.file_role,
        old_object_path: item.file.object_path,
        new_object_path: item.privatePath,
      })),
      p_cleanup_event_id: cleanupEventId,
    })
    if (rpcError || updatedCount !== 2) {
      const transactionFailure = new Error(
        `Private derivative metadata transaction failed: ${rpcError?.message || 'unexpected row count'}`,
      )
      try {
        const committed = await hasPendingPublicDerivativeCleanup(
          showroom,
          assetRecord.asset.id,
          cleanupEventId,
        )
        if (!committed) throw transactionFailure
      } catch (verificationError) {
        if (verificationError === transactionFailure) throw transactionFailure
        metadataCommitted = true
        throw new Error(
          `Privatization transaction outcome is inconclusive; private Storage was retained: ${verificationError.message}`,
          { cause: transactionFailure },
        )
      }
    }
    metadataCommitted = true
  } catch (error) {
    if (!metadataCommitted && newlyUploaded.length > 0) {
      try {
        await cleanupUploadedFiles(showroom, newlyUploaded)
      } catch (cleanupError) {
        throw withCleanupFailure(error, cleanupError)
      }
    }
    throw error
  }

  const publicPaths = uploaded.map(item => item.file.object_path)
  const { error: removeError } = await showroom.storage.from(PUBLIC_BUCKET).remove(publicPaths)
  if (removeError) {
    throw new Error(`Exposed derivative cleanup failed after metadata commit and was queued for reconciliation: ${removeError.message}`)
  }

  await recordPublicDerivativeCleanupEvent(showroom, {
    assetId: assetRecord.asset.id,
    actorId,
    eventType: 'central_brand_public_cleanup_completed',
    publicPaths,
    pendingEventId: cleanupEventId,
  })

  const replacementPaths = new Map(uploaded.map(item => [item.file.file_role, item.privatePath]))
  return {
    ...assetRecord,
    privatized: true,
    files: assetRecord.files.map(file => replacementPaths.has(file.file_role)
      ? { ...file, bucket: PRIVATE_BUCKET, object_path: replacementPaths.get(file.file_role), public_url: null }
      : file),
  }
}

async function assertNoChecksumCollision(showroom, asset) {
  const { data, error } = await showroom
    .from('content_asset_files')
    .select('asset_id')
    .eq('file_role', 'original')
    .eq('checksum_sha256', asset.inspection.checksumSha256)
    .limit(2)
  if (error) throw new Error(`SHA-256 duplicate check failed: ${error.message}`)
  if ((data ?? []).length > 0) {
    throw new Error('The same original SHA-256 already exists under a different project asset.')
  }
}

async function createAsset(showroom, asset, actorId, title) {
  const uploaded = []
  let assetId = null
  try {
    await assertNoChecksumCollision(showroom, asset)
    const derivatives = await createStaticContentAssetDerivatives(asset.buffer)
    const labels = {
      tags: ['central-brand', asset.product || asset.productId],
      centralBrand: centralBrandSnapshot(asset),
    }

    const { data: created, error: createError } = await showroom
      .from('content_assets')
      .insert({
        title: title || `${asset.product || asset.productId} ${asset.fileName}`,
        description: cleanText(asset.notes),
        category: 'central_brand_official',
        labels,
        product_type: cleanText(asset.product),
        usage_purpose: 'blog_candidate',
        library_state: 'hidden',
        privacy_checked: true,
        promotion_consent_checked: false,
        created_by: actorId,
        updated_by: actorId,
      })
      .select('id')
      .single()
    if (createError || !created) throw new Error(`Content asset row creation failed: ${createError?.message ?? 'no row'}`)
    assetId = created.id

    const originalPath = objectPath(assetId, 'original', extensionForContentAssetMimeType(asset.mimeType))
    const webPath = objectPath(assetId, 'web', 'webp')
    const thumbnailPath = objectPath(assetId, 'thumbnail', 'webp')
    const uploads = [
      { bucket: PRIVATE_BUCKET, path: originalPath, buffer: asset.buffer, contentType: asset.mimeType, cacheControl: '3600' },
      { bucket: PRIVATE_BUCKET, path: webPath, buffer: derivatives.web.buffer, contentType: 'image/webp', cacheControl: '3600' },
      { bucket: PRIVATE_BUCKET, path: thumbnailPath, buffer: derivatives.thumbnail.buffer, contentType: 'image/webp', cacheControl: '3600' },
    ]
    for (const upload of uploads) {
      const { error } = await showroom.storage.from(upload.bucket).upload(upload.path, upload.buffer, {
        cacheControl: upload.cacheControl,
        contentType: upload.contentType,
        upsert: false,
      })
      if (error) throw new Error(`Storage upload failed for ${upload.bucket}: ${error.message}`)
      uploaded.push({ bucket: upload.bucket, path: upload.path })
    }

    const { error: filesError } = await showroom.from('content_asset_files').insert([
      {
        asset_id: assetId, file_role: 'original', bucket: PRIVATE_BUCKET, object_path: originalPath,
        public_url: null, mime_type: asset.mimeType, size_bytes: asset.inspection.sizeBytes,
        width: asset.inspection.width, height: asset.inspection.height,
        checksum_sha256: asset.inspection.checksumSha256, transform_status: 'ready',
      },
      {
        asset_id: assetId, file_role: 'web', bucket: PRIVATE_BUCKET, object_path: webPath,
        public_url: null, mime_type: 'image/webp', size_bytes: derivatives.web.sizeBytes,
        width: derivatives.web.width, height: derivatives.web.height,
        checksum_sha256: derivatives.web.checksumSha256, transform_status: 'ready',
      },
      {
        asset_id: assetId, file_role: 'thumbnail', bucket: PRIVATE_BUCKET, object_path: thumbnailPath,
        public_url: null, mime_type: 'image/webp', size_bytes: derivatives.thumbnail.sizeBytes,
        width: derivatives.thumbnail.width, height: derivatives.thumbnail.height,
        checksum_sha256: derivatives.thumbnail.checksumSha256, transform_status: 'ready',
      },
    ])
    if (filesError) throw new Error(`Content asset file metadata creation failed: ${filesError.message}`)

    const { error: eventError } = await showroom.from('content_asset_events').insert({
      asset_id: assetId,
      event_type: 'central_brand_imported',
      actor_id: actorId,
      metadata: {
        central_asset_id: asset.assetId,
        source_id: asset.sourceId,
        proof_id: asset.proofId,
        central_commit: asset.centralCommit,
        repository_path: asset.repositoryPath,
        checksum_sha256: asset.inspection.checksumSha256,
        usage_status: asset.usageStatus,
        privacy_status: asset.privacyStatus,
        claim_risk: asset.claimRisk,
        external_publish: asset.externalPublish,
        gif_frame_count: asset.inspection.gifFrameCount,
      },
    })
    if (eventError) throw new Error(`Central import audit event creation failed: ${eventError.message}`)

    return {
      created: true,
      asset: { id: assetId, labels, library_state: 'hidden', privacy_checked: true, promotion_consent_checked: false },
      original: { bucket: PRIVATE_BUCKET, object_path: originalPath, mime_type: asset.mimeType },
      files: [
        { bucket: PRIVATE_BUCKET, object_path: originalPath },
        { bucket: PRIVATE_BUCKET, object_path: webPath },
        { bucket: PRIVATE_BUCKET, object_path: thumbnailPath },
      ],
    }
  } catch (error) {
    try {
      const uploadedFiles = uploaded.map(item => ({ bucket: item.bucket, object_path: item.path }))
      if (assetId) {
        await cleanupCreatedAssetIfUnreferenced(showroom, assetId, actorId, uploadedFiles)
      } else {
        await cleanupUploadedFiles(showroom, uploadedFiles)
      }
    } catch (cleanupError) {
      throw withCleanupFailure(error, cleanupError)
    }
    throw error
  }
}

async function attachToBlog(showroom, assetRecord, asset, actorId, options) {
  const placement = validateOfficialAssetPlacementOptions(options)
  if (!placement.postId) return {
    mediaId: null,
    blockId: null,
    createdMedia: false,
    cover: false,
    insertedBlock: false,
    shiftedBlocks: 0,
    eventsCreated: 0,
  }

  const { data, error } = await showroom.rpc('attach_official_asset_to_reviewing_post', {
    p_post_id: placement.postId,
    p_asset_id: assetRecord.asset.id,
    p_actor_id: actorId,
    p_alt_text: options.alt,
    p_caption: cleanText(options.caption),
    p_source_label: options.title || asset.product || asset.fileName,
    p_existing_block_id: placement.blockId,
    p_insert_after_block_id: placement.insertAfterBlockId,
    p_set_cover: placement.cover,
  })
  if (error) throw new Error(`Atomic blog placement failed: ${error.message}`)
  return normalizeOfficialAssetPlacementResult(data)
}
async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return
  }

  const commit = await centralCommit(args['brand-root'])
  const asset = await loadOfficialBrandAsset({
    brandRoot: args['brand-root'],
    assetId: args['asset-id'],
    centralCommit: commit,
  })
  await assertTrackedCentralSource(args['brand-root'], asset, commit)
  const plan = {
    mode: args.apply ? 'apply' : 'validate',
    centralAssetId: asset.assetId,
    repositoryPath: asset.repositoryPath,
    centralCommit: commit,
    mimeType: asset.mimeType,
    sizeBytes: asset.inspection.sizeBytes,
    width: asset.inspection.width,
    height: asset.inspection.height,
    gifFrameCount: asset.inspection.gifFrameCount,
    checksumSha256: asset.inspection.checksumSha256,
    privacyStatus: asset.privacyStatus,
    claimRisk: asset.claimRisk,
    externalPublish: asset.externalPublish,
    requiresClaimReview: asset.requiresClaimReview,
    postId: args['post-id'] || null,
    blockId: args['block-id'] || null,
    insertAfterBlockId: args['insert-after-block-id'] || null,
    cover: args.cover === true,
  }
  if (!args.apply) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serverKey) {
    throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY are required.')
  }

  const platform = createServerClient(supabaseUrl, serverKey, 'platform')
  const showroom = createServerClient(supabaseUrl, serverKey, 'showroom')
  await requireAdministrator(platform, args['actor-id'])

  let assetRecord = await existingCentralAsset(showroom, asset)
  if (!assetRecord) {
    assetRecord = await createAsset(showroom, asset, args['actor-id'], cleanText(args.title))
  } else {
    assetRecord = await privatizeExistingDerivatives(
      showroom,
      { ...assetRecord, created: false },
      asset,
      args['actor-id'],
    )
  }

  try {
    const attachment = await attachToBlog(showroom, assetRecord, asset, args['actor-id'], {
      postId: args['post-id'] || null,
      blockId: args['block-id'] || null,
      insertAfterBlockId: args['insert-after-block-id'] || null,
      cover: args.cover === true,
      alt: cleanText(args.alt),
      caption: cleanText(args.caption),
      title: cleanText(args.title),
    })
    console.log(JSON.stringify({
      ...plan,
      assetId: assetRecord.asset.id,
      created: assetRecord.created,
      derivativesPrivatized: assetRecord.privatized ?? false,
      derivativeCleanupReconciled: assetRecord.cleanupReconciled ?? false,
      ...attachment,
    }, null, 2))
  } catch (error) {
    if (assetRecord.created) {
      try {
        await cleanupCreatedAssetIfUnreferenced(
          showroom,
          assetRecord.asset.id,
          args['actor-id'],
          assetRecord.files,
        )
      } catch (cleanupError) {
        throw withCleanupFailure(error, cleanupError)
      }
    }
    throw error
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
