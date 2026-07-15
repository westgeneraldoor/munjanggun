import type { BlogBlockType, BlogContentCategory, BlogMediaUsageStatus, BlogPostStatus } from '@/types/database'
import type { BlogRenderData } from './blog-rendering'

type EditorPreviewPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  status: BlogPostStatus
  category: BlogContentCategory
  seoTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  primaryKeyword: string | null
  targetQuestion: string | null
  summaryAnswer: string | null
  serviceArea: string | null
  productType: string | null
}

type EditorPreviewBlock = {
  id: string
  type: BlogBlockType
  headingLevel: number | null
  text: string | null
  mediaId: string | null
  metadata: Record<string, string>
  displayOrder: number
}

type EditorPreviewMedia = {
  id: string
  usageStatus: BlogMediaUsageStatus
  signedPreviewUrl: string | null
  publicUrl: string | null
  altText: string | null
  caption: string | null
  sourceLabel: string | null
  usedAsCover: boolean
}

export function toBlogEditorPreviewData({
  post,
  blocks,
  media,
  relatedQuestions,
  publishedAt,
  updatedAt,
}: {
  post: EditorPreviewPost
  blocks: EditorPreviewBlock[]
  media: EditorPreviewMedia[]
  relatedQuestions: string[]
  publishedAt: string | null
  updatedAt: string
}): BlogRenderData {
  return {
    post: {
      ...post,
      relatedQuestions,
      publishedAt,
      updatedAt,
    },
    blocks: blocks.map(block => ({
      id: block.id,
      type: block.type,
      headingLevel: block.headingLevel,
      text: block.text,
      mediaId: block.mediaId,
      metadata: block.metadata,
      displayOrder: block.displayOrder,
    })),
    media: media.map(item => ({
      id: item.id,
      usageStatus: item.usageStatus,
      url: item.signedPreviewUrl ?? item.publicUrl,
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
