import { NextResponse } from 'next/server'
import { createPlatformClient } from '@/lib/supabase/platform-server'
import { logError } from '@/lib/logger'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/portal'

  // 오픈 리다이렉트 방지: next가 "/"로 시작하고 "//"로 시작해서는 안 됨
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/portal'
  }

  if (code) {
    try {
      const supabase = await createPlatformClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error) {
        const forwardTo = `${origin}${next}`
        return NextResponse.redirect(forwardTo)
      } else {
        logError('OAuth callback session exchange failed', error)
      }
    } catch (err) {
      logError('OAuth callback unexpected error', err)
    }
  }

  // 에러 발생 시 로그인 화면으로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
