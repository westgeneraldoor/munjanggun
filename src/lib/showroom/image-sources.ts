import { logError } from '@/lib/logger'
import type { Database, ShowroomImageVariant } from '@/types/database'
import { SHOWROOM_IMAGE_RECIPE_VERSION } from './showroom-image-contract.mjs'

export type ShowroomImageVariantSource = {
  url: string
  width: number
  height: number
}

export type ShowroomImageSource = {
  originalUrl: string
  variants: Partial<Record<ShowroomImageVariant, ShowroomImageVariantSource>>
}

export type ShowroomImageSourceMap = Record<string, ShowroomImageSource>

type PreviewDerivativeRow = Database['showroom']['Functions']['resolve_preview_image_derivatives']['Returns'][number]
type ImageSourceRow = Pick<Database['showroom']['Tables']['image_sources']['Row'], 'id' | 'source_url'>
type ImageDerivativeRow = Pick<
  Database['showroom']['Tables']['image_derivatives']['Row'],
  'source_id' | 'variant' | 'recipe_version' | 'public_url' | 'width' | 'height'
>
type QueryResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>
type SourceQueryClient = {
  from(name: 'image_sources'): {
    select(columns: string): {
      in(column: 'source_url', values: string[]): QueryResult<ImageSourceRow>
    }
  }
}
type DerivativeFilter = QueryResult<ImageDerivativeRow> & {
  eq(column: 'recipe_version', value: number): DerivativeFilter
  not(column: 'public_url', operator: 'is', value: null): DerivativeFilter
}
type DerivativeQueryClient = {
  from(name: 'image_derivatives'): {
    select(columns: string): {
      in(column: 'source_id', values: string[]): DerivativeFilter
    }
  }
}
type PreviewQueryClient = {
  rpc(
    name: 'resolve_preview_image_derivatives',
    args: { p_token: string; p_source_urls: string[] },
  ): PromiseLike<{ data: PreviewDerivativeRow[] | null; error: unknown }>
}

const QUERY_CHUNK_SIZE = 100

export function originalShowroomImageSource(originalUrl: string): ShowroomImageSource {
  return { originalUrl, variants: {} }
}

export function resolveShowroomImageUrl(
  source: ShowroomImageSource | string,
  purpose: ShowroomImageVariant,
) {
  if (typeof source === 'string') return source
  return source.variants[purpose]?.url ?? source.originalUrl
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  return [...new Set(urls.filter((url): url is string => (
    typeof url === 'string' && /^https:\/\//.test(url)
  )))]
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

function isDerivativeSchemaUnavailable(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  const code = (error as { code?: unknown }).code
  return code === 'PGRST202' || code === 'PGRST205'
}

function applyRows(
  result: ShowroomImageSourceMap,
  rows: Array<{
    source_url: string
    variant: string
    public_url: string | null
    width: number | null
    height: number | null
  }>,
) {
  for (const row of rows) {
    if (
      !result[row.source_url]
      || !['thumbnail', 'card', 'display', 'large'].includes(row.variant)
      || !row.public_url
      || !row.width
      || !row.height
    ) continue

    result[row.source_url].variants[row.variant as ShowroomImageVariant] = {
      url: row.public_url,
      width: row.width,
      height: row.height,
    }
  }
}

export async function loadShowroomImageSources(
  client: unknown,
  candidateUrls: Array<string | null | undefined>,
  options: { previewToken?: string } = {},
): Promise<ShowroomImageSourceMap> {
  const urls = uniqueUrls(candidateUrls)
  const result = Object.fromEntries(urls.map(url => [url, originalShowroomImageSource(url)]))
  if (urls.length === 0) return result

  try {
    if (options.previewToken) {
      for (const urlChunk of chunks(urls, QUERY_CHUNK_SIZE)) {
        const previewClient = client as PreviewQueryClient
        const { data, error } = await previewClient.rpc('resolve_preview_image_derivatives', {
          p_token: options.previewToken,
          p_source_urls: urlChunk,
        })
        if (error) throw error
        applyRows(result, (data ?? []) as PreviewDerivativeRow[])
      }
      return result
    }

    for (const urlChunk of chunks(urls, QUERY_CHUNK_SIZE)) {
      const sourceClient = client as SourceQueryClient
      const { data: sources, error: sourceError } = await sourceClient
        .from('image_sources')
        .select('id, source_url')
        .in('source_url', urlChunk)
      if (sourceError) throw sourceError
      if (!sources || sources.length === 0) continue

      const sourceById = new Map(sources.map(source => [source.id, source.source_url]))
      const derivativeClient = client as DerivativeQueryClient
      const { data: derivatives, error: derivativeError } = await derivativeClient
        .from('image_derivatives')
        .select('source_id, variant, recipe_version, public_url, width, height')
        .in('source_id', [...sourceById.keys()])
        .eq('recipe_version', SHOWROOM_IMAGE_RECIPE_VERSION)
        .not('public_url', 'is', null)
      if (derivativeError) throw derivativeError

      applyRows(result, (derivatives ?? []).map(derivative => ({
        source_url: sourceById.get(derivative.source_id) ?? '',
        variant: derivative.variant,
        public_url: derivative.public_url,
        width: derivative.width,
        height: derivative.height,
      })))
    }
  } catch (error) {
    // A missing migration, RLS denial, or transient database error must not
    // break the showroom. The canonical source URLs remain the safe fallback.
    // Missing table/RPC is expected while application and migration rollouts
    // overlap, so keep that compatibility path quiet in the browser console.
    if (!isDerivativeSchemaUnavailable(error)) {
      logError('Failed to load showroom image derivatives; using source URLs.', error)
    }
  }

  return result
}
