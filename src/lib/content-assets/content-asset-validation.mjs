import { createHash } from 'node:crypto'

import sharp from 'sharp'

export const MAX_CONTENT_ASSET_ORIGINAL_BYTES = 100 * 1024 * 1024
export const MAX_CONTENT_ASSET_GIF_BYTES = 20 * 1024 * 1024
export const MAX_CONTENT_ASSET_DIMENSION = 20_000
export const MAX_CONTENT_ASSET_PIXELS = 100_000_000

export const CONTENT_ASSET_ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

export function sha256Hex(source) {
  return createHash('sha256').update(toBuffer(source)).digest('hex')
}

const GIT_LFS_POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1'

function toBuffer(source) {
  if (Buffer.isBuffer(source)) return source
  if (source instanceof Uint8Array) {
    return Buffer.from(source.buffer, source.byteOffset, source.byteLength)
  }
  if (source instanceof ArrayBuffer) return Buffer.from(source)
  throw new TypeError('Image input must be a Buffer, Uint8Array, or ArrayBuffer.')
}

function isGitLfsPointer(buffer) {
  return buffer.subarray(0, 128).toString('utf8').startsWith(GIT_LFS_POINTER_PREFIX)
}

function isoBmffBrand(buffer) {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') return null
  return buffer.subarray(8, 12).toString('ascii')
}

export function detectContentAssetMimeType(source) {
  const buffer = toBuffer(source)

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer.subarray(1, 4).toString('ascii') === 'PNG'
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }

  const gifHeader = buffer.subarray(0, 6).toString('ascii')
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') return 'image/gif'

  const brand = isoBmffBrand(buffer)
  if (brand && ['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic'
  if (brand && ['mif1', 'msf1'].includes(brand)) return 'image/heif'

  return null
}

function assertAllowedDeclaredMimeType(mimeType) {
  if (typeof mimeType !== 'string' || mimeType !== mimeType.trim().toLowerCase()) {
    throw new Error('Declared MIME type must be a normalized lowercase value.')
  }
  if (!CONTENT_ASSET_ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error(`Unsupported image MIME type: ${mimeType || '(empty)'}.`)
  }
}

function assertReasonableDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Image dimensions could not be validated.')
  }
  if (width > MAX_CONTENT_ASSET_DIMENSION || height > MAX_CONTENT_ASSET_DIMENSION) {
    throw new Error(`Image dimensions must not exceed ${MAX_CONTENT_ASSET_DIMENSION}px per side.`)
  }
  if (width * height > MAX_CONTENT_ASSET_PIXELS) {
    throw new Error(`Image dimensions exceed the ${MAX_CONTENT_ASSET_PIXELS}-pixel safety limit.`)
  }
}

export async function inspectContentAssetImage(source, declaredMimeType) {
  const buffer = toBuffer(source)
  assertAllowedDeclaredMimeType(declaredMimeType)

  if (isGitLfsPointer(buffer)) {
    throw new Error('The selected file is a Git LFS pointer, not the image bytes.')
  }
  if (buffer.byteLength === 0) throw new Error('Empty image files cannot be registered.')

  const sizeLimit = declaredMimeType === 'image/gif'
    ? MAX_CONTENT_ASSET_GIF_BYTES
    : MAX_CONTENT_ASSET_ORIGINAL_BYTES
  if (buffer.byteLength > sizeLimit) {
    throw new Error(`Image exceeds the ${Math.floor(sizeLimit / (1024 * 1024))}MB size limit.`)
  }

  const detectedMimeType = detectContentAssetMimeType(buffer)
  if (!detectedMimeType) throw new Error('Image file signature is unsupported or malformed.')

  const sameHeifFamily = (
    ['image/heic', 'image/heif'].includes(declaredMimeType)
    && ['image/heic', 'image/heif'].includes(detectedMimeType)
  )
  if (detectedMimeType !== declaredMimeType && !sameHeifFamily) {
    throw new Error(
      `The declared MIME type does not match the file signature (${declaredMimeType} vs ${detectedMimeType}).`,
    )
  }

  let metadata
  try {
    metadata = await sharp(buffer, { animated: declaredMimeType === 'image/gif', failOn: 'error' }).metadata()
  } catch (error) {
    throw new Error(`Image decoding failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  }

  const width = metadata.width ?? null
  const height = metadata.pageHeight ?? metadata.height ?? null
  assertReasonableDimensions(width, height)

  const frameCount = declaredMimeType === 'image/gif' ? (metadata.pages ?? 1) : null
  if (declaredMimeType === 'image/gif' && (!Number.isInteger(frameCount) || frameCount < 1)) {
    throw new Error('GIF frame count could not be validated.')
  }

  return {
    buffer,
    mimeType: declaredMimeType,
    detectedMimeType,
    sizeBytes: buffer.byteLength,
    width,
    height,
    gifFrameCount: frameCount,
    checksumSha256: sha256Hex(buffer),
  }
}

async function staticWebpDerivative(buffer, options) {
  const pipeline = sharp(buffer, {
    animated: false,
    failOn: 'error',
    page: 0,
    pages: 1,
  }).rotate()

  if (options.square) {
    pipeline.resize(options.width, options.width, {
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: true,
    })
  } else {
    pipeline.resize({ width: options.width, fit: 'inside', withoutEnlargement: true })
  }

  const derivedBuffer = await pipeline.webp({ quality: options.quality, effort: 4 }).toBuffer()
  const metadata = await sharp(derivedBuffer).metadata()
  assertReasonableDimensions(metadata.width ?? null, metadata.height ?? null)

  return {
    buffer: derivedBuffer,
    mimeType: 'image/webp',
    extension: 'webp',
    sizeBytes: derivedBuffer.byteLength,
    width: metadata.width,
    height: metadata.height,
    checksumSha256: sha256Hex(derivedBuffer),
  }
}

export async function createStaticContentAssetDerivatives(source) {
  const buffer = toBuffer(source)
  const [web, thumbnail] = await Promise.all([
    staticWebpDerivative(buffer, { width: 1800, quality: 84, square: false }),
    staticWebpDerivative(buffer, { width: 480, quality: 78, square: true }),
  ])
  return { web, thumbnail }
}

export function extensionForContentAssetMimeType(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'
  throw new Error(`Unsupported image MIME type: ${mimeType}.`)
}
