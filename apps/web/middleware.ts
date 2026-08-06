import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Community slugs are stored lowercase and looked up with .eq(), so a single
  // capital letter in a shared link 404s. Redirect to the canonical form before
  // doing any auth work — one rule covering every /communities and /preview
  // route, instead of case-insensitive lookups at ~14 call sites.
  //
  // Deliberately NOT applied to /profile/{username}: usernames are genuinely
  // mixed-case ("Sinaratheus"), so lowercasing those would break working links.
  const canonical = request.nextUrl.pathname.match(/^\/(communities|preview)\/([^/]+)(\/.*)?$/)
  if (canonical) {
    const [, base, slug, rest] = canonical
    const lower = slug.toLowerCase()
    if (lower !== slug) {
      const url = request.nextUrl.clone()
      url.pathname = `/${base}/${lower}${rest ?? ''}`
      // 308 keeps the method and tells clients this is the real address.
      // The browser carries any #hash across on its own.
      return NextResponse.redirect(url, 308)
    }
  }

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
  const isStripeWebhook = pathname === '/api/webhooks/stripe'
  const isUnsubscribe = pathname.startsWith('/api/unsubscribe')
  const isLandingPage = pathname === '/'
  const isPricingPage = pathname === '/pricing'
  const isLegalPage = pathname === '/privacy' || pathname === '/terms' || pathname === '/about' || pathname === '/changelog'
  const isOgImage = pathname.endsWith('/opengraph-image') || pathname === '/opengraph-image'
  const isPreviewPage = pathname.startsWith('/preview/')

  // A bare /communities/{slug} (not the directory, /new, /mine, or any subpath)
  const communitySlugMatch = pathname.match(/^\/communities\/([^/]+)\/?$/)
  const previewSlug =
    communitySlugMatch && !['new', 'mine'].includes(communitySlugMatch[1])
      ? communitySlugMatch[1]
      : null

  // Logged-out visitors get a public read-only preview at the canonical community URL
  if (!user && previewSlug) {
    return NextResponse.rewrite(new URL(`/preview/${previewSlug}`, request.url))
  }

  // A single question URL, e.g. /communities/{slug}/questions/{id} — logged-out visitors
  // get a public read-only view (used for shareable Question-of-the-Week links). The
  // preview page itself enforces that only QOTW questions are actually exposed; the URL
  // stays canonical/shareable. Logged-in users fall through to the real gated page.
  const communityQuestionMatch = pathname.match(/^\/communities\/([^/]+)\/questions\/([^/]+)\/?$/)
  if (!user && communityQuestionMatch) {
    const [, qSlug, qId] = communityQuestionMatch
    return NextResponse.rewrite(new URL(`/preview/${qSlug}/questions/${qId}`, request.url))
  }

  // A numbered Question-of-the-Week link, e.g. /communities/{slug}/qotw/{n} — same
  // public read-only treatment as a single question. (The bare /communities/{slug}/qotw
  // management page has no trailing number, so it stays mod-gated below.)
  const communityQotwMatch = pathname.match(/^\/communities\/([^/]+)\/qotw\/([^/]+)\/?$/)
  if (!user && communityQotwMatch) {
    const [, qSlug, qNum] = communityQotwMatch
    return NextResponse.rewrite(new URL(`/preview/${qSlug}/qotw/${qNum}`, request.url))
  }

  // A contest URL, e.g. /communities/{slug}/contests/{id} — logged-out visitors get
  // the public read-only view so a contest link shared to Discord opens instead of
  // hitting the login wall. The preview page enforces that only a non-draft contest
  // in a LISTED community is actually exposed; entries are never public.
  const communityContestMatch = pathname.match(/^\/communities\/([^/]+)\/contests\/([^/]+)\/?$/)
  if (!user && communityContestMatch) {
    const [, cSlug, cId] = communityContestMatch
    return NextResponse.rewrite(new URL(`/preview/${cSlug}/contests/${cId}`, request.url))
  }

  // Logged-in users shouldn't see the public preview — send them to the full page
  if (user && isPreviewPage) {
    const target = pathname.replace(/^\/preview\//, '/communities/').replace(/\/$/, '')
    return NextResponse.redirect(new URL(target, request.url))
  }

  // A Discord-capture claim link (sent to the author's DM). Logged-out visitors go to
  // signup with the claim path preserved so the token survives auth — this is the
  // capture pipeline's signup funnel.
  if (!user && pathname.startsWith('/claim/')) {
    return NextResponse.redirect(new URL(`/signup?redirect=${encodeURIComponent(pathname)}`, request.url))
  }

  if (!user && !isAuthRoute && !isAuthCallback && !isInvitePage && !isCronRoute && !isStripeWebhook && !isLandingPage && !isPricingPage && !isUnsubscribe && !isLegalPage && !isOgImage && !isPreviewPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Check platform ban for authenticated users on protected routes
  if (user && !isAuthRoute && !isAuthCallback && !isBannedPage && !isInvitePage && !isCronRoute && !isUnsubscribe) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf|html|ico|txt|xml|webmanifest)$).*)'],
}
