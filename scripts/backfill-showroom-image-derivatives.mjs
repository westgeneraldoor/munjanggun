import process from 'node:process'

import { createClient } from '@supabase/supabase-js'
import {
  CONTENT_ASSET_ALLOWED_IMAGE_TYPES,
  detectContentAssetMimeType,
  sha256Hex,
} from '../src/lib/content-assets/content-asset-validation.mjs'

import {
  buildShowroomDerivativeObjectPath,
  SHOWROOM_IMAGE_RECIPE_VERSION,
  SHOWROOM_IMAGE_VARIANT_SPECS,
  transformShowroomImage,
} from '../src/lib/showroom/showroom-image-derivatives.mjs'

const PRODUCTION_PROJECT_REF = 'cebafroyvmllbyivevjd'
const DERIVATIVE_BUCKET = 'showroom-images'
const PAGE_SIZE = 500

const options = {
  dryRun: true,
  retryFailed: false,
  allowProduction: false,
  confirmProject: '',
  rootSlug: 'middle-door',
  limit: Number.POSITIVE_INFINITY,
  concurrency: 3,
}

for (const argument of process.argv.slice(2)) {
  if (argument === '--apply') options.dryRun = false
  else if (argument === '--retry-failed') options.retryFailed = true
  else if (argument === '--allow-production') options.allowProduction = true
  else if (argument.startsWith('--confirm-project=')) options.confirmProject = argument.slice(18)
  else if (argument.startsWith('--root-slug=')) options.rootSlug = argument.slice(12)
  else if (argument.startsWith('--limit=')) options.limit = Number.parseInt(argument.slice(8), 10)
  else if (argument.startsWith('--concurrency=')) options.concurrency = Number.parseInt(argument.slice(14), 10)
  else throw new Error(`Unknown argument: ${argument}`)
}

if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 8) {
  throw new Error('--concurrency must be an integer between 1 and 8.')
}
if (!(options.limit > 0)) throw new Error('--limit must be greater than zero.')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
}

const supabaseHostname = new URL(supabaseUrl).hostname
const urlProjectRef = supabaseHostname.endsWith('.supabase.co')
  ? supabaseHostname.split('.')[0]
  : ''
const configuredProjectRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? ''
if (urlProjectRef && configuredProjectRef && urlProjectRef !== configuredProjectRef) {
  throw new Error('SUPABASE_PROJECT_REF does not match NEXT_PUBLIC_SUPABASE_URL.')
}
const projectRef = configuredProjectRef || urlProjectRef
if (!options.dryRun) {
  if (!projectRef) {
    throw new Error('Apply requires SUPABASE_PROJECT_REF when using a custom Supabase domain or proxy.')
  }
  if (options.confirmProject !== projectRef) {
    throw new Error(`Apply requires --confirm-project=${projectRef}.`)
  }
  if (projectRef === PRODUCTION_PROJECT_REF && !options.allowProduction) {
    throw new Error(
      `Production backfill is prohibited without --allow-production and --confirm-project=${PRODUCTION_PROJECT_REF}.`,
    )
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'showroom' },
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(makeQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

function publicStorageIdentity(sourceUrl) {
  const parsed = new URL(sourceUrl)
  if (parsed.origin !== new URL(supabaseUrl).origin) return null
  const marker = '/storage/v1/object/public/'
  const markerIndex = parsed.pathname.indexOf(marker)
  if (markerIndex < 0) return null
  const storagePath = parsed.pathname.slice(markerIndex + marker.length)
  const separator = storagePath.indexOf('/')
  if (separator <= 0 || separator === storagePath.length - 1) return null
  return {
    sourceUrl,
    bucket: decodeURIComponent(storagePath.slice(0, separator)),
    objectPath: storagePath
      .slice(separator + 1)
      .split('/')
      .map(segment => decodeURIComponent(segment))
      .join('/'),
  }
}

async function inventoryReferences() {
  const nodes = await fetchAll(() => supabase
    .from('nodes')
    .select('id,parent_id,slug,status,image_url')
    .order('id'))
  const roots = nodes.filter(node => node.slug === options.rootSlug)
  if (roots.length !== 1) throw new Error(`Expected one ${options.rootSlug} root node.`)

  const childrenByParent = new Map()
  for (const node of nodes) {
    if (!node.parent_id) continue
    const children = childrenByParent.get(node.parent_id) ?? []
    children.push(node)
    childrenByParent.set(node.parent_id, children)
  }

  const tree = []
  const queue = [...roots]
  while (queue.length > 0) {
    const node = queue.shift()
    tree.push(node)
    queue.push(...(childrenByParent.get(node.id) ?? []))
  }

  const published = tree.filter(node => node.status === 'published')
  const references = published
    .filter(node => node.image_url)
    .map(node => ({ kind: 'node', sourceUrl: node.image_url }))

  for (let offset = 0; offset < published.length; offset += 50) {
    const ids = published.slice(offset, offset + 50).map(node => node.id)
    const photos = await fetchAll(() => supabase
      .from('gallery_photos')
      .select('id,image_url')
      .in('node_id', ids)
      .order('id'))
    references.push(...photos
      .filter(photo => photo.image_url)
      .map(photo => ({ kind: 'gallery', sourceUrl: photo.image_url })))
  }

  return references
}

function isMissingRelation(error) {
  return error?.code === 'PGRST205'
    || /image_sources|schema cache|does not exist/i.test(error?.message ?? '')
}

async function existingStates(sourceUrls) {
  const result = new Map()
  for (let offset = 0; offset < sourceUrls.length; offset += 100) {
    const urlChunk = sourceUrls.slice(offset, offset + 100)
    const { data: sources, error: sourceError } = await supabase
      .from('image_sources')
      .select('id,source_url')
      .in('source_url', urlChunk)
    if (sourceError) {
      if (isMissingRelation(sourceError)) return result
      throw sourceError
    }
    if (!sources || sources.length === 0) continue
    const byId = new Map(sources.map(source => [source.id, source.source_url]))
    const { data: derivatives, error: derivativeError } = await supabase
      .from('image_derivatives')
      .select('source_id,variant,recipe_version,transform_status')
      .in('source_id', [...byId.keys()])
      .eq('recipe_version', SHOWROOM_IMAGE_RECIPE_VERSION)
    if (derivativeError) throw derivativeError
    for (const derivative of derivatives ?? []) {
      const sourceUrl = byId.get(derivative.source_id)
      if (!sourceUrl) continue
      const states = result.get(sourceUrl) ?? new Map()
      states.set(derivative.variant, derivative.transform_status)
      result.set(sourceUrl, states)
    }
  }
  return result
}

function alreadyComplete(states) {
  return Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS).every(variant => (
    states?.get(variant) === 'ready' || states?.get(variant) === 'skipped'
  ))
}

function shouldProcess(states) {
  if (!states || states.size === 0) return true
  if (alreadyComplete(states)) return false
  const hasFailed = [...states.values()].includes('failed')
  return !hasFailed || options.retryFailed
}

async function retry(operation, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 250))
    }
  }
  throw lastError
}

function alreadyExists(error) {
  return error?.statusCode === 409
    || error?.statusCode === '409'
    || /already exists|duplicate/i.test(error?.message ?? '')
}

async function uploadImmutable(path, derivative) {
  const bucket = supabase.storage.from(DERIVATIVE_BUCKET)
  const collision = await retry(async () => {
    const { error } = await bucket.upload(path, derivative.buffer, {
      cacheControl: '31536000',
      contentType: derivative.mimeType,
      upsert: false,
    })
    if (error && !alreadyExists(error)) throw error
    return Boolean(error)
  })
  if (collision) {
    const data = await retry(async () => {
      const { data: existing, error } = await bucket.download(path)
      if (error || !existing) throw error ?? new Error('Existing derivative verification failed.')
      return existing
    })
    const existingChecksum = sha256Hex(Buffer.from(await data.arrayBuffer()))
    if (existingChecksum !== derivative.checksumSha256) {
      throw new Error('Existing immutable derivative checksum mismatch.')
    }
  }
  return bucket.getPublicUrl(path).data.publicUrl
}

