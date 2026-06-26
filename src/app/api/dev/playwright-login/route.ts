import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  administrator: 'Playwright 관리자',
  sales_manager: 'Playwright 영업담당자',
  customer: 'Playwright 고객',
}

function isLocalRequest(url: URL) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1'
}

function getSafeNext(rawNext: string | null, role: string) {
  const fallback = role === 'administrator' ? '/admin/platform/settings' : '/portal'
  if (!rawNext) return fallback
  if (!rawNext.startsWith('/') || rawNext.startsWith('//')) return fallback
  return rawNext
}

async function findUserByEmail(email: string) {
  const adminAuth = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await adminAuth.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const user = data.users.find(candidate => candidate.email?.toLowerCase() === email.toLowerCase())
    if (user) return { adminAuth, user }
    if (data.users.length < 200) break
  }

  return { adminAuth, user: null as User | null }
}

async function ensureDevUser(role: 'administrator' | 'sales_manager' | 'customer') {
  const email = `playwright-${role}@munjanggun.local`
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? 'Munjanggun-Playwright-2026!'
  const { adminAuth, user: existingUser } = await findUserByEmail(email)

  let user = existingUser
  if (!user) {
    const { data, error } = await adminAuth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: ROLE_LABEL[role],
        source: 'playwright-dev-login',
      },
    })
    if (error || !data.user) throw error ?? new Error('Playwright test user was not created.')
    user = data.user
  } else {
    const { data, error } = await adminAuth.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        full_name: ROLE_LABEL[role],
        source: 'playwright-dev-login',
      },
    })
    if (error || !data.user) throw error ?? new Error('Playwright test user was not updated.')
    user = data.user
  }

  const platformAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'platform' } }
  )

  const profilePayload = {
    id: user.id,
    email,
    display_name: ROLE_LABEL[role],
    role,
  } as Database['platform']['Tables']['profiles']['Insert']

  const { error: profileError } = await platformAdmin
    .from('profiles')
    .upsert(profilePayload)

  if (profileError) throw profileError

  return { email, password }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  if (process.env.NODE_ENV === 'production' || !isLocalRequest(url)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const configuredToken = process.env.PLAYWRIGHT_LOGIN_TOKEN
  if (configuredToken && url.searchParams.get('token') !== configuredToken) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const requestedRole = url.searchParams.get('role') ?? 'administrator'
  if (!['administrator', 'sales_manager', 'customer'].includes(requestedRole)) {
    return NextResponse.json({ error: 'Unsupported role' }, { status: 400 })
  }

  const role = requestedRole as 'administrator' | 'sales_manager' | 'customer'
  const nextPath = getSafeNext(url.searchParams.get('next'), role)
  const redirectTo = new URL(nextPath, url.origin)
  const response = NextResponse.redirect(redirectTo)

  try {
    const { email, password } = await ensureDevUser(role)
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

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      logError('Playwright dev login sign-in failed', error)
      return NextResponse.json({ error: 'Dev login failed' }, { status: 500 })
    }

    return response
  } catch (err) {
    logError('Playwright dev login unexpected error', err)
    return NextResponse.json({ error: 'Dev login setup failed' }, { status: 500 })
  }
}
