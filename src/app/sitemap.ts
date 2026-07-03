import type { MetadataRoute } from 'next'
import { getPublishedBlogPosts } from '@/lib/content-os/blog-rendering'
import { absoluteUrl } from '@/lib/content-os/site-url'

export const revalidate = 60

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedBlogPosts()

  return [
    {
      url: absoluteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/blog'),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/measure'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...posts.map(post => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.publishedAt || post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      images: post.coverMedia?.url ? [post.coverMedia.url] : undefined,
    })),
  ]
}
