import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'
import { Database } from '@/types/database'
import { getSafeInternalPath } from '@/lib/safe-internal-path'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = getSafeInternalPath(searchParams.get('next'))

  if (code) {
    const response = NextResponse.redirect(new URL(next, origin))

    try {
      const supabase = createServerClient<Database, 'platform'>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          db: { schema: 'platform' },
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options)
              })
            },
          },
        }
      )

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        return response
      }

      logError('OAuth callback session exchange failed', error)
    } catch (err) {
      logError('OAuth callback unexpected error', err)
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
}
