import type { BlogRenderData, BlogRenderMedia } from './blog-rendering'

export type BlogPublicBreadcrumb = {
  name: string
  href: string
  url: string
}

export type BlogPublicPresentation = {
  headline: string
  metadataTitle: string
  description: string
  summaryAnswer: string | null
  canonicalUrl: string
  primaryImage: BlogRenderMedia | null
  publishedAt: string | null
  modifiedAt: string
  breadcrumbs: BlogPublicBreadcrumb[]
}

type AbsoluteUrlBuilder = (path: string) => string

export function resolvePublicBlogPresentation(
  data: BlogRenderData,
  absoluteUrl: AbsoluteUrlBuilder,
): BlogPublicPresentation {
  const canonicalUrl = data.post.canonicalUrl || absoluteUrl(`/blog/${data.post.slug}`)
  const headline = data.post.title

  return {
    headline,
    metadataTitle: data.post.seoTitle || headline,
    description: data.post.metaDescription || data.post.excerpt || data.post.summaryAnswer || headline,
    summaryAnswer: data.post.summaryAnswer,
    canonicalUrl,
    primaryImage: data.media.find(media => media.usedAsCover && media.url) ?? null,
    publishedAt: data.post.publishedAt,
    modifiedAt: data.post.updatedAt,
    breadcrumbs: [
      { name: '홈', href: '/', url: absoluteUrl('/') },
      { name: '블로그', href: '/blog', url: absoluteUrl('/blog') },
      { name: headline, href: `/blog/${data.post.slug}`, url: canonicalUrl },
    ],
  }
}
