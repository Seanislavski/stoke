import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isAuthCallback = pathname.startsWith('/auth/callback')
  const isBannedPage = pathname.startsWith('/banned')
  const isInvitePage = pathname.startsWith('/invite/')
  const isCronRoute = pathname.startsWith('/api/cron/')
  const isLandingPage = pathname === '/'

  if (!user && !isAuthRoute && !isAuthCallback && !isInvitePage && !isCronRoute && !isLandingPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Check platform ban for authenticated users on protected routes
  if (user && !isAuthRoute && !isAuthCallback && !isBannedPage && !isInvitePage && !isCronRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', user.id)
      .single()

    if (profile?.is_banned) {
      return NextResponse.redirect(new URL('/banned', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
