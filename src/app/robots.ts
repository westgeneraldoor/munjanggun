import type { MetadataRoute } from 'next'
import { absoluteUrl, getSiteUrl } from '@/lib/content-os/site-url'

export const revalidate = 3600

const privatePaths = ['/admin/', '/api/', '/preview/', '/drafts/', '/private/']

export default function robots(): MetadataRoute.Robots {
  const siteHost = new URL(getSiteUrl()).host

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privatePaths,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: privatePaths,
      },
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteHost,
  }
}
