# Stoke Community — Claude Code Project

## Project
- **Name:** Stoke Community
- **Domain:** stoke.community (live — DNS via Cloudflare nameservers: quincy.ns.cloudflare.com, carla.ns.cloudflare.com)
- **Directory:** `C:\Users\Sean\OneDrive\reciprocal-community-platform`
- **GitHub:** `github.com/Seanislavski/stoke` (private)
- **Railway project:** noble-vision (`d4bd8d52-633d-433c-8cda-65e1336a6e93`)
- **Web URL:** `https://web-production-3d840.up.railway.app`
- **Server URL:** `https://server-production-99bf.up.railway.app`
- **Supabase project:** `gzssbicdblkmllutegju` (Stoke Community, US East)
- **Status:** Core features built and deployed — auth, profiles, communities, bulletin board, channels, settings, gear menus, platform roles, events, resources, tickets, invites, platform ban, photo uploads/galleries, lightbox, audit log search

## What It Is
A platform for building reciprocal communities — anyone can create and organize a community where members genuinely give and receive value from each other. Think LinkedIn meets Meetup, focused on mutual exchange. No time banking or point systems; the platform provides infrastructure, the community provides the exchange.

## Stack
- **Frontend:** Next.js 16 + TypeScript + Tailwind (`apps/web`)
- **Backend:** Node.js / Express + TypeScript (`apps/server`)
- **Database + Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Deployment:** Railway (two services: web + server, GitHub auto-deploy from main)
- Same stack as Plish, completely separate codebase and infrastructure

## Supabase Patterns (learned the hard way)
- ALL `security definer` trigger functions need `SET search_path = public` and use `$func$` dollar quoting
- RLS policies must NEVER reference their own table in a subquery → infinite recursion (42P17)
- Use `is_community_mod(community_id)` security definer helper for mod checks in RLS
- Use `createAdminClient()` (service role) for any read that needs to cross RLS boundaries (member lists, pending posts, etc.)
- `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local` (no NEXT_PUBLIC_ prefix — server only)
- `lib/supabase/admin.ts` → `createAdminClient()` for server components
- PostgREST FK disambiguation: when a table has two FKs referencing the same target table, `table(col)` join becomes ambiguous and silently returns null — fix with `!column_name` hint e.g. `profiles!author_id(username, display_name, avatar_url)`
- `audit_log` table FKs reference `profiles(id)` not `profiles(user_id)` — `id` is the PK
- PostgREST case-insensitive text lookup: use `.or(values.map(v => \`col.ilike.\${v}\`).join(','))` — `.in()` is case-sensitive
- Supabase FK joins return arrays at runtime even when TS infers object — type as `T[] | T | null` union to satisfy both
- Always run `npx tsc --noEmit` from `apps/web` before pushing to catch TS errors locally
- `startTransition` callbacks must return `void` — use `void` operator before async server action calls: `startTransition(() => void myAction())`
- Always paste SQL migration contents directly in chat — never just reference the file path
- `favicon.ico` in `app/` always overrides `icon.svg` — delete `favicon.ico` when adding SVG favicon

## Railway Patterns
- Root directory in Railway dashboard must be `apps/web` (no leading slash — `/apps/web` is wrong)
- `nixpacks.toml` in each app dir: install=`cd ../.. && npm install`, build=`npm run build`, start=`node .next/standalone/server.js` (web) or `node dist/index.js` (server)
- `next.config.ts` needs `output: 'standalone'` for Railway
- Supabase auth `site_url` and `additional_redirect_urls` must include production Railway URL
- **HOSTNAME=0.0.0.0** env var required on Railway web service — standalone server binds localhost by default, Railway proxy can't reach it
- **postbuild script** in `apps/web/package.json`: `cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public` — standalone output doesn't include static assets by default

## Routes Built
- `/login`, `/signup`, `/home`, `/banned`
- `/communities` (directory: search + category filter)
- `/communities/new` (create form)
- `/communities/[slug]` (community page: URL-based tabs — Bulletin/Events/Resources/Channels)
- `/communities/[slug]/settings` (general info, channel management, invite links, member management)
- `/communities/[slug]/channels/[channelId]` (realtime text chat)
- `/settings/profile` (edit display name, bio, avatar upload, show_memberships toggle)
- `/profile/[username]` (public profile page)
- `/invite/[token]` (public invite landing page, works unauthenticated)
- `/support` (my tickets + community tickets if org/mod)
- `/support/[ticketId]` (chat-style ticket thread)
- `/admin/*` (platform admin: users, communities, support — role-gated)
- `/auth/callback`
- `/about` (About / mission page — public)
- `/privacy` (Privacy Policy — public)
- `/terms` (Terms of Service — public)

