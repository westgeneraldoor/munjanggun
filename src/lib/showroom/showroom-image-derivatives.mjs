import sharp from 'sharp'

import {
  inspectContentAssetImage,
  sha256Hex,
} from '../content-assets/content-asset-validation.mjs'
import {
  SHOWROOM_IMAGE_RECIPE_VERSION,
  SHOWROOM_IMAGE_VARIANT_SPECS,
} from './showroom-image-contract.mjs'

export { SHOWROOM_IMAGE_RECIPE_VERSION, SHOWROOM_IMAGE_VARIANT_SPECS }

const VARIANTS = Object.freeze(Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS))

function assertChecksum(checksum) {
  if (!/^[a-f0-9]{64}$/.test(checksum)) {
    throw new Error('A lowercase SHA-256 checksum is required.')
  }
}

function assertVariant(variant) {
  if (!VARIANTS.includes(variant)) {
    throw new Error(`Unsupported showroom image variant: ${variant}.`)
  }
}

export function buildShowroomOriginalObjectPath(checksum, extension) {
  assertChecksum(checksum)
  if (!/^[a-z0-9]+$/.test(extension)) throw new Error('A safe image extension is required.')
  return `showroom-originals/v${SHOWROOM_IMAGE_RECIPE_VERSION}/${checksum}.${extension}`
}

export function buildShowroomDerivativeObjectPath(checksum, variant) {
  assertChecksum(checksum)
  assertVariant(variant)
  return `showroom-derivatives/v${SHOWROOM_IMAGE_RECIPE_VERSION}/${checksum}/${variant}.webp`
}

function skippedVariant(skipReason) {
  return {
    status: 'skipped',
    skipReason,
    mimeType: null,
    buffer: null,
    width: null,
    height: null,
    sizeBytes: null,
    checksumSha256: null,
  }
}

async function isAnimatedWebp(buffer, mimeType) {
  if (mimeType !== 'image/webp') return false
  const metadata = await sharp(buffer, { animated: true, failOn: 'error' }).metadata()
  return (metadata.pages ?? 1) > 1
}

async function orientedDimensions(buffer, inspected) {
  const metadata = await sharp(buffer, { animated: false, failOn: 'error' }).metadata()
  const swapsAxes = [5, 6, 7, 8].includes(metadata.orientation ?? 1)
  return {
    width: swapsAxes ? inspected.height : inspected.width,
    height: swapsAxes ? inspected.width : inspected.height,
  }
}

async function createVariant(buffer, source, variant) {
  const spec = SHOWROOM_IMAGE_VARIANT_SPECS[variant]
  if (source.width <= spec.width) return skippedVariant('no-upscale')

  const derivativeBuffer = await sharp(buffer, {
    animated: false,
    failOn: 'error',
    page: 0,
    pages: 1,
  })
    .rotate()
    .resize({ width: spec.width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: spec.quality, effort: 4 })
    .toBuffer()

  const metadata = await sharp(derivativeBuffer, { failOn: 'error' }).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`The ${variant} derivative dimensions could not be read.`)
  }

  if (derivativeBuffer.byteLength >= buffer.byteLength) {
    return skippedVariant('not-smaller')
  }

  return {
    status: 'ready',
    skipReason: null,
    mimeType: 'image/webp',
    buffer: derivativeBuffer,
    width: metadata.width,
    height: metadata.height,
    sizeBytes: derivativeBuffer.byteLength,
    checksumSha256: sha256Hex(derivativeBuffer),
  }
}

export async function transformShowroomImage(source, declaredMimeType) {
  const inspected = await inspectContentAssetImage(source, declaredMimeType)
  const dimensions = await orientedDimensions(inspected.buffer, inspected)
  const orientedSource = { ...inspected, ...dimensions }
  const animationPassthrough = declaredMimeType === 'image/gif'
    || await isAnimatedWebp(inspected.buffer, declaredMimeType)

  const variants = {}
  for (const variant of VARIANTS) {
    variants[variant] = animationPassthrough
      ? skippedVariant('animated-or-gif')
      : await createVariant(inspected.buffer, orientedSource, variant)
  }

  return {
    recipeVersion: SHOWROOM_IMAGE_RECIPE_VERSION,
    original: {
      buffer: inspected.buffer,
      mimeType: inspected.mimeType,
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: inspected.sizeBytes,
      checksumSha256: inspected.checksumSha256,
    },
    variants,
  }
}
