import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BlogPostRenderer from '@/components/blog/BlogPostRenderer'
import { getPublishedBlogPostBySlug, getPublishedBlogPosts, resolvePublicBlogPresentation, type BlogPublicPresentation } from '@/lib/content-os/blog-rendering'

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function buildJsonLd(presentation: BlogPublicPresentation) {
  const primaryImage = presentation.primaryImage?.url

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: presentation.title,
      description: presentation.description,
      ...(primaryImage ? { image: [primaryImage] } : {}),
      ...(presentation.publishedAt ? { datePublished: presentation.publishedAt } : {}),
      dateModified: presentation.modifiedAt,
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
        '@id': presentation.canonicalUrl,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: presentation.breadcrumbs.map((breadcrumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: breadcrumb.name,
        item: breadcrumb.url,
      })),
    },
  ]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublishedBlogPostBySlug(slug)

  if (!data) {
    notFound()
  }

  const presentation = resolvePublicBlogPresentation(data)
  const primaryImage = presentation.primaryImage?.url

  return {
    title: presentation.title,
    description: presentation.description,
    alternates: {
      canonical: presentation.canonicalUrl,
    },
    openGraph: {
      title: presentation.title,
      description: presentation.description,
      url: presentation.canonicalUrl,
      type: 'article',
      publishedTime: presentation.publishedAt ?? undefined,
      modifiedTime: presentation.modifiedAt,
      ...(primaryImage ? { images: [primaryImage] } : {}),
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const [data, searchPosts] = await Promise.all([
    getPublishedBlogPostBySlug(slug),
    getPublishedBlogPosts(),
  ])

  if (!data) {
    notFound()
  }

  const presentation = resolvePublicBlogPresentation(data)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJsonLd(presentation)) }}
      />
      <BlogPostRenderer data={data} mode="public" searchPosts={searchPosts} />
    </>
  )
}
