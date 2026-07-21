import { opendir, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

import {
  extensionForContentAssetMimeType,
  inspectContentAssetImage,
} from './content-asset-validation.mjs'

const MANIFEST_FILE_NAME = 'asset-manifest.json'
const MANIFEST_SCHEMA = 'munjanggun.productDetailAssets.v1'
const MANIFEST_VERSION = '1.0'
const ASSET_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const COMMIT_PATTERN = /^[a-f0-9]{40}$/
const CLAIM_RISKS = new Set(['low', 'medium', 'high'])
const EXTERNAL_PUBLISH_STATES = new Set([
  'allowed_after_context_check',
  'requires_claim_freshness_check',
])

const MIME_BY_EXTENSION = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.heic', 'image/heic'],
  ['.heif', 'image/heif'],
])

export class CentralAssetValidationError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'CentralAssetValidationError'
  }
}

function fail(message, cause) {
  throw new CentralAssetValidationError(message, cause ? { cause } : undefined)
}

function pathIsWithin(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

async function manifestPathsUnder(root) {
  const manifests = []
  const pending = [root]

  while (pending.length > 0) {
    const directory = pending.pop()
    let handle
    try {
      handle = await opendir(directory)
    } catch (error) {
      fail(`Cannot inspect central brand directory: ${directory}.`, error)
    }

    for await (const entry of handle) {
      if (entry.isSymbolicLink()) continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!['.git', 'node_modules'].includes(entry.name)) pending.push(absolute)
      } else if (entry.isFile() && entry.name === MANIFEST_FILE_NAME) {
        manifests.push(absolute)
      }
    }
  }

  return manifests.sort((left, right) => left.localeCompare(right))
}

function parseManifest(source, manifestPath) {
  let parsed
  try {
    parsed = JSON.parse(source.replace(/^\uFEFF/, ''))
  } catch (error) {
    fail(`Central asset manifest is not valid JSON: ${manifestPath}.`, error)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`Central asset manifest must contain an object: ${manifestPath}.`)
  }
  if (parsed.schema !== MANIFEST_SCHEMA || parsed.version !== MANIFEST_VERSION) {
    fail(`Unsupported central asset manifest schema or version: ${manifestPath}.`)
  }
  if (!Array.isArray(parsed.assets)) {
    fail(`Central asset manifest has no assets array: ${manifestPath}.`)
  }
  return parsed
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) fail(`Manifest field ${fieldName} must be a non-empty string.`)
  return value.trim()
}

function validateRepositoryPath(repositoryPath) {
  const value = requireNonEmptyString(repositoryPath, 'repositoryPath')
  if (
    value.includes('\\')
    || value.includes('\0')
    || path.posix.isAbsolute(value)
    || value.split('/').some(segment => segment === '' || segment === '.' || segment === '..')
    || path.posix.normalize(value) !== value
  ) {
    fail(`Central asset repository path is not allowed: ${value}.`)
  }
  return value
}

function manifestInteger(value, fieldName, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    fail(`Manifest field ${fieldName} must be an integer greater than or equal to ${minimum}.`)
  }
  return value
}

function assertManifestIdentity(manifest, asset) {
  for (const field of ['productId', 'sourceId', 'proofId']) {
    const manifestValue = requireNonEmptyString(manifest[field], field)
    const assetValue = requireNonEmptyString(asset[field], `assets[].${field}`)
    if (manifestValue !== assetValue) {
      fail(`Manifest ${field} does not match the selected asset.`)
    }
  }
}

function mimeTypeForManifestAsset(asset) {
  const extension = requireNonEmptyString(asset.extension, 'assets[].extension').toLowerCase()
  const fileName = requireNonEmptyString(asset.fileName, 'assets[].fileName')
  const repositoryPath = validateRepositoryPath(asset.repositoryPath)

  if (path.posix.basename(repositoryPath) !== fileName) {
    fail('Manifest fileName does not match the repository path.')
  }
  if (path.posix.extname(repositoryPath).toLowerCase() !== extension) {
    fail('Manifest extension does not match the repository path.')
  }

  const mimeType = MIME_BY_EXTENSION.get(extension)
  if (!mimeType) fail(`Manifest extension is not an allowed image type: ${extension}.`)
  return { extension, fileName, repositoryPath, mimeType }
}

function officialBrandSource(asset, manifestPath, brandRoot, centralCommit) {
  return {
    asset_id: asset.assetId,
    central_commit: centralCommit,
    manifest_path: path.relative(brandRoot, manifestPath).split(path.sep).join('/'),
    repository_path: asset.repositoryPath,
    manifest_asset: structuredClone(asset),
  }
}

export function isCentralAssetPubliclyEligible(asset) {
  return Boolean(
    asset
    && asset.privacyStatus === 'official_reviewed'
    && asset.usageStatus === 'approved'
    && asset.claimRisk === 'low'
    && asset.externalPublish === 'allowed_after_context_check'
    && asset.promotionConsentChecked === true,
  )
}

