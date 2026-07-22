import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function getSafeNextPath(request: NextRequest) {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  if (!nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/portal'
  }
  return nextPath
}

function getCustomerLoginUrl(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', getSafeNextPath(request))
  return loginUrl
}

function getSafeLoginNextParam(request: NextRequest) {
  const nextParam = request.nextUrl.searchParams.get('next')
  if (!nextParam || !nextParam.startsWith('/') || nextParam.startsWith('//')) {
    return '/portal'
  }
  return nextParam
}

function hasSupabasePublicEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isProductionTestFixture =
    process.env.NODE_ENV === 'production' &&
    (pathname === '/test-fixtures' || pathname.startsWith('/test-fixtures/'))

  if (isProductionTestFixture) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }

  const isAdminPrivateMediaRoute = pathname.startsWith('/admin/platform/blog/media/')
  const isAdminRoute = pathname.startsWith('/admin') && !isAdminPrivateMediaRoute
  const isAdminLoginRoute = pathname === '/admin/login'
  const isManagerRoute = pathname.startsWith('/manager')
  const isPortalRoute = pathname.startsWith('/portal')
  const isMeasureRoute = pathname.startsWith('/measure') && pathname !== '/measure'
  const isCustomerLoginRoute = pathname === '/login'

  if (!hasSupabasePublicEnv()) {
    if ((isAdminRoute && !isAdminLoginRoute) || isManagerRoute) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (isPortalRoute || isMeasureRoute) {
      return NextResponse.redirect(getCustomerLoginUrl(request))
    }

    return NextResponse.next({
      request,
    })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. 경로 타입 식별
  const needsRoleLookup = isAdminRoute || isManagerRoute

  // 2. 로그인 여부에 따른 1차 처리 및 역할(role) 조회
  let userRole: string | null = null
  let roleQueryError = false

  if (user && needsRoleLookup) {
    // platform 스키마를 바라보는 client 임시 생성하여 역할 조회
    const platformClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
        db: { schema: 'platform' }
      }
    )

    const { data: profile, error } = await platformClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      roleQueryError = true
    } else if (profile) {
      userRole = profile.role
    }
  }

  // 3. 비로그인 처리
  if (!user) {
    // 어드민 / 매니저 경로 -> 어드민 로그인으로 리다이렉트
    if ((isAdminRoute && !isAdminLoginRoute) || isManagerRoute) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    // 포털 / 견적신청 경로 -> 고객 로그인으로 리다이렉트
    if (isPortalRoute || isMeasureRoute) {
      return NextResponse.redirect(getCustomerLoginUrl(request))
    }
  }

  // 4. 로그인된 사용자 처리
  if (user) {
    // 4.1 쿼리 오류 발생 시 fail-closed (보호 경로 접근 차단)
    if (roleQueryError) {
      if ((isAdminRoute && !isAdminLoginRoute) || isManagerRoute) {
        return NextResponse.redirect(new URL('/login?error=query_failed', request.url))
      }
    }

    // 4.2 로그인 페이지 접근 차단
    if (isCustomerLoginRoute) {
      return NextResponse.redirect(new URL(getSafeLoginNextParam(request), request.url))
    }
    if (isAdminLoginRoute) {
      if (userRole === 'administrator') {
        return NextResponse.redirect(new URL('/admin/platform', request.url))
      }
      if (userRole === 'sales_manager') {
        return NextResponse.redirect(new URL('/manager', request.url))
      }
      return NextResponse.redirect(new URL('/portal', request.url))
    }

    // 4.3 모든 관리자 경로는 administrator만 허용합니다.
    if (isAdminRoute && !isAdminLoginRoute && userRole !== 'administrator') {
      return NextResponse.redirect(new URL('/portal', request.url))
    }

    // 매니저 경로 (/manager): sales_manager 또는 administrator만 허용
    if (isManagerRoute && userRole !== 'sales_manager' && userRole !== 'administrator') {
      return NextResponse.redirect(new URL('/portal', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/test-fixtures/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
