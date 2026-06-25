import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BlogPostRenderer from '@/components/blog/BlogPostRenderer'
import { getPublishedBlogPostBySlug, type BlogRenderData } from '@/lib/content-os/blog-rendering'
import { absoluteUrl } from '@/lib/content-os/site-url'

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function getDescription(data: BlogRenderData) {
  return data.post.metaDescription || data.post.excerpt || data.post.summaryAnswer || data.post.title
}

function getCanonicalUrl(data: BlogRenderData) {
  return data.post.canonicalUrl || absoluteUrl(`/blog/${data.post.slug}`)
}

function getCoverImages(data: BlogRenderData) {
  return data.media
    .filter(media => media.url)
    .map(media => media.url as string)
}

function buildJsonLd(data: BlogRenderData) {
  const canonicalUrl = getCanonicalUrl(data)
  const description = getDescription(data)
  const images = getCoverImages(data)

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: data.post.title,
      description,
      image: images,
      datePublished: data.post.publishedAt,
      dateModified: data.post.updatedAt,
      author: {
        '@type': 'Organization',
        name: '문장군',
      },
      publisher: {
        '@type': 'Organization',
        name: '문장군',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: absoluteUrl('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: absoluteUrl('/blog'),
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: data.post.title,
          item: canonicalUrl,
        },
      ],
    },
  ]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublishedBlogPostBySlug(slug)

  if (!data) {
    notFound()
  }

  const title = data.post.seoTitle || data.post.title
  const description = getDescription(data)
  const canonicalUrl = getCanonicalUrl(data)
  const images = getCoverImages(data)

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
      publishedTime: data.post.publishedAt ?? undefined,
      modifiedTime: data.post.updatedAt,
      images,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const data = await getPublishedBlogPostBySlug(slug)

  if (!data) {
    notFound()
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJsonLd(data)) }}
      />
      <BlogPostRenderer data={data} mode="public" />
    </>
  )
}