## Monorepo Structure
```
apps/
  web/     → Next.js frontend (port 3000)
  server/  → Express backend (port 3001)
```
Root npm workspaces. Run `npm run dev:web` / `npm run dev:server` from root.

## Key Product Decisions
- Single account across all communities (Discord model)
- Join modes: Open / Request to join / Invite-only
- Profile memberships: opt-in (member chooses to show or hide)
- Events: organizers only can create
- Resource library: members can submit, requires organizer/mod approval
- Bulletin board: member submissions require mod approval
- Community ban = community_members.status='banned' (one community only)
- Platform ban = profiles.is_banned bool (account-wide, future)
- Email never exposed to organizers/members — proxied outreach only

## Role Architecture
**Platform roles** (`platform_roles` table: user_id PK + role enum + granted_at):
- `owner` — full platform access (Sean)
- `platform_moderator` — cross-community mod, platform-wide bans
- `community_manager` — works with organizers, feature/delist communities
- `support` — tickets + account help

**Community roles** (`community_members.role` enum):
- `organizer` — community owner equivalent, can change member roles
- `moderator` — can edit info, approve/reject/ban members
- `member` — standard member

## Gear Menus
- **Global gear** (AppNav): avatar + gear icon → dropdown; items gated on `platformRole` prop passed from layout; platform team items only shown when role exists
- **Community gear** (`CommunityGear.tsx`): shown to organizers/mods/owner on community page header; shows pending count badge if join_mode=request

## Storage
- `avatars` bucket (public): path `{userId}/avatar`, upsert:true; URL has `?t={Date.now()}` for cache busting
- Supabase storage domain added to `next.config.ts` remotePatterns: `gzssbicdblkmllutegju.supabase.co`

## Platform Ban
- `profiles.is_banned` bool — account-wide ban
- Middleware checks `is_banned` for all authenticated protected routes → redirects to `/banned`
- **NEVER put signOut() in middleware** — causes redirect loop where banned user can't re-access /login. Client-side signOut in /banned page useEffect only.
- `/banned` page: client component, calls `supabase.auth.signOut()` in useEffect, shows suspended message + link to /login
- Only `owner` platform role can ban other platform team members (platform_moderator, community_manager, support)

## Events
- `events` table: community_id, title, description, starts_at, ends_at, location_type (online/in_person/hybrid), location_url, location_address, created_by
- `event_rsvps` table: event_id, user_id, status (going/maybe/not_going) — UNIQUE on (event_id, user_id)
- Events tab on community page; past events in `<details>` toggle
- RSVPs: Going/Maybe/Can't go buttons; clicking active status clears (upsert with null)

## Resources
- `resources` table: community_id, submitted_by, title, url, description, status (pending/published/rejected)
- Members submit; auto-published if submitter is mod/organizer; otherwise requires approval
- Resources tab on community page; pending shown to mods only

## Support Tickets
- `tickets` table: submitter_id, community_id (nullable), category (text), subject, status (open/in_progress/resolved/closed)
- `ticket_replies` table: ticket_id, author_id, body, is_staff_reply
- `ticket_categories` table: key (text PK), label (text), position (int), is_active (bool) — dynamic categories managed by platform staff; seeded with account_issue, report_user, bug_report, community_issue, other
- `tickets.category` is plain `text` (was postgres enum `ticket_category` — altered 05/30/2026); any string from ticket_categories is valid
- Community tagging on tickets: any active member can tag a community (no mod restriction)
- /support: my tickets + community tickets (if org/mod) + closed collapsed
- /support/[ticketId]: chat-style thread (own msgs right/orange, others left); StatusSelect for staff only; closed tickets lock reply form
- Access: submitter + platform staff (support/platform_mod/owner) + community org/mod if community ticket
- /admin/support: all tickets with status+category filter + CategoryManager section at bottom (add/hide/delete categories)
- `lib/ticket-categories.ts`: `getTicketCategories()` + `buildCategoryLabels()` helpers — use these instead of hardcoded CATEGORY_LABELS
- Admin nav: "Platform Bans" (was "Moderation")

## Invite Links
- `invites` table: token (32-char UUID-derived), community_id, created_by, max_uses (nullable), use_count, expires_at (nullable)
- Token generation: `replace(gen_random_uuid()::text, '-', '')` — gen_random_bytes not available
- InviteManager in community settings: generate (max_uses + expiry options), copy link, revoke
- `/invite/[token]` — public, works unauthenticated; unauthenticated users see sign-in link with ?redirect= back to invite
- Invite join behavior: open communities → active member; request/invite-only → pending (always queued for approval)
- middleware.ts has `/invite/` exception so unauthenticated users can view the page

