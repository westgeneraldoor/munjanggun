'use server'

import 'server-only'

import { revalidatePath } from 'next/cache'

import {
  extensionForContentAssetMimeType,
  sha256Hex,
} from '@/lib/content-assets/content-asset-validation.mjs'
import { logError } from '@/lib/logger'
import {
  buildShowroomDerivativeObjectPath,
  buildShowroomOriginalObjectPath,
  SHOWROOM_IMAGE_VARIANT_SPECS,
  transformShowroomImage,
  type ShowroomImageTransformResult,
} from '@/lib/showroom/showroom-image-derivatives.mjs'
import {
  loadShowroomImageSources,
  originalShowroomImageSource,
  type ShowroomImageSource,
  type ShowroomImageSourceMap,
} from '@/lib/showroom/image-sources'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShowroomClient } from '@/lib/supabase/server'
import type { Json, ShowroomImageVariant } from '@/types/database'

const SHOWROOM_IMAGE_BUCKET = 'showroom-images'
const MAX_SHOWROOM_UPLOAD_BYTES = 10 * 1024 * 1024

export type ShowroomImageUploadResult =
  | { ok: true; source: ShowroomImageSource }
  | { ok: false; error: string }

type CommitImageDerivativesClient = {
  rpc(
    name: 'commit_image_derivatives',
    args: { p_source: Json; p_derivatives: Json },
  ): PromiseLike<{ error: unknown }>
}

async function requireAdministrator() {
  const supabase = await createShowroomClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('관리자 로그인이 필요합니다.')

  const { data: profile, error: profileError } = await supabase
    .schema('platform')
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || profile?.role !== 'administrator') {
    throw new Error('관리자 권한이 필요합니다.')
  }
}

function isAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { statusCode?: string | number; message?: string }
  return candidate.statusCode === 409
    || candidate.statusCode === '409'
    || /already exists|duplicate/i.test(candidate.message ?? '')
}

async function uploadImmutableObject(params: {
  path: string
  buffer: Buffer
  contentType: string
  checksumSha256: string
}) {
  const admin = createAdminClient()
  const bucket = admin.storage.from(SHOWROOM_IMAGE_BUCKET)
  const { error } = await bucket.upload(params.path, params.buffer, {
    cacheControl: '31536000',
    contentType: params.contentType,
    upsert: false,
  })

  if (error && !isAlreadyExistsError(error)) throw error

  if (error) {
    const { data: existing, error: downloadError } = await bucket.download(params.path)
    if (downloadError || !existing) {
      throw downloadError ?? new Error('Existing immutable object could not be verified.')
    }
    const existingChecksum = sha256Hex(Buffer.from(await existing.arrayBuffer()))
    if (existingChecksum !== params.checksumSha256) {
      throw new Error('Immutable object checksum mismatch.')
    }
  }

  return bucket.getPublicUrl(params.path).data.publicUrl
}

function derivativeMetadata(
  transformed: ShowroomImageTransformResult,
  uploadedUrls: Partial<Record<ShowroomImageVariant, string>>,
  uploadErrors: Partial<Record<ShowroomImageVariant, string>>,
) {
  return (Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS) as ShowroomImageVariant[]).map(variant => {
    const result = transformed.variants[variant]
    const spec = SHOWROOM_IMAGE_VARIANT_SPECS[variant]
    const uploadError = uploadErrors[variant]

    if (uploadError) {
      return {
        variant,
        recipe_version: transformed.recipeVersion,
        target_width: spec.width,
        transform_status: 'failed',
        transform_error: uploadError,
      }
    }

    if (result.status === 'skipped') {
      return {
        variant,
        recipe_version: transformed.recipeVersion,
        target_width: spec.width,
        transform_status: 'skipped',
        skip_reason: result.skipReason,
      }
    }

    return {
      variant,
      recipe_version: transformed.recipeVersion,
      target_width: spec.width,
      transform_status: 'ready',
      derivative_bucket: SHOWROOM_IMAGE_BUCKET,
      derivative_object_path: buildShowroomDerivativeObjectPath(
        transformed.original.checksumSha256,
        variant,
      ),
      public_url: uploadedUrls[variant],
      mime_type: result.mimeType,
      width: result.width,
      height: result.height,
      size_bytes: result.sizeBytes,
      checksum_sha256: result.checksumSha256,
    }
  })
}

