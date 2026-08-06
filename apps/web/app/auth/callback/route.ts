import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { claimCapturesForDiscordUser } from '@/app/actions/captures'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  // Where to send the user after confirming. Only allow relative paths to
  // avoid open-redirect; default to /home.
  const nextParam = searchParams.get('next')
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/home'

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const base = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  let destination = next

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    const user = data?.user

    if (user) {
      const admin = createAdminClient()

      // The identity is authoritative — richer and more reliable than the
      // metadata snapshot the signup trigger sees. Runs on every sign-in, so a
      // member who linked Discord later is picked up without a special path.
      const discord = user.identities?.find(i => i.provider === 'discord')
      if (discord?.id) {
        // Discord sends the handle as full_name ("junejuno85"); `name` is the
        // legacy "username#0" form and custom_claims.global_name is the display
        // name. preferred_username is a GitHub/Keycloak key Discord never sets.
        const d = discord.identity_data ?? {}
        const raw =
          (typeof d.full_name === 'string' && d.full_name) ||
          (typeof d.name === 'string' && d.name.split('#')[0]) ||
          (typeof d.preferred_username === 'string' && d.preferred_username) ||
          null
        const handle = raw ? raw.toLowerCase() : null

        // discord_user_id is UNIQUE: if this Discord account is already linked
        // to a different Stoke profile the write fails, and that must not break
        // the sign-in — they are simply signed in as this account.
        const { error: linkError } = await admin
          .from('profiles')
          .update({
            discord_user_id: discord.id,
            ...(handle ? { discord_username: handle } : {}),
          })
          .eq('id', user.id)

        if (!linkError) {
          // Never let a claiming failure block someone from getting in.
          try {
            await claimCapturesForDiscordUser(user.id, discord.id)
          } catch {
            // Non-fatal: their posts stay claimable by token.
          }
        }
      }

      // Send auto-derived usernames through the pick-one step, once.
      const { data: profile } = await admin
        .from('profiles')
        .select('username_chosen')
        .eq('id', user.id)
        .maybeSingle()

      if (profile && !profile.username_chosen) {
        destination = `/welcome/username?next=${encodeURIComponent(next)}`
      }
    }
  }

  return NextResponse.redirect(`${base}${destination}`)
}