export async function loadOfficialBrandAsset({ brandRoot, assetId, centralCommit }) {
  if (typeof brandRoot !== 'string' || !path.isAbsolute(brandRoot)) {
    fail('Central brand root path must be absolute.')
  }
  if (typeof assetId !== 'string' || !ASSET_ID_PATTERN.test(assetId)) {
    fail('Central asset ID is missing or invalid.')
  }
  if (typeof centralCommit !== 'string' || !COMMIT_PATTERN.test(centralCommit)) {
    fail('Central brand commit must be a full lowercase 40-character Git SHA.')
  }

  let canonicalRoot
  try {
    canonicalRoot = await realpath(brandRoot)
  } catch (error) {
    fail(`Central brand root path does not exist: ${brandRoot}.`, error)
  }
  if (!pathIsWithin(canonicalRoot, canonicalRoot)) fail('Central brand root path is invalid.')

  const manifestPaths = await manifestPathsUnder(canonicalRoot)
  if (manifestPaths.length === 0) fail('No central asset manifests were found under the allowed root path.')

  const matches = []
  for (const manifestPath of manifestPaths) {
    const manifest = parseManifest(await readFile(manifestPath, 'utf8'), manifestPath)
    for (const asset of manifest.assets) {
      if (asset && typeof asset === 'object' && asset.assetId === assetId) {
        matches.push({ manifest, manifestPath, asset })
      }
    }
  }

  if (matches.length === 0) fail(`Central asset ID was not found in an official manifest: ${assetId}.`)
  if (matches.length > 1) fail(`Central asset ID is duplicated across manifests: ${assetId}.`)

  const { manifest, manifestPath, asset } = matches[0]
  assertManifestIdentity(manifest, asset)

  if (asset.usageStatus !== 'candidate') {
    fail(`Central asset usage status is not eligible for candidate import: ${asset.usageStatus ?? '(missing)'}.`)
  }
  if (asset.privacyStatus !== 'official_reviewed') {
    fail('Central asset has not completed the official privacy review.')
  }
  if (!CLAIM_RISKS.has(asset.claimRisk)) fail('Central asset claim risk is missing or invalid.')
  if (!EXTERNAL_PUBLISH_STATES.has(asset.externalPublish)) {
    fail('Central asset external-publish review state is missing or invalid.')
  }

  const { extension, fileName, repositoryPath, mimeType } = mimeTypeForManifestAsset(asset)
  const absolutePath = path.resolve(canonicalRoot, ...repositoryPath.split('/'))
  if (!pathIsWithin(canonicalRoot, absolutePath)) fail('Central asset path escapes the allowed root path.')

  let canonicalAssetPath
  try {
    canonicalAssetPath = await realpath(absolutePath)
  } catch (error) {
    fail(`Central asset file does not exist at the manifest path: ${repositoryPath}.`, error)
  }
  if (!pathIsWithin(canonicalRoot, canonicalAssetPath)) {
    fail('Central asset symlink resolves outside the allowed root path.')
  }

  const fileStat = await stat(canonicalAssetPath)
  if (!fileStat.isFile()) fail('Central asset manifest path does not resolve to a regular file.')

  const buffer = await readFile(canonicalAssetPath)
  const inspection = await inspectContentAssetImage(buffer, mimeType).catch(error => {
    fail(`Central asset bytes failed validation: ${error instanceof Error ? error.message : 'unknown error'}.`, error)
  })

  if (manifestInteger(asset.byteSize, 'assets[].byteSize', 1) !== inspection.sizeBytes) {
    fail('Central asset byte size does not match its manifest.')
  }
  if (manifestInteger(asset.width, 'assets[].width', 1) !== inspection.width) {
    fail('Central asset width does not match its manifest.')
  }
  if (manifestInteger(asset.height, 'assets[].height', 1) !== inspection.height) {
    fail('Central asset height does not match its manifest.')
  }
  if (typeof asset.sha256 !== 'string' || !SHA256_PATTERN.test(asset.sha256)) {
    fail('Central asset manifest SHA-256 is missing or invalid.')
  }
  if (asset.sha256 !== inspection.checksumSha256) {
    fail('Central asset SHA-256 does not match its manifest.')
  }

  if (mimeType === 'image/gif') {
    if (manifestInteger(asset.gifFrameCount, 'assets[].gifFrameCount', 1) !== inspection.gifFrameCount) {
      fail('Central GIF frame count does not match its manifest.')
    }
  } else if (asset.gifFrameCount != null) {
    fail('Non-GIF central assets must not declare a GIF frame count.')
  }

  const requiresClaimReview = (
    asset.claimRisk !== 'low'
    || asset.externalPublish === 'requires_claim_freshness_check'
  )

  return {
    ...structuredClone(asset),
    assetId,
    brandRoot: canonicalRoot,
    manifestPath,
    manifestRelativePath: path.relative(canonicalRoot, manifestPath).split(path.sep).join('/'),
    manifestIdentity: {
      schema: manifest.schema,
      version: manifest.version,
      productId: manifest.productId,
      sourceId: manifest.sourceId,
      proofId: manifest.proofId,
    },
    absolutePath: canonicalAssetPath,
    repositoryPath,
    fileName,
    extension,
    mimeType,
    centralCommit,
    inspection,
    buffer,
    privacyStatus: asset.privacyStatus,
    usageStatus: asset.usageStatus,
    claimRisk: asset.claimRisk,
    externalPublish: asset.externalPublish,
    requiresClaimReview,
    promotionConsentChecked: false,
    provenance: officialBrandSource(asset, manifestPath, canonicalRoot, centralCommit),
  }
}

export function contentAssetOriginalExtension(asset) {
  return extensionForContentAssetMimeType(asset.mimeType)
}
