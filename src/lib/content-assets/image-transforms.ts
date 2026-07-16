import 'server-only'

import { randomUUID } from 'crypto'
import {
  CONTENT_ASSET_ALLOWED_IMAGE_TYPES,
  MAX_CONTENT_ASSET_ORIGINAL_BYTES,
  inspectContentAssetImage,
  sha256Hex,
} from './content-asset-validation.mjs'

export const CONTENT_ASSET_PRIVATE_BUCKET = 'content-assets-private'
export const CONTENT_ASSET_PUBLIC_BUCKET = 'content-assets-public'
export { CONTENT_ASSET_ALLOWED_IMAGE_TYPES, MAX_CONTENT_ASSET_ORIGINAL_BYTES, sha256Hex }

export type ContentAssetFileRole = 'original' | 'web' | 'thumbnail'

export type ContentAssetDerivative = {
  role: Exclude<ContentAssetFileRole, 'original'>
  buffer: Buffer
  mimeType: 'image/webp'
  width: number | null
  height: number | null
  sizeBytes: number
  checksumSha256: string
}

export type ContentAssetTransformResult = {
  original: {
    buffer: Buffer
    mimeType: string
    width: number | null
    height: number | null
    sizeBytes: number
    checksumSha256: string
  }
  web: ContentAssetDerivative
  thumbnail: ContentAssetDerivative
}

type TransformOptions = {
  webMaxWidth?: number
  thumbnailSize?: number
  webQuality?: number
  thumbnailQuality?: number
}

const DEFAULT_WEB_MAX_WIDTH = 1800
const DEFAULT_THUMBNAIL_SIZE = 480
const DEFAULT_WEB_QUALITY = 84
const DEFAULT_THUMBNAIL_QUALITY = 78

export function assertAllowedContentAssetImage(mimeType: string, sizeBytes: number) {
  if (!CONTENT_ASSET_ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error('Unsupported image format. Please upload JPG, PNG, WebP, GIF, HEIC, or HEIF.')
  }

  if (sizeBytes <= 0) {
    throw new Error('Empty image files cannot be uploaded.')
  }

  if (sizeBytes > MAX_CONTENT_ASSET_ORIGINAL_BYTES) {
    throw new Error('Images must be 100MB or smaller.')
  }
}

export function extensionForContentAssetMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/heic') return 'heic'
  if (mimeType === 'image/heif') return 'heif'
  return 'bin'
}

export function buildContentAssetObjectPath(params: {
  assetId: string
  role: ContentAssetFileRole
  extension: string
}) {
  const safeAssetId = params.assetId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!safeAssetId) {
    throw new Error('A valid asset id is required to build a storage object path.')
  }

  const safeExtension = params.extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  return `${safeAssetId}/${params.role}/${Date.now()}-${randomUUID()}.${safeExtension}`
}

async function toBuffer(source: Blob | ArrayBuffer | Buffer) {
  if (Buffer.isBuffer(source)) return source
  if (source instanceof ArrayBuffer) return Buffer.from(source)
  return Buffer.from(await source.arrayBuffer())
}

async function webpDerivative(params: {
  input: Buffer
  role: Exclude<ContentAssetFileRole, 'original'>
  maxWidth: number
  quality: number
  fit?: 'inside' | 'cover'
  height?: number
}) {
  const { default: sharp } = await import('sharp')
  // GIF derivatives are intentionally static poster/thumbnail images. The
  // original animated bytes remain in the private original role.
  const pipeline = sharp(params.input, { failOn: 'error', page: 0, pages: 1 }).rotate()

  if (params.fit === 'cover' && params.height) {
    pipeline.resize(params.maxWidth, params.height, {
      fit: 'cover',
      position: 'attention',
      withoutEnlargement: true,
    })
  } else {
    pipeline.resize({
      width: params.maxWidth,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  const buffer = await pipeline
    .webp({ quality: params.quality, effort: 4 })
    .toBuffer()

  const metadata = await sharp(buffer).metadata()

  return {
    role: params.role,
    buffer,
    mimeType: 'image/webp' as const,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    sizeBytes: buffer.byteLength,
    checksumSha256: sha256Hex(buffer),
  }
}

export async function transformContentAssetImage(
  source: Blob | ArrayBuffer | Buffer,
  mimeType: string,
  options: TransformOptions = {},
): Promise<ContentAssetTransformResult> {
  const input = await toBuffer(source)
  assertAllowedContentAssetImage(mimeType, input.byteLength)
  const inspection = await inspectContentAssetImage(input, mimeType)

  const web = await webpDerivative({
    input,
    role: 'web',
    maxWidth: options.webMaxWidth ?? DEFAULT_WEB_MAX_WIDTH,
    quality: options.webQuality ?? DEFAULT_WEB_QUALITY,
  })

  const thumbnailSize = options.thumbnailSize ?? DEFAULT_THUMBNAIL_SIZE
  const thumbnail = await webpDerivative({
    input,
    role: 'thumbnail',
    maxWidth: thumbnailSize,
    height: thumbnailSize,
    fit: 'cover',
    quality: options.thumbnailQuality ?? DEFAULT_THUMBNAIL_QUALITY,
  })

  return {
    original: {
      buffer: input,
      mimeType,
      width: inspection.width,
      height: inspection.height,
      sizeBytes: input.byteLength,
      checksumSha256: inspection.checksumSha256,
    },
    web,
    thumbnail,
  }
}