## Channels / Gathering Spaces
- `channels` table: community_id + name + description + position + created_by
- `messages` table: channel_id + author_id + content + edited_at; added to `supabase_realtime` publication
- Realtime: browser client subscribes to `postgres_changes INSERT` filtered by `channel_id`
- Channel page: server loads last 50 messages + profile cache; client handles realtime + sending
- Messages grouped Discord-style: consecutive same-author messages collapsed

## Core Features (v1)
- Bulletin board
- Gathering spaces (text channels)
- Scheduled events (organizer-created, screen share, post-event summary)
- Resource library
- Community directory (listed/unlisted, categories)
- Permissions + moderation toolkit (kick/timeout/ban/audit log/reports)

## Out of Scope (v1)
- Voice/video channels
- Tags on communities
- Time banking / reciprocity tracking
- Public people directory
- Mobile native apps

## Next.js Patterns
- Server actions passed as props to client components MUST use `.bind(null, ...args)` — arrow functions `() => serverAction(args)` are plain closures, not serializable across the server→client boundary, and cause runtime crashes (Next.js error digest). Example: `deletePost.bind(null, post.id, communityId, slug)` not `() => deletePost(post.id, communityId, slug)`

## Email Notifications
- Email provider: **Resend** (`resend` npm package in `apps/web`)
- Helper + templates: `apps/web/lib/email.ts` — `sendEmail(to, subject, html)` silently skips if no `RESEND_API_KEY`
- From address: `Stoke Community <noreply@stoke.community>` (domain verified in Resend + Cloudflare DNS)
- `support@stoke.community` forwards to Sean's personal email via Cloudflare Email Routing
- Fire-and-forget pattern: `void (async () => { ... })()` — emails never block server action response
- Triggers: join request → notify mods (`membership.ts`); approved/rejected → notify applicant (`community.ts`); ticket reply → notify other party (`tickets.ts`)
- Env vars needed: `RESEND_API_KEY`, `SUPPORT_EMAIL` (inbox for user→staff ticket replies), `CRON_SECRET`
- Event reminders: `apps/web/app/api/cron/event-reminders/route.ts` — Bearer token auth, 25–35min window, requires `reminder_sent_at timestamptz` column on `events` table
- Cron job: cron-job.org (free), `*/10 * * * *`, hits `/api/cron/event-reminders` with `Authorization: Bearer <CRON_SECRET>`
- `/api/cron/` routes must be excluded from middleware auth redirect — add `isCronRoute = pathname.startsWith('/api/cron/')` exception

## Platform Staff in Community UI
- `isPlatformStaff` = `['owner', 'platform_moderator'].includes(platformRole?.role ?? '')` — implicit mod authority in all communities
- `community_manager` and `support` platform roles do NOT get isMod in communities
- MembersManager: platform staff show "admin" orange badge; role label = "Platform Staff" only when their community role is `member`; if they hold a community role (organizer/moderator) that label takes precedence
- Settings page access: platform staff need `platformRole` check alongside community role check or they get redirected

## Link Embeds
- `apps/web/lib/embeds.ts`: `isImageUrl`, `getYouTubeId`, `normalizeUrl`, `extractUrls` helpers
- `apps/web/app/api/link-preview/route.ts`: server-side OG fetch (avoids CORS), 5s timeout, 50KB limit, 1hr cache
- `apps/web/components/LinkPreview.tsx`: image → `<img>`; YouTube → `<iframe>`; other → OGCard
- `apps/web/components/RichContent.tsx`: parses URLs (incl bare `www.`) → clickable links + LinkPreview embeds
- Used in channel messages, bulletin, resources, events, tickets

## Photos & Media
- `components/ImageLightbox.tsx`: fixed overlay z-50, bg-black/80, click backdrop or ESC to close; click on img stops propagation
- `components/PhotoGallery.tsx`: 0 photos→null, 1→inline img, 2+→grid-cols-2 sm:grid-cols-3; all open ImageLightbox; used on bulletin posts, events, resources gallery
- `components/PhotoUploader.tsx`: uploads to `avatars` bucket at given pathPrefix; supports multiple=true/false; shows thumbnails with × remove; "or paste URL" toggle
- `bulletin_posts.photos text[] DEFAULT '{}'` — array of photo URLs, shown as gallery below post content
- `events.photos text[] DEFAULT '{}'` — same, shown below event description in EventCard
- `resources.resource_type` includes 'photo' — photo resources show as "Photo Gallery" grid at top of Resources tab; other types list below
- Storage policy needed: `CREATE POLICY ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND name LIKE 'community-photos/%')`
- Upload paths: `community-photos/bulletin-{communityId}/`, `community-photos/events-{communityId}/`, `community-photos/resources-{communityId}/`
- Channel messages: `messages.image_url text` column; upload path `channel-images/{channelId}/{timestamp}.ext`; storage policy for `channel-images/%` already applied
- `.photo-pop` CSS class in globals.css: `transform: scale(1.1); box-shadow; z-index:10` on hover — applied to all photo/avatar wrappers site-wide
- Global input color fix in globals.css: `input, textarea, select { color: #1c1917 }` — prevents light-on-light text