export async function uploadShowroomImage(formData: FormData): Promise<ShowroomImageUploadResult> {
  try {
    await requireAdministrator()
    const value = formData.get('file')
    if (!(value instanceof File)) return { ok: false, error: '이미지 파일을 선택해 주세요.' }
    if (value.size <= 0 || value.size > MAX_SHOWROOM_UPLOAD_BYTES) {
      return { ok: false, error: '이미지 파일은 10MB 이하여야 합니다.' }
    }

    const sourceBuffer = Buffer.from(await value.arrayBuffer())
    const transformed = await transformShowroomImage(sourceBuffer, value.type)
    const extension = extensionForContentAssetMimeType(transformed.original.mimeType)
    const originalPath = buildShowroomOriginalObjectPath(
      transformed.original.checksumSha256,
      extension,
    )
    const originalUrl = await uploadImmutableObject({
      path: originalPath,
      buffer: transformed.original.buffer,
      contentType: transformed.original.mimeType,
      checksumSha256: transformed.original.checksumSha256,
    })

    const uploadedUrls: Partial<Record<ShowroomImageVariant, string>> = {}
    const uploadErrors: Partial<Record<ShowroomImageVariant, string>> = {}
    for (const variant of Object.keys(SHOWROOM_IMAGE_VARIANT_SPECS) as ShowroomImageVariant[]) {
      const derivative = transformed.variants[variant]
      if (derivative.status !== 'ready') continue
      try {
        const derivativePath = buildShowroomDerivativeObjectPath(
          transformed.original.checksumSha256,
          variant,
        )
        uploadedUrls[variant] = await uploadImmutableObject({
          path: derivativePath,
          buffer: derivative.buffer,
          contentType: derivative.mimeType,
          checksumSha256: derivative.checksumSha256,
        })
      } catch {
        uploadErrors[variant] = 'immutable derivative upload failed'
      }
    }

    const admin = createAdminClient()
    const derivatives = derivativeMetadata(transformed, uploadedUrls, uploadErrors)
    const commitClient = admin as unknown as CommitImageDerivativesClient
    const { error: commitError } = await commitClient.rpc('commit_image_derivatives', {
      p_source: {
        source_bucket: SHOWROOM_IMAGE_BUCKET,
        source_object_path: originalPath,
        source_url: originalUrl,
        source_mime_type: transformed.original.mimeType,
        source_size_bytes: transformed.original.sizeBytes,
        source_width: transformed.original.width,
        source_height: transformed.original.height,
        source_checksum_sha256: transformed.original.checksumSha256,
      } as Json,
      p_derivatives: derivatives as Json,
    })
    if (commitError) throw commitError

    if (Object.keys(uploadErrors).length > 0) {
      return {
        ok: false,
        error: '원본은 안전하게 보관했지만 일부 화면용 이미지 생성에 실패했습니다. 같은 파일로 다시 시도해 주세요.',
      }
    }

    const source: ShowroomImageSource = {
      originalUrl,
      variants: Object.fromEntries(
        (Object.keys(uploadedUrls) as ShowroomImageVariant[])
          .filter(variant => Boolean(uploadedUrls[variant]))
          .map(variant => {
            const result = transformed.variants[variant]
            if (result.status !== 'ready') return [variant, undefined]
            return [variant, {
              url: uploadedUrls[variant]!,
              width: result.width,
              height: result.height,
            }]
          }),
      ),
    }

    revalidatePath('/')
    revalidatePath('/admin/nodes')
    return { ok: true, source }
  } catch (error) {
    logError('Showroom image upload failed.', error)
    return {
      ok: false,
      error: error instanceof Error && /관리자/.test(error.message)
        ? error.message
        : '이미지 업로드에 실패했습니다. 파일 형식과 연결 상태를 확인해 주세요.',
    }
  }
}

export async function resolveAdminShowroomImageSources(
  candidateUrls: string[],
): Promise<ShowroomImageSourceMap> {
  const urls = [...new Set(candidateUrls.filter(url => /^https:\/\//.test(url)))].slice(0, 100)
  const fallback = Object.fromEntries(urls.map(url => [url, originalShowroomImageSource(url)]))
  if (urls.length === 0) return fallback
  try {
    await requireAdministrator()
    return await loadShowroomImageSources(createAdminClient(), urls)
  } catch {
    return fallback
  }
}
