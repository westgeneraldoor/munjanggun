import type { ShowroomImageVariant } from '@/types/database'

export const SHOWROOM_IMAGE_RECIPE_VERSION: 1
export const SHOWROOM_IMAGE_VARIANT_SPECS: Readonly<Record<ShowroomImageVariant, Readonly<{
  width: number
  quality: number
}>>>
