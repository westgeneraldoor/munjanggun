export type ShowroomImageVariant = 'thumbnail' | 'card' | 'display' | 'large'
export type ShowroomImageSkipReason = 'no-upscale' | 'not-smaller' | 'animated-or-gif'

export {
  SHOWROOM_IMAGE_RECIPE_VERSION,
  SHOWROOM_IMAGE_VARIANT_SPECS,
} from './showroom-image-contract.mjs'

export type ReadyShowroomImageDerivative = {
  status: 'ready'
  skipReason: null
  mimeType: 'image/webp'
  buffer: Buffer
  width: number
  height: number
  sizeBytes: number
  checksumSha256: string
}

export type SkippedShowroomImageDerivative = {
  status: 'skipped'
  skipReason: ShowroomImageSkipReason
  mimeType: null
  buffer: null
  width: null
  height: null
  sizeBytes: null
  checksumSha256: null
}

export type ShowroomImageTransformResult = {
  recipeVersion: number
  original: {
    buffer: Buffer
    mimeType: string
    width: number
    height: number
    sizeBytes: number
    checksumSha256: string
  }
  variants: Record<ShowroomImageVariant, ReadyShowroomImageDerivative | SkippedShowroomImageDerivative>
}

export function buildShowroomOriginalObjectPath(checksum: string, extension: string): string
export function buildShowroomDerivativeObjectPath(checksum: string, variant: ShowroomImageVariant): string
export function transformShowroomImage(source: Buffer | Uint8Array | ArrayBuffer, declaredMimeType: string): Promise<ShowroomImageTransformResult>
