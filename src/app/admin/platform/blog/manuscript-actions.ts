'use server'

import { revalidatePath } from 'next/cache'
import {
  registerApprovedManuscript,
  requireApprovedManuscriptAdministrator,
  type ApprovedManuscriptPayload,
  type ApprovedManuscriptResult,
} from '@/lib/content-os/approved-manuscript'
import { validateBlogClaimSafety } from '@/lib/content-os/blog-claim-safety'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { createShowroomAdminClient } from '@/lib/supabase/showroom-admin-server'

async function requireAdministrator() {
  const platformClient = await createPlatformClient()
  const { data: { user } } = await platformClient.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data: profileData } = await platformClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role?: string } | null
  requireApprovedManuscriptAdministrator(profile?.role)

  return user.id
}

export async function createApprovedManuscript(payload: ApprovedManuscriptPayload): Promise<ApprovedManuscriptResult> {
  try {
    const actorId = await requireAdministrator()
    const showroomAdmin = createShowroomAdminClient()
    const result = await registerApprovedManuscript(payload, actorId, {
      validateClaimSafety(input) {
        return validateBlogClaimSafety({
          mode: 'draft',
          title: input.title,
          textSegments: input.textSegments,
          sourceEvidence: input.sourceEvidence,
        })
      },
      async insertPost(post) {
        const { data, error } = await showroomAdmin
          .from('blog_posts')
          .insert(post as never)
          .select('id')
          .single()

        if (error || !data) throw new Error('blog post insert failed')
        return { id: (data as { id: string }).id }
      },
      async insertBlocks(blocks) {
        const { error } = await showroomAdmin
          .from('blog_blocks')
          .insert(blocks as never)

        if (error) throw new Error('blog blocks insert failed')
      },
      async insertEvent(event) {
        const { error } = await showroomAdmin
          .from('blog_post_events')
          .insert(event as never)

        if (error) throw new Error('blog event insert failed')
      },
      async deletePost(postId) {
        const { error } = await showroomAdmin
          .from('blog_posts')
          .delete()
          .eq('id', postId)

        if (error) throw new Error('blog post compensation delete failed')
      },
    }, new Date().toISOString())

    if (result.ok && result.postId) {
      revalidatePath('/admin/platform/blog')
      revalidatePath(`/admin/platform/blog/${result.postId}`)
      revalidatePath(`/admin/platform/blog/${result.postId}/preview`)
    }

    return result
  } catch {
    return {
      ok: false,
      message: '승인 원고 등록 권한 또는 저장 상태를 확인하지 못했습니다.',
      postId: null,
      issues: [],
    }
  }
}