## Audit Log
- `components/admin/AuditLogClient.tsx`: client component, instant text search across actor/action/community/target, 500 entry limit
- Full ACTION_LABELS list includes: member.joined, member.requested, post.created, post.submitted, resource.created, resource.submitted, event.created, event.deleted, and all mod actions
- Pattern: always `.select('id').single()` on insert, then `logAction({ actorId, communityId, action, targetId, targetType })`

## HomeHero Scroll (home page)
- `components/HomeHero.tsx`: hero shown on /home for logged-in users; in normal document flow (NOT fixed/sticky); fades as it scrolls off via `getBoundingClientRect`
- `hero-mode` body class hides header (`opacity:0; pointer-events:none`) until user scrolls 15% of viewport past hero top
- Threshold: `rect.top > -(window.innerHeight * 0.15)` — nav appears after ~135px scroll on typical screen
- Opacity: `1 - rect.bottom / rect.height` (viewport-relative, not scroll-absolute — works regardless of page content length)
- `globals.css` sets `html, body { background-color: #fafaf9 }` to prevent dark-mode black bar below content
- **Scroll spacer**: `<div id="hero-spacer" />` at bottom of both home page paths; HomeHero.tsx sets its height to `max(0, heroHeight - (scrollHeight - viewportHeight))` — exactly the scroll room needed, no excess whitespace
- **No dangerouslySetInnerHTML script** — React 19 / Next.js 16 no longer executes inline scripts in React components; HomeHero's `useEffect` adds `hero-mode` class on mount instead
- Key lesson: `min-h-screen` or `min-h-[calc(100vh-3.5rem)]` on content div creates empty whitespace when content is shorter — use dynamic JS spacer instead
- Key lesson: `scrollY / heroHeight` breaks when page isn't tall enough to scroll hero fully off screen — use `getBoundingClientRect().top` instead
- Key lesson: NEVER use `hero.offsetHeight === 0` guard — if layout hasn't computed yet it exits early and hero-mode never gets toggled
- Key lesson: `100svh` computes differently in Chrome vs Firefox — always use `100vh` for fullscreen hero elements
- Key lesson: fixed overlay hero = inverted UX; in-flow hero = correct (hero scrolls up, content rises from below)

## Stripe Billing
- Plans: Free ($0, 1 community, 50 members, 3 channels), Starter ($19/mo), Pro ($49/mo unlimited)
- `lib/billing.ts`: PLANS map + `checkCommunityLimit`, `checkMemberLimit`, `checkChannelLimit` helpers (called from server actions)
- `lib/stripe.ts`: Stripe client with `apiVersion: '2026-05-27.dahlia'`
- `app/api/stripe/checkout/route.ts`: creates checkout session or portal redirect; supports `starter` and `pro` plans
- `app/api/stripe/portal/route.ts`: billing portal session
- `app/api/webhooks/stripe/route.ts`: handles subscription events with idempotency via `stripe_webhook_events` table
- `app/(app)/settings/billing/page.tsx` + `components/settings/BillingPanel.tsx`: billing UI
- `app/pricing/page.tsx`: public pricing page
- Stripe Dahlia API: period end is `subscription.billing_schedules[0].bill_until.computed_timestamp` (NOT `current_period_end` — removed in Dahlia)
- Redirect URLs: use `NEXT_PUBLIC_APP_URL` env var — `new URL(request.url).origin` returns `0.0.0.0:8080` on Railway
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID` (`price_1TdxO1LKsDKZpMglNvKLKgjq`), `STRIPE_PRO_PRICE_ID` (`price_1TdxPSLKsDKZpMgl3vprkfwD`), `NEXT_PUBLIC_APP_URL=https://stoke.community`
- Webhook endpoint: `https://web-production-3d840.up.railway.app/api/webhooks/stripe`; events: `customer.subscription.created/updated/deleted`, `invoice.payment_failed`
- Supabase tables: `subscriptions` (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, cancel_at_period_end), `stripe_webhook_events` (stripe_event_id)

## Known Bugs / Open Items
- None currently.

## Git
- No Co-Authored-By lines in commits
- Use PowerShell with semicolons not `&&`
- **Always push to GitHub after every commit** — no need to ask. This stands until Sean explicitly says the project has gone live.