async function processSource(identity) {
  const blob = await retry(async () => {
    const { data, error } = await supabase.storage.from(identity.bucket).download(identity.objectPath)
    if (error || !data) throw error ?? new Error('Source download failed.')
    return data
  })

  const sourceBuffer = Buffer.from(await blob.arrayBuffer())
  const blobMimeType = blob.type?.toLowerCase()
  const declaredMimeType = CONTENT_ASSET_ALLOWED_IMAGE_TYPES.has(blobMimeType)
    ? blobMimeType
    : detectContentAssetMimeType(sourceBuffer)
  if (!declaredMimeType) throw new Error('Source MIME type could not be detected.')
  const transformed = await transformShowroomImage(sourceBuffer, declaredMimeType)
  const derivatives = []
  let failed = false

  for (const [variant, spec] of Object.entries(SHOWROOM_IMAGE_VARIANT_SPECS)) {
    const derivative = transformed.variants[variant]
    if (derivative.status === 'skipped') {
      derivatives.push({
        variant,
        recipe_version: transformed.recipeVersion,
        target_width: spec.width,
        transform_status: 'skipped',
        skip_reason: derivative.skipReason,
      })
      continue
    }

    try {
      const objectPath = buildShowroomDerivativeObjectPath(
        transformed.original.checksumSha256,
        variant,
      )
      const publicUrl = await uploadImmutable(objectPath, derivative)
      derivatives.push({
        variant,
        recipe_version: transformed.recipeVersion,
        target_width: spec.width,
        transform_status: 'ready',
        derivative_bucket: DERIVATIVE_BUCKET,
        derivative_object_path: objectPath,
        public_url: publicUrl,
        mime_type: derivative.mimeType,
        width: derivative.width,
        height: derivative.height,
        size_bytes: derivative.sizeBytes,
        checksum_sha256: derivative.checksumSha256,
      })
    } catch {
      failed = true
      derivatives.push({
        variant,
        recipe_version: transformed.recipeVersion,
        target_width: spec.width,
        transform_status: 'failed',
        transform_error: 'immutable derivative upload failed',
      })
    }
  }

  await retry(async () => {
    const { error: commitError } = await supabase.rpc('commit_image_derivatives', {
      p_source: {
        source_bucket: identity.bucket,
        source_object_path: identity.objectPath,
        source_url: identity.sourceUrl,
        source_mime_type: transformed.original.mimeType,
        source_size_bytes: transformed.original.sizeBytes,
        source_width: transformed.original.width,
        source_height: transformed.original.height,
        source_checksum_sha256: transformed.original.checksumSha256,
      },
      p_derivatives: derivatives,
    })
    if (commitError) throw commitError
  })
  return failed ? 'failed' : 'completed'
}

const references = await inventoryReferences()
const parsed = references.map(reference => ({
  ...reference,
  identity: publicStorageIdentity(reference.sourceUrl),
}))
const supported = parsed.filter(reference => reference.identity)
const unsupportedCount = parsed.length - supported.length
const identities = [...new Map(supported.map(reference => [
  reference.sourceUrl,
  reference.identity,
])).values()]
const states = await existingStates(identities.map(identity => identity.sourceUrl))
const pending = identities.filter(identity => shouldProcess(states.get(identity.sourceUrl)))
const deferredFailed = identities.filter(identity => {
  const sourceStates = states.get(identity.sourceUrl)
  return sourceStates
    && [...sourceStates.values()].includes('failed')
    && !options.retryFailed
}).length

const summary = {
  mode: options.dryRun ? 'dry-run' : 'apply',
  projectRef,
  rootSlug: options.rootSlug,
  references: references.length,
  nodeReferences: references.filter(reference => reference.kind === 'node').length,
  galleryReferences: references.filter(reference => reference.kind === 'gallery').length,
  distinctSourceUrls: identities.length,
  unsupportedSourceUrls: unsupportedCount,
  alreadyComplete: identities.filter(identity => alreadyComplete(states.get(identity.sourceUrl))).length,
  deferredFailed,
  pending: pending.length,
  attempted: 0,
  completed: 0,
  failed: 0,
}

if (!options.dryRun) {
  const queue = pending.slice(0, options.limit)
  let cursor = 0
  const workers = Array.from({ length: Math.min(options.concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const index = cursor
      cursor += 1
      summary.attempted += 1
      try {
        const result = await processSource(queue[index])
        if (result === 'completed') summary.completed += 1
        else summary.failed += 1
      } catch {
        summary.failed += 1
      }
    }
  })
  await Promise.all(workers)
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
if (!options.dryRun && summary.failed > 0) process.exitCode = 1
