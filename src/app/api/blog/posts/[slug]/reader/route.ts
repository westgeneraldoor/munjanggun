import { NextRequest, NextResponse } from 'next/server'
import { createPlatformAdminClient, createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ slug: string }>
}

type ToggleBody = {
  helpful?: boolean
  saved?: boolean
}

type QuestionBody = {
  question?: string
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeSlug(slug: string) {
  const value = slug.trim()
  return SLUG_PATTERN.test(value) ? value : null
}

async function getPublishedPost(slug: string) {
  const showroom = createShowroomAdminClient()
  const { data, error } = await showroom
    .from('blog_posts')
    .select('id, slug, title, excerpt, published_at, status')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw error
  return data as {
    id: string
    slug: string
    title: string
    excerpt: string | null
    published_at: string | null
    status: 'published'
  } | null
}

async function getUserId() {
  const supabase = await createPlatformClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

async function getReaderPayload(postId: string, userId: string | null) {
  const platform = createPlatformAdminClient()

  const [helpfulCountResult, questionCountResult] = await Promise.all([
    platform
      .from('blog_article_helpful_votes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId),
    userId
      ? platform
        .from('blog_article_questions')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId)
        .eq('user_id', userId)
      : Promise.resolve({ count: 0, error: null }),
  ])

  if (helpfulCountResult.error) throw helpfulCountResult.error
  if (questionCountResult.error) throw questionCountResult.error

  let viewer = null as null | {
    isAuthenticated: true
    helpful: boolean
    saved: boolean
    privateQuestionCount: number
  }

  if (userId) {
    const [helpfulResult, savedResult] = await Promise.all([
      platform
        .from('blog_article_helpful_votes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle(),
      platform
        .from('blog_article_saves')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle(),
    ])

    if (helpfulResult.error) throw helpfulResult.error
    if (savedResult.error) throw savedResult.error

    viewer = {
      isAuthenticated: true,
      helpful: Boolean(helpfulResult.data),
      saved: Boolean(savedResult.data),
      privateQuestionCount: questionCountResult.count ?? 0,
    }
  }

  return {
    counts: {
      helpful: helpfulCountResult.count ?? 0,
    },
    viewer,
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug: rawSlug } = await context.params
  const slug = normalizeSlug(rawSlug)

  if (!slug) {
    return NextResponse.json({ error: 'Invalid blog post.' }, { status: 400 })
  }

  try {
    const post = await getPublishedPost(slug)
    if (!post) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 })

    const userId = await getUserId()
    return NextResponse.json(await getReaderPayload(post.id, userId))
  } catch (error) {
    logError('Blog reader GET error', error)
    return NextResponse.json({ error: 'Reader activity could not be loaded.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { slug: rawSlug } = await context.params
  const slug = normalizeSlug(rawSlug)

  if (!slug) {
    return NextResponse.json({ error: 'Invalid blog post.' }, { status: 400 })
  }

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Login is required.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as ToggleBody | null
  const hasHelpful = typeof body?.helpful === 'boolean'
  const hasSaved = typeof body?.saved === 'boolean'

  if (!hasHelpful && !hasSaved) {
    return NextResponse.json({ error: 'No reader action was provided.' }, { status: 400 })
  }

  try {
    const post = await getPublishedPost(slug)
    if (!post) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 })

    const platform = createPlatformAdminClient()

    if (hasHelpful) {
      if (body.helpful) {
        const { error } = await platform.from('blog_article_helpful_votes').upsert({
          user_id: userId,
          post_id: post.id,
          post_slug: post.slug,
          post_title_snapshot: post.title,
        } as never, { onConflict: 'user_id,post_id' })
        if (error) throw error
      } else {
        const { error } = await platform
          .from('blog_article_helpful_votes')
          .delete()
          .eq('user_id', userId)
          .eq('post_id', post.id)
        if (error) throw error
      }
    }

    if (hasSaved) {
      if (body.saved) {
        const { error } = await platform.from('blog_article_saves').upsert({
          user_id: userId,
          post_id: post.id,
          post_slug: post.slug,
          post_title_snapshot: post.title,
          post_excerpt_snapshot: post.excerpt,
          post_published_at_snapshot: post.published_at,
        } as never, { onConflict: 'user_id,post_id' })
        if (error) throw error
      } else {
        const { error } = await platform
          .from('blog_article_saves')
          .delete()
          .eq('user_id', userId)
          .eq('post_id', post.id)
        if (error) throw error
      }
    }

    return NextResponse.json(await getReaderPayload(post.id, userId))
  } catch (error) {
    logError('Blog reader PATCH error', error)
    return NextResponse.json({ error: 'Reader activity could not be saved.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug: rawSlug } = await context.params
  const slug = normalizeSlug(rawSlug)

  if (!slug) {
    return NextResponse.json({ error: 'Invalid blog post.' }, { status: 400 })
  }

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Login is required.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as QuestionBody | null
  const question = body?.question?.trim() ?? ''

  if (question.length < 2 || question.length > 2000) {
    return NextResponse.json({ error: 'Question length is invalid.' }, { status: 400 })
  }

  try {
    const post = await getPublishedPost(slug)
    if (!post) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 })

    const platform = createPlatformAdminClient()
    const { data, error } = await platform
      .from('blog_article_questions')
      .insert({
        user_id: userId,
        post_id: post.id,
        post_slug: post.slug,
        post_title_snapshot: post.title,
        question_body: question,
        status: 'private',
      } as never)
      .select('id')
      .single()

    if (error) throw error

    const payload = await getReaderPayload(post.id, userId)
    return NextResponse.json({
      ...payload,
      question: data,
    }, { status: 201 })
  } catch (error) {
    logError('Blog reader POST error', error)
    return NextResponse.json({ error: 'Private question could not be saved.' }, { status: 500 })
  }
}
