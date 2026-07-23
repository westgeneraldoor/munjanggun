import type { BlogPostStatus } from '@/types/database'

const MANUAL_STATUS_TRANSITIONS: Readonly<Record<BlogPostStatus, readonly BlogPostStatus[]>> = {
  ai_draft: ['reviewing'],
  reviewing: ['needs_media', 'ready'],
  needs_media: ['reviewing', 'ready'],
  ready: ['reviewing', 'needs_media'],
  published: ['archived'],
  archived: ['reviewing'],
}

// Publication has a separate server action with the complete media, SEO, CTA,
// approval, and optimistic-concurrency gates. The general status action must
// never become another path to public publication.
export function isAllowedManualBlogStatusTransition(fromStatus: BlogPostStatus, toStatus: BlogPostStatus) {
  if (toStatus === 'published' || toStatus === 'archived') {
    return toStatus === 'archived' && fromStatus !== 'archived'
  }

  return MANUAL_STATUS_TRANSITIONS[fromStatus].includes(toStatus)
}
