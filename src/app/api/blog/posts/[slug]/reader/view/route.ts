import { NextRequest, NextResponse } from 'next/server'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ slug: string }>
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function POST(_request: NextRequest, context: RouteContext) {
  const { slug: rawSlug } = await context.params
  const slug = rawSlug.trim()

  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: 'Invalid blog post.' }, { status: 400 })
  }

  const platform = await createPlatformClient()
  const { data: { user }, error: authError } = await platform.auth.getUser()
  if (authError || !user) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    const showroom = createShowroomAdminClient()
    const { data, error: postError } = await showroom
      .from('blog_posts')
      .select('id, slug, title, excerpt, published_at')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    const post = data as {
      id: string
      slug: string
      title: string
      excerpt: string | null
      published_at: string | null
    } | null

    if (postError) throw postError
    if (!post) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 })

    const { error } = await platform.from('blog_article_recent_views').upsert({
      user_id: user.id,
      post_id: post.id,
      post_slug: post.slug,
      post_title_snapshot: post.title,
      post_excerpt_snapshot: post.excerpt,
      post_published_at_snapshot: post.published_at,
      last_viewed_at: new Date().toISOString(),
    } as never, { onConflict: 'user_id,post_id' })

    if (error) throw error
    return NextResponse.json({ recorded: true })
  } catch (error) {
    logError('Blog reader view POST error', error)
    return NextResponse.json({ error: 'Recent view could not be recorded.' }, { status: 500 })
  }
}
