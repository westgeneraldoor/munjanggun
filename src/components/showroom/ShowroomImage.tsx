'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'

import {
  originalShowroomImageSource,
  resolveShowroomImageUrl,
  type ShowroomImageSource,
} from '@/lib/showroom/image-sources'
import type { ShowroomImageVariant } from '@/types/database'

type ShowroomImageProps = Omit<ImageProps, 'src' | 'unoptimized'> & {
  source: ShowroomImageSource | string
  purpose: ShowroomImageVariant
}

export default function ShowroomImage({
  source,
  purpose,
  alt,
  onError,
  ...props
}: ShowroomImageProps) {
  const normalizedSource = typeof source === 'string'
    ? originalShowroomImageSource(source)
    : source
  const preferredUrl = resolveShowroomImageUrl(normalizedSource, purpose)
  const [failedDerivativeUrl, setFailedDerivativeUrl] = useState<string | null>(null)
  const fallbackToOriginal = failedDerivativeUrl === preferredUrl
    && preferredUrl !== normalizedSource.originalUrl
  const src = fallbackToOriginal ? normalizedSource.originalUrl : preferredUrl

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized
      data-showroom-image-purpose={purpose}
      data-showroom-image-fallback={fallbackToOriginal ? 'original' : undefined}
      onError={event => {
        onError?.(event)
        if (preferredUrl !== normalizedSource.originalUrl) {
          setFailedDerivativeUrl(preferredUrl)
        }
      }}
    />
  )
}
