import type {
  BlogRenderBlock,
  BlogRenderData,
  BlogRenderMedia,
  BlogRenderPost,
} from './blog-rendering'

export type BlogEditorPreviewBlock = Omit<BlogRenderBlock, 'id'> & {
  id: string
  clientId: string
}

export type BlogEditorPreviewMedia = Omit<BlogRenderMedia, 'url'> & {
  signedPreviewUrl: string | null
  publicUrl: string | null
}

export type BlogEditorPreviewInput = {
  post: BlogRenderPost
  blocks: BlogEditorPreviewBlock[]
  media: BlogEditorPreviewMedia[]
}

export const BLOG_ADMIN_PREVIEW_MEDIA_STATUSES = ['candidate', 'approved', 'published'] as const

function sortSignatureValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortSignatureValue)
  if (!value || typeof value !== 'object') return value

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      const entry = (value as Record<string, unknown>)[key]
      if (entry !== undefined) result[key] = sortSignatureValue(entry)
      return result
    }, {})
}

export function createStableEditorSignature(value: unknown) {
  return JSON.stringify(sortSignatureValue(value))
}

export function buildBlogEditorPreviewData({
  post,
  blocks,
  media,
}: BlogEditorPreviewInput): BlogRenderData {
  return {
    post,
    blocks: blocks.map((block, index) => ({
      id: block.id || block.clientId,
      type: block.type,
      headingLevel: block.headingLevel,
      text: block.text,
      mediaId: block.mediaId,
      metadata: block.metadata,
      displayOrder: index,
    })),
    // Both admin preview surfaces share this policy. Rejected media is excluded,
    // and preview media is only served through its same-origin opaque route.
    media: media
      .filter(item => BLOG_ADMIN_PREVIEW_MEDIA_STATUSES.some(status => status === item.usageStatus))
      .map(item => ({
        id: item.id,
        usageStatus: item.usageStatus,
        url: item.signedPreviewUrl,
        altText: item.altText,
        caption: item.caption,
        sourceLabel: item.sourceLabel,
        usedAsCover: item.usedAsCover,
      })),
    contentGraphSections: [],
    relatedPosts: [],
    nextPost: null,
  }
}
