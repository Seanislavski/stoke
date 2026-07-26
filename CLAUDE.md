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
- **Non-deterministic builds — install is `npm install`, NOT `npm ci`** (nixpacks `cd ../.. && npm install`). `npm install` treats the committed lockfile as advisory and can re-resolve any `^`/`~` range to a newer version at build time even though the lockfile pins an older one. So a build can fail with NO code change, just because a dep published a newer release. **Fix pattern: pin the exact version (drop the caret) for any dep whose TYPES are version-coupled.** (07/01/2026: Railway build failed because `"stripe": "^22.2.0"` resolved a newer 22.x whose pinned `apiVersion` type no longer matched our `'2026-05-27.dahlia'` literal → TS error; local still had 22.2.0 so `tsc` passed locally = the tell. Fixed by pinning `"stripe": "22.2.0"` exact + `npm install --package-lock-only` to sync the lock spec — commit `61b3c0c`. Chose exact-pin over bumping the apiVersion date string, which Railway's diagnosis suggested but only defers the break to Stripe's next SDK. To upgrade Stripe later: bump the version AND the `apiVersion` date together, deliberately.)

## Routes Built
- `/login`, `/signup`, `/home`, `/banned`
- `/communities` (directory: search + category filter)
- `/communities/new` (create form)
- `/communities/[slug]` (community page: URL-based tabs — Bulletin/Events/Q&A/Channels)
- `/communities/[slug]/settings` (general info, channel management, Q&A categories, invite links, member management)
- `/communities/[slug]/channels/[channelId]` (realtime text chat)
- `/communities/[slug]/questions/[questionId]` (Q&A question detail page — durable, linkable)
- `/settings/profile` (edit display name, bio, avatar upload, show_memberships toggle)
- `/profile/[username]` (public profile page)
- `/invite/[token]` (public invite landing page, works unauthenticated)
- `/support` (my tickets + community tickets if org/mod)
- `/support/[ticketId]` (chat-style ticket thread)
- `/admin/*` (platform admin: users, communities, support — role-gated)
- `/auth/callback`
- `/preview/[slug]` (public read-only community preview — served via middleware rewrite to logged-out visitors of `/communities/[slug]`)
- `/about` (About / mission page — public)
- `/privacy` (Privacy Policy — public)
- `/terms` (Terms of Service — public)
- `/guide` (Organizer Guide — **staff-only**, not public; server-side staff guard + gated nav link)

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
- `community_manager` — works with organizers, feature/delist communities (platform-WIDE; per-community scoping was considered 06/13/2026 and DEFERRED — Sean's real need was community organizers delegating moderation, which already exists)
- `support` — tickets + account help

**Community roles** (`community_members.role` enum):
- `organizer` — community owner equivalent, can change member roles + email all members
- `moderator` — full everyday moderation (approve/reject/ban/remove members, approve posts/Q&A, manage channels/events/invites) but CANNOT change roles or send email blasts
- `member` — standard member
- DB trigger `handle_new_community` auto-adds the creating owner as an `organizer` member row → "is this user community staff?" = has a `community_members` row with role in (`organizer`,`moderator`) status active (covers owners too)

**Governance rules — organizers are owner-protected (06/13/2026):**
- Only the community **owner** (and platform staff, which `getCallerRole` treats as owner-equivalent) can **appoint, change role of, ban, or remove** an `organizer`. Non-owner organizers can do none of those to a fellow organizer.
- Non-owner organizers CAN appoint/demote/ban/remove `moderator` and `member` — they delegate moderation, just can't touch co-owners.
- Enforced in `app/actions/community.ts`: `updateMemberRole` guard (`caller.role !== 'owner' && (role === 'organizer' || prev?.role === 'organizer')`), plus `removeMember`/`banMember` guards via `isTargetOrganizer()` helper. Mirrored in UI `MembersManager.tsx`: `ownerOnlyTarget = isOrganizerMember && callerRole !== 'owner'` hides the Organizer dropdown option + Ban/Remove buttons on organizer rows for non-owners.
- `getCallerRole(communityId)` in `community.ts` is the central in-community authority chokepoint — returns `'owner'` for the community owner OR platform staff (owner/platform_moderator); role-scoped to that one community.
- Auth pattern is duplicated across action files (bulletin/events/invites/knowledge/messages/resources): each fetches `platform_roles ... .in('role',['owner','platform_moderator'])` → `isPlatformStaff = !!platformRole`. `channels.ts` `requireOrgOrMod` does NOT check platform roles (pre-existing gap; only community owner + org/mod can manage channels).
- All everyday mod checks = `['organizer','moderator'].includes(membership.role)` keyed to one `community_id` — community roles NEVER cross between communities.

## Gear Menus
- **Global gear** (AppNav): avatar + gear icon → dropdown; items gated on `platformRole` prop passed from layout; platform team items only shown when role exists. **Admin section consolidated (07/07/2026, `df942dd`):** the four separate admin links ("Admin panel"/"Moderation"/"Manage communities"/"Support queue") that were MISLABELED + incomplete vs `AdminNav` (same URLs, different names; Users/Reviews/Audit missing entirely) are now a SINGLE "Admin" entry → `adminHref(role)` lands each platform role on its first usable page (owner→/admin, platform_moderator→/admin/users, community_manager→/admin/communities, support→/admin/support); `AdminNav` is the source of truth once inside. Also added a "What's new" link (→/changelog) in the common section.
- **Community gear → DROPDOWN (07/07/2026, `e0e3f5d`):** `CommunityGear.tsx` was a bare icon-link to /settings; now it's a client dropdown (click-outside close) surfacing every mod destination: **Review queue (N badge) · Question of the Week · Settings · Audit log** (audit → `/settings#audit-log` anchor). Pending-count badge on the gear icon = `totalPending` (all pending: joins+reviews+posts+questions+answers). Gated on `isMod`. **The old standalone "N to review" pill was REMOVED** (it duplicated the gear badge — same number, two destinations).
- **Community header role labels — role-aware (07/07/2026, `ef92213`; SUPERSEDES the 07/01 owner-only "Organizer" note):** Sean: *"can't we do everything?"* → `JoinButton.tsx` now shows an accurate role badge for ALL staff, coexisting with the Leave action (badge + button together, not one-or-the-other): community **owner** → "Owner" badge (no Leave, owners can't leave); **organizer** → "Organizer" badge + Leave; **moderator** → "Moderator" badge + Leave; **member** → Leave (no badge); non-member → Join/Request; logged-out → never (preview). `JoinButton` gained a `role` prop (`myMembership?.role`), `isOwner` still authoritative for the "Owner" label. `RoleBadge` subcomponent. (Old behavior was owner-only "Organizer" — replaced.)
- **Community header mobile fix (07/01/2026):** header row `communities/[slug]/page.tsx` changed `flex items-start justify-between` → `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4` so it **stacks on mobile** (title/meta on top, action row [Organizer label / Join + gear] below, full width) and stays side-by-side at `sm`+ (desktop unchanged). Fixed "Organizer" being cramped on mobile. Also added `whitespace-nowrap` to the Organizer span in `JoinButton.tsx`. tsc clean. Committed `16737b3` and PUSHED — live in prod.
- **Settings quick-nav (07/07/2026, `98006f8`):** the 10-section settings scroll got a **sticky anchor sub-nav** (top-14 z-[5] overflow-x-auto, under AppNav) — General·Spaces·Q&A·QotW·Reviews·Invites·Members·Email·Danger·Audit; each `<section>` got an `id` + `scroll-mt-20`; Email/Danger links render conditionally (organizer/owner, owner). The gear-dropdown's "Audit log" deep-links `#audit-log`.
- **Community tab strip mobile (07/07/2026, `0f57e32`):** 5 tabs (Bulletin/Events/Q&A/Channels/Reviews) → container `overflow-x-auto` + each tab `shrink-0 whitespace-nowrap` so they scroll horizontally instead of crowding on narrow screens.

## Q&A Question/Answer Editing (07/07/2026 — `d1af1d8`, LIVE, no migration)
- **Trigger:** Sean answered QotW-1 himself, realized *"once a post has been made [there is no way to] edit it"* (only delete + accept existed). Chose scope = **Answers + Questions**; re-approval model = **re-queue** (Sean: *"I think it makes sense for it to re-queue but I also understand your recommendation"*).
- **Rules:** author/asker-only edit. **Member edit to a PUBLISHED item → back to `pending`** (mods emailed via `kbAnswerSubmittedHtml`/`kbQuestionSubmittedHtml`, amber "back in review" notice), clears approved_by/published_at (+ `is_accepted=false` on answers). **Mod/owner edit stays LIVE** (no re-queue). Member edit to a pending item stays pending. **QotW questions are edit-locked to mods** (`canEdit = isMod || (isAsker && !isQotw)`) so a member can't pull a live/numbered QotW back into review. Non-authors can't edit others' answers (mods delete only, no rewording).
- **Impl:** `editAnswer`/`editQuestion` in `knowledge.ts` (`requeue = !isMod && status !== 'pending'`); audit labels `answer.edited`/`question.edited`; NEW `components/knowledge/EditAnswer.tsx` + `EditQuestion.tsx` (children-slot pattern — view mode renders the server display + an "Edit" affordance, edit mode a form; `canEdit` prop short-circuits to `<>{children}</>`; `RichContent` is `'use client'` so reusable inside). Wired into `questions/[questionId]/page.tsx` (question title→body wrapped; each published answer body/url wrapped).

## Moderation Review Queue (07/07/2026 — `071c191`, LIVE, no migration)
- **Trigger:** Sean found a pending Q&A answer only via email — *"how do I make it so mods (and myself) can see what needs approval and what needs to be taken care of?"* Gap: pending items were fragmented (bulletin pending on bulletin tab only, Q&A questions on qa tab only, **pending ANSWERS only on each individual question detail page = no aggregation**, gear badge counted only joins+reviews). Sean chose the **full queue page** (vs just fixing the Q&A gap).
- **New mod-only page `app/(app)/communities/[slug]/moderation/page.tsx`** — aggregates ALL pending in one place with inline approve/reject: **join requests · bulletin posts · Q&A questions · Q&A answers · reviews** (empty state "🎉 All clear"). Reuses existing actions/components (`approveRequest`/`rejectRequest`, `ModActions`=posts, `QuestionModActions`+category, `AnswerModActions`, `approveReview`/`rejectReview`). Pending answers labeled with their question title + link (batch `titleById` map). NEW generic `components/community/QueueActions.tsx` (bound-action approve/reject, Done-in-place) for requests+reviews.
- **Gear badge now = `totalPending`** (joins+reviews+posts+questions+**answers**) via 3 new count queries on the community `page.tsx`. Reachable from the gear dropdown ("Review queue N"). All reused components use the in-place "Done" pattern (item gone on reload).

## Changelog / "What's New" (07/07/2026 — `e12659d` + rule `0adb2fe`, LIVE)
- **Trigger:** Sean: *"at some point I would like to better track system changes so I can put out announcements."* Framed: internal record (git/CLAUDE.md/logs, already exists) vs a **curated user-facing changelog** (the gap). Sean chose **doc + public page now**.
- **Single source of truth = `apps/web/lib/changelog.ts`** (typed `ChangelogEntry[] {date,title,items[]}`, human-readable = the "doc", NO markdown-parser dep, no drift). **Public page `app/changelog/page.tsx`** ("What's new", timeline UI, mirrors `/about` header + `MarketingFooter`); `middleware.ts` `isLegalPage` += `/changelog` (public logged-out). Linked from `MarketingFooter` + AppNav dropdown. Seeded with 3 releases (Jul5/6/7).
- **⚙️ THE MECHANISM that keeps it current (this is why it persists):** a STANDING RULE was added to the **Git section of this CLAUDE.md** (`0adb2fe`) — on any commit shipping a user-facing change, add a plain-language entry to `lib/changelog.ts` in the SAME commit; curate (skip internal work); proactively offer it. PLUS a project-agnostic **backstop step 5 in the global `/s` skill** (`C:/Users/Sean/.claude/commands/s.md`) that sweeps for un-logged user-facing changes at session end (only activates where a project defines such a rule). Two layers: per-commit (precise) + `/s` (safety net). Rationale (Sean asked "what ensures regular updating?"): an in-session intention does NOT persist; only CLAUDE.md (auto-injected each session) + `/s` do.

## Organizer Guide (06/13/2026)
- **Two deliverables, one content:** portable markdown doc `docs/running-a-community.md` (paste into email/Discord/hand off) + in-app page `apps/web/app/guide/page.tsx`. Layered: quick-start ("first 15 minutes") + full feature reference + closing philosophy.
- **Staff-only access** (not public — Sean: "I do not want a public guide link, but I want the guide to be available to moderators/organizers/owners"):
  - `/guide` REMOVED from middleware public-route bypass → unauth redirects to `/login`, platform-ban check applies
  - Page (`guide/page.tsx`) has a **server-side guard**: `if (!user) redirect('/login')`; computes `isStaff = (community_members count, role in [organizer,moderator] active, via admin client) > 0 || !!platform_roles` ; `if (!isStaff) redirect('/home')` — real protection, not just hidden link
  - `(app)/layout.tsx` computes `isCommunityStaff` the same way and passes it to `AppNav`; gear-menu "Organizer guide" link only renders when `isCommunityStaff`
  - `MarketingFooter.tsx` has NO guide link (public surface); links = About / Privacy / Terms
  - OnboardingChecklist keeps its guide link ("New to running a community? Read the organizer guide →") — only mods/orgs see the checklist anyway
  - **Dismissable (07/11/2026 — LIVE `cab308f`):** Sean: the "Get your community started" box *"shows up but I don't have a way to dismiss it."* `OnboardingChecklist.tsx` is now `'use client'` with a **× button** in the header; dismissal persists in `localStorage` keyed `stoke_onboarding_dismissed_{slug}` (per community, per browser — NOT per account; offered a DB-backed cross-device version, Sean took the lightweight one). Reads localStorage before render (`ready` gate) so it never flashes for someone who dismissed it. Existing auto-hide-when-all-4-steps-done unchanged. Organizer-only surface → NO changelog entry.
- **Plan caps are sourced from code, not memory:** `apps/web/lib/billing.ts` PLANS map is authoritative (enforces limits at runtime). Free `{1, 50, 3}`, Starter `{3, 300, 15}`, Pro `{Infinity×3}` (communities/members/channels). LESSON: when a "missing fact" is about platform BEHAVIOR, check the code first.
- Guide page is standalone (outside `(app)` group) with its own marketing-style header + `MarketingFooter`; uses `Section`/`Tip` helper subcomponents + TOC jump-nav anchors.

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
- `events` table: community_id, title, description, starts_at, ends_at, location_type (online/in_person/hybrid), location_url, location_address, created_by; also `series_id` (FK→event_series ON DELETE SET NULL) + `recurrence` (denormalized freq label) added 07/08/2026
- `event_rsvps` table: event_id, user_id, status (going/maybe/not_going) — UNIQUE on (event_id, user_id)
- Events tab on community page; past events in `<details>` toggle
- RSVPs: Going/Maybe/Can't go buttons; clicking active status clears (upsert with null)
- **Timezones — per-viewer, DST-aware (07/08/2026):** the app runs on Railway in **UTC**, so `datetime-local` wall-clock input was being read as UTC on BOTH write and display → an event typed as "10:00" stored as 10:00Z (= 6am ET) and fell into the collapsed Past section. Fixed with `apps/web/lib/eventTime.ts`: `wallTimeToUtcIso(wall, tz)` interprets input in the creator's tz; `formatEventDate/formatEventTime/tzAbbrev(iso, tz)` render in the viewer's tz; `DEFAULT_TZ='America/New_York'`. All Intl-based (explicit `timeZone:`), never the server's local zone. `profiles.timezone` (default ET) + `profiles.timezone_detected` bool drive it — `TimezoneDetector.tsx` (mounted in `(app)/layout.tsx`) seeds tz from the browser once (`Intl…resolvedOptions().timeZone`) via `setDetectedTimezone` (no-op once detected, never clobbers a manual pick); editable in Settings→Profile (`COMMON_TIMEZONES` list). Reminder email (`eventReminderHtml`) takes a `tz` arg → built per-recipient in the cron. LESSON: a timezone feature has TWO independent problems — input zone (creator's) vs display zone (viewer's).
- **In-progress events (07/08/2026):** an event is "past" only once it has ENDED, not when it starts. `eventEnded(e, now) = new Date(e.ends_at ?? e.starts_at) < now`. Upcoming filter = `!eventEnded`; a started-but-not-ended event stays in Upcoming with a green "Happening now" badge (`ongoing` prop on EventCard). Home "Upcoming events" query includes ongoing via `.or(\`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})\`)`.
- **Recurring events (07/08/2026):** chose **materialize occurrences as real `events` rows** (NOT an RRULE/expand-on-read model) so RSVPs/reminders/tz/past-split all keep working per occurrence — the codebase assumes 1 row = 1 event. `event_series` table holds the rule + event template (frequency weekly/biweekly/monthly, start_wall, duration_minutes, end_type count/until/never, occurrence_count, until_date, generated_count cursor, active bool; RLS-on-no-policy = service-role only). `apps/web/lib/eventSeries.ts`: `advanceWall` (keeps wall time-of-day, DST handled at UTC conversion; monthly clamps day-of-month), `generateForSeries` (idempotent, resumes from generated_count, fills to a **rolling 90-day horizon** bounded by the end condition, sets active=false when count/until exhausted), `topUpAllSeries`. Perpetual ("until I turn it off") stays filled via a top-up **folded into the existing `/api/cron/event-reminders` route** (every 10 min) — deliberately NO new cron-job.org entry. `createEvent` branches on `repeat_frequency`; `deleteEvent(eventId, communityId, scope)` scope = `one`|`future` (delete this + later, set series inactive)|`series` (all + series row). UI: `CreateEventButton` "Repeats" + Ends radios; `EventDeleteControl.tsx` (client, per-scope menu on series events). Verified DST-safe: weekly 10am ET across Nov 1 → 14:00Z then 15:00Z, ET display stays 10:00 AM.

## Community Profile (About + Cover + Gallery — 07/08/2026)
- Trigger: Sean wanted GRACE (a just-created community) to "have more substance." A community's single photo was only the square **logo/avatar** (`image_url`, 64×64 header). Added three fields, all on `communities`:
  - `about text` — long-form free-form story (chose free-form over rigid structured fields). Editable in Settings→General (5000-char textarea, labeled `description` as the short tagline). Shown as an **About card under the header** on the community page (`RichContent`); on the public **preview it's LISTED-ONLY** (content privacy boundary).
  - `banner_url text` — wide cover image across the top of the community page + preview. Shown **publicly regardless of listed** (branding, like the avatar).
  - `photos text[] default '{}'` — gallery reusing existing `PhotoUploader`/`PhotoGallery`/`ImageLightbox`; saved via `updateCommunityInfo` (photos JSON injected into the form submit); shown as a Photos card after About; **LISTED-ONLY on preview**.
- `CommunityImageCropModal` was **generalized** with an `aspect`/`outputWidth`/`title` prop (defaults `1`/`400`/'Crop photo' → square avatar math UNCHANGED); banner passes `aspect=3, outputWidth=1500`. Storage all in the `avatars` bucket: avatar `community-{id}`, banner `community-banner-{id}`, gallery `community-photos/gallery-{id}/`.
- Privacy rule locked: **branding (avatar, banner) shows on public preview; content (About, gallery, bulletin teaser) is listed-only.**

## Resources (LEGACY — replaced by Q&A 06/11/2026)
- `resources` table still exists; `resources.ts` actions + `SubmitResourceForm`/`ResourceModActions` components left in place but ORPHANED (no longer rendered). Resources tab was replaced by the Q&A Knowledge Base.
- `resources` table: community_id, submitted_by, title, url, description, status (pending/published/rejected)

## Q&A Knowledge Base (replaces Resources tab — 06/11/2026)
> Full build narrative (QotW test-copy bug, the QotW-2 gate miss, cron off-toggle saga, launch-metric corrections) archived in `docs/claude-md-archive/2026-07-26-narrative-archive.md`.
- **Concept:** community Q&A as durable, searchable "external memory". Members ask + answer; BOTH queue for mod approval; only approved content is viewable.
- **Tables** (`20260611000000_knowledge_base.sql`): `kb_categories` (community_id, name, description, position); `kb_questions` (community_id, category_id, asker_id, title, body, status published/pending/rejected, approved_by, published_at, `is_public` bool, `asker_public_pref` bool nullable, `photos text[]`); `kb_answers` (question_id, community_id denormalized, author_id, body, url, status, is_accepted, `attribution`, `photos text[]`).
- **⚠️ PostgREST FK hint REQUIRED** — both tables have two FKs → profiles ⇒ always `profiles!asker_id(...)` / `profiles!author_id(...)`, else silent null.
- **RLS:** select published-only + insert-own; ALL pending reads + mod writes go through `createAdminClient()`.
- **Decisions locked:** ranking = accepted-answer marking ONLY, **no upvotes/karma** (gamifying attracts transactional behavior + repels genuine helpers); tab name "Q&A" (reserving "Ask" for a future real-time requests flow); both Q + A need approval; accepted answer = asker OR mod, one per question.
- **Editing:** author/asker-only. **Member edit to a PUBLISHED item → back to `pending`** (mods emailed, clears approved_by/published_at, `is_accepted=false`); **mod/owner edit stays LIVE**. QotW questions are edit-locked to mods (`canEdit = isMod || (isAsker && !isQotw)`). Non-authors can't reword others' answers (mods delete only).
- **Public exposure is per-question:** `is_public` bool, mod-only toggle (`setQuestionPublic`). Asker sets an advisory `asker_public_pref` checkbox (defaultChecked) at post time — purely a signal; a one-way `window.confirm` fires only when a mod makes public something the asker preferred private. **Answers are ALWAYS gated** — the public path runs a count-only query so bodies never reach memory.
- **Files:** `app/actions/knowledge.ts`; `components/knowledge/` (KnowledgeBoard, AskQuestionForm, AnswerForm, QuestionModActions, AnswerModActions, AcceptAnswerButton, CategoryManager, EditAnswer/EditQuestion, QuestionCategoryPicker, QuestionPublicToggle, QuestionJoinGate); detail route `questions/[questionId]/page.tsx`.

## Question of the Week (QotW)
- **NO dedicated table for the live question** — a QotW is a `kb_question` in a category named exactly `Question of the Week` (`lib/qotw.ts` `findQotwCategoryId()`, case-insensitive, per community). `ensureQotwCategory()` (in `lib/qotw-publish.ts`) find-or-creates it so organizers never need the magic name.
- **`qotw_items` table** (`20260703000000_qotw_items.sql`, RLS-on-no-policy = service-role only): the private BANK of drafts — community_id, title, body, `number` int (null while draft, assigned on publish, unique per community), `planned_for` date, `question_id` FK, position, published_at.
- **Numbering:** next = `max(number > 0) + 1`. Sentinel `number = 0` renders as **"QotW-t"** (throwaway test publish) via `qotwLabel(n)` and never inflates real numbering. A test publish INSERTS a separate copy — the original draft stays in the bank.
- **No deadlines, ever** (Sean's rule, explicitly for neurodivergent users): every QotW stays open forever, the whole back-catalog stays answerable.
- **Scheduling (hybrid: date wins, else rotate):** `/api/cron/qotw-publish` (CRON_SECRET bearer, daily 9am ET via cron-job.org) publishes at most ONE per community per run — earliest bank draft with `planned_for <= today`, else the next UNDATED draft in `position` order if the rotate gate is open. **`lib/qotw-schedule.ts` is the single source of schedule math shared by cron AND the UI countdown** so they can't disagree; the gate is **date-granularity** (`isRotateGateOpen`), NOT millisecond — a ms-precise gate checked once daily drifts later each week and sporadically skips a week.
- `reorderBank()` + ▲▼ arrows in `QotwManager.tsx` control rotation order; `NextPublishPanel.tsx` shows a live countdown to the next auto-publish.
- **Promoting a member's question in place:** `publishExistingQuestion()` assigns the next number, files it into the category, publishes if pending — **`asker_id` untouched so the member keeps credit** — and sends a congrats bell notification + email (`qotwChosenHtml`). The bank's `publishItem` clones an owner-authored question instead, so it never notifies.
- **⚠️ A regular/captured question is NOT a QotW, and nothing promotes it automatically.** The QotW list is driven **solely by `qotw_items` rows** — a `kb_question` with no linked row never appears there no matter its category. (07/26: Sean asked why a recently added question wasn't on the QotW list; it was a **Discord capture** filed into a normal category, working as designed.) To promote one, use `publishExistingQuestion()` — it assigns the next number **without touching `asker_id`**, so original credit survives; re-creating it from the bank instead would clone an owner-authored copy and drop the attribution. Diagnostic: compare `qotw_items.question_id` against questions in the QotW category to spot LINKED vs ORPHAN.
- **`source: 'maintenance-script'` appears in `audit_log.metadata`** for actions taken by scripts rather than the UI — useful when a question's history looks like it changed on its own.
- **Public numbered links:** `/communities/{slug}/qotw/{n}`; middleware rewrites logged-out hits → `/preview/{slug}/qotw/{n}`. `deleteQuestion` also deletes the linked `qotw_items` row (else a dead `/qotw/N`); a published QotW's detail page swaps the generic Delete for "Manage in QotW →" so there's one canonical delete path.
- **⚠️ CRON_SECRET is deliberately NOT recorded in this file** (it's in the repo) — it lives in `apps/web/.env.local`, Railway env vars, and Obsidian.
- **Body Doubling:** slug `bodydoublingcom`, id `5310e8c7-1276-485f-b77e-406d7edcf890`. **⚠️ LIVE STATE 07/26: `is_listed = true`, `join_mode = 'open'`** (verified by service-role probe). Older notes saying "unlisted" are stale — re-probe if privacy reasoning depends on it.
- **LESSON (cost a wrong answer twice):** never quote a live metric or live DB state from memory — pull it. Seed scripts: `seed-bodydoubling-qa.mjs`, `seed-bodydoubling-qotw-bank.mjs` (both idempotent, `--remove` to undo).
## Signed-in non-member question gate (07/26/2026 — SHIPPED `70c085b`, pushed)
- **Found while answering a question about the parked `/library` idea.** Sean assumed *"answers remain available to people who have signed up"* and asked *"that is how it currently is, right?"* — checked the code instead of memory, and he was off by one step: the gate is **MEMBERSHIP, not signup**. `questions/[questionId]/page.tsx` had `canSee = isMember || isMod` → else `notFound()`, so a signed-up non-member got a **bare 404** — the least informative screen on the platform handed to the person furthest along the funnel.
- **`components/knowledge/QuestionJoinGate.tsx` (NEW, client):** replaces that 404 with the question + answer COUNT + a way in — `Join` (open), `Request to join` + "Request sent" confirmation (request), explanatory note (invite_only, no dead button). **⚠️ `joinCommunity` only `revalidatePath('/communities/{slug}')`, which does NOT refresh the question page** — so the component calls `router.refresh()` after an open join, or you join and keep staring at the locked panel.
- **`questions/[questionId]/page.tsx`:** question is now fetched **BEFORE** the access gate (a non-member has to be shown it). Non-member branch returns early with title/body/photos/asker/date + the gate.
- **Privacy rule:** `canPreview = !canSee && status==='published' && (community.is_listed || question.is_public || isNumberedQotw)`. Everything else still 404s → an unlisted community's Q&A is never exposed by URL guessing. Answers stay members-only: the non-member path runs a `count`-only query with `head: true`, so answer bodies are never fetched (same discipline as the logged-out preview).
- **⭐ SELF-CAUGHT INVERSION (the reusable lesson):** the first version gated on `is_listed || is_public` only — which left a **numbered QotW in an unlisted community as a 404 for signed-in visitors while staying readable to logged-out strangers** via `/qotw/N`. That is the SAME "signed-in sees less than a stranger" bug the fix exists to kill. **Whenever you gate a page, check it against what the LOGGED-OUT preview already exposes — the authenticated path must never be strictly more restrictive.** Fixed by adding the `isNumberedQotw` lookup.
- Changelog 07-26 entry added (member-facing — unlike the staff-only work earlier the same day).
- **⏳ OPEN / tied to `/library`:** this fix is good under `join_mode='open'` (current). Sean's recorded plan to switch Body Doubling back to closed would turn every Silas `/library` link into an approval wall (request) or a polite dead end (invite_only) — so **join mode is part of `/library`'s design, not a separate setting.**

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

## Bulk-Add Members (07/15/2026 — SHIPPED `b12e951` + `d2fae29`)
- Live-meeting onboarding tool: an operator types members' details into a spreadsheet-like grid and creates their accounts on the spot. Page `communities/[slug]/bulk-add/page.tsx` (gated to **owner / organizer / platform-staff** — heavier than everyday mod, mirrors "who can email all members"), linked from Settings → Members. `components/community/BulkAddMembers.tsx` (grid: Username · Email · Password, auto-grows, **paste from Excel/Sheets**, a shared temp-password field + "Apply to all"). Action `app/actions/bulk-members.ts`.
- **⚠️ Email confirmation is OFF on Stoke's Supabase** (verified empirically) and `admin.auth.admin.createUser({ email_confirm: true })` **sends NO email** (unlike `inviteUserByEmail`) — those two facts together are what make operator-created accounts work instantly.
- Per row: `createUser` with `user_metadata: { username, display_name }` (the `handle_new_user` trigger builds the profile from it), then insert/reactivate a `community_members` row as active — **bypasses join_mode by design**. Respects `checkMemberLimit`, skips banned, leaves existing members' roles untouched. Audits `member.added`.
- Welcome email (`bulkWelcomeHtml`) fires **only for newly-created accounts** — existing accounts added to a community already have a login. **⚠️ It emails the PLAINTEXT temp password** (accepted: throwaway, changed on first login).
- **GOTCHA (this box):** `curl` returns `000` for ALL stoke.community URLs here (broken TLS/network in the sandbox) — a poll for "404 → non-404" gives a FALSE positive. Use PowerShell `Invoke-WebRequest -SkipHttpErrorCheck` for status checks. A 307 to /login proves an auth-gated route deployed fine.
- **GOTCHA:** the `resend` SDK import path is fiddly in a standalone node script — just POST `https://api.resend.com/emails` with fetch + Bearer key.
- GRACE community: slug `grace-grassroots-arts-community-education`, `join_mode:'request'`.
## Channels / Gathering Spaces
> Per-feature build narrative archived in `docs/claude-md-archive/2026-07-26-narrative-archive.md`.
- `channels`: community_id, name, description, position, created_by. `messages`: channel_id, author_id, content, `image_url`, `photos text[]`, `edited_at`, `previous_content`, `reply_to_id`, deleted_at/deleted_by — in the `supabase_realtime` publication.
- Server loads last 50 messages + a profile cache; the browser client subscribes to `postgres_changes` filtered by `channel_id`. Messages grouped Discord-style (consecutive same-author collapsed). **Chat sends are CLIENT-SIDE direct inserts — there is no server action** (which is why chat photo auditing needed a DB trigger, not app code).
- **Editing** (`editMessage`) is **author-only** — mods can delete but never reword someone's words (same rule as Q&A). Blocks editing a deleted message, blocks emptying a text-only message. Stores `metadata: { channel_id, before, after }` so both audit surfaces render a strikethrough `old → new`. **⚠️ The realtime UPDATE handler must carry `content` + `edited_at`, not just `deleted_at`** — it was originally written for delete/restore only, so edits silently failed to propagate to other viewers.
- **Undo:** `previous_content` holds one level; `revertMessage` (author-only) swaps back and CLEARS it. Revert keeps "(edited)" and sets a fresh `edited_at` — truthful, since the row really was just modified.
- **Replies:** single-level Discord-style (`reply_to_id`, ON DELETE SET NULL so soft-deletes keep the quote). `notifyReply` pings the parent author (skips self, active members only, 5/hr cap). Clicking a quoted reference scroll-jumps to the parent with a purple pulse. **⚠️ Re-clicking the same target is a no-op unless you `setMentionedId(null)` then re-set on `requestAnimationFrame`** — an unchanged state value skips the re-render so the animation never restarts.
- **Reactions:** `message_reactions` (unique on message_id+user_id+emoji), **`channel_id` denormalized** because a `postgres_changes` filter can only key off a column on the same table, and **`replica identity full`** because the default DELETE payload ships only the PK — without it you can't tell which reaction to drop. Curated 8-emoji set. Notifications **coalesce**: an existing unread reaction notif for that message is UPDATEd silently (the bell only subscribes to INSERT, so it never re-pings) — deliberate low-noise choice for the ADHD audience.
- **`!` community-link picker — DESIGN LOCKED, BUILD PARKED** (low utility until a 2nd community has real members). Symbol convention: `#` = channel (Discord parity), `@` = user, `!` = community. Mirror the existing `@` machinery in `ChannelView.tsx`. **⚠️ Store the community `id` (UUID) in `messages.content`, NEVER the slug** — resolve id → current name + slug at render time so past mentions survive a rename. Tokenize in a channel-scoped renderer, NOT in global `RichContent` (would misfire on `!word` elsewhere). Picker shows listed communities + the user's own memberships.
- **Editable community slug — DESIGN NOTE, not built.** Natural home is Settings → General, but the slug is the identifier in every URL including the QotW numbered links actively shared in Discord — editing one 404s every shared link. If built, pair it with a slug-history/alias table for old→new redirects, or at minimum a hard warning.
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
- **YouTube embeds (07/02/2026):** `getYouTubeId` regex extended to also match `youtube.com/shorts/` + `youtube.com/live/` (was only `watch?v=`/`youtu.be/`/`embed/`/`v/`) — Shorts/live links from mobile now embed as players everywhere (shared helper → all 5 surfaces). Also on the Q&A answer render (`questions/[questionId]/page.tsx`): when `a.url` is a YouTube link, show the `<LinkPreview>` player + a tidy "Watch on YouTube ↗" label instead of the raw URL string; non-YouTube URLs keep the raw-link-then-preview layout. Context: a member posted a great YouTube answer (Sean approved + watched it), prompting "how do we best integrate answers that are links to YouTube videos?" — answer: it already embedded via the `url` field / body auto-detect; these two tweaks close the Shorts gap + clean the display.

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
- **TWO audit surfaces, keep in sync:** the PLATFORM audit (`AuditLogClient.tsx`, `/admin/audit-log`) AND an inline community audit renderer in `communities/[slug]/settings/page.tsx` (`#audit-log` section) — both compute their own `targetLink` `View →`. Add any new target-type link to BOTH.
- **`View →` link resolution by `target_type`:** `post`/`resource`/`event` → `?tab=...`; `message` → channel `?message=`; `question` → `/communities/{slug}/questions/{target_id}`; `answer` → `/communities/{slug}/questions/{meta.question_id}#answer-{target_id}` (answer's `target_id` is the ANSWER id; the question id lives in `metadata.question_id`, present for created/submitted/approved/edited/accepted, NOT rejected/deleted). Both surfaces skip links for `*.deleted`/`*.rejected` actions (`gone` guard — their pages 404). Published answers carry an `id="answer-{id}"` + `scroll-mt-20` anchor on `questions/[questionId]/page.tsx` for the jump-to-answer target. (Commit `a5e13f3`, 07/09; **✅ verified live 07/10 — the answer `View →` jumps to the exact answer**.)
- **`message.edited` shows before/after (07/10):** the edit action stores `metadata.before`/`metadata.after` and BOTH surfaces render a strikethrough `old → new` line (`truncEdit()` = whitespace-collapse + 140-char cap). Delete still stores `metadata.content` but nothing renders it (deleted content is intentionally not surfaced; only edits show the diff). Any edit made before the 07/10 follow-up has no before/after (only `channel_id` in metadata).

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

## Community Ownership Transfer (06/22/2026 — was the "Known Bugs / Open Items" gap, now BUILT)
- `transferOwnership(communityId, slug, newOwnerId)` in `app/actions/community.ts`. UI = `components/community/settings/TransferOwnershipSection.tsx`, a red "Danger zone" section on the settings page, **shown only to the real community owner** (`isOwner` = `community.owner_id === user.id`; orgs/mods/platform-staff viewing settings don't see it).
- **No DB migration** — reuses `owner_id` column + `community_members` rows.
- **Billing follows owner_id automatically:** `getCommunityOwnerPlan()` in `lib/billing.ts` reads owner_id live, so transfer just updates owner_id and the new owner's plan takes over the limits. No per-community billing record to migrate.
- **Rules:** initiator = real owner OR platform staff (action allows both for future admin tool; UI only the real owner). Recipient must be an **active organizer** (deliberate pre-vetting; solo organizer must promote someone first — intentional friction). Old owner stays an active organizer (keeps access, loses owner-only powers). Billing guardrail: `checkCommunityLimit(newOwnerId)` blocks if recipient is at their plan's community cap. Member/channel counts NOT retroactively enforced (same as a downgrade). Confirmation = type-the-community-name. Notifies new owner by email (`ownershipTransferredHtml`).
- **Audit:** action `community.ownership_transferred` (label "Transferred community ownership"); metadata `{from_owner, to_owner, from_owner_name, to_owner_name}` (names stored at write time). Both audit surfaces (community settings + platform `AuditLogClient`) render `· from {previous owner}` after the `· {new owner}` target_user line. Matters because platform-staff-initiated transfers have actor≠prev owner, so "from X" is the only place the original owner shows.
- **Post-transfer UX:** old owner's `router.refresh()` → `isOwner` now false → Danger zone disappears, but they're still organizer so `callerRole='organizer'`, no redirect, keeps settings access.

## Public Community Preview (06/22/2026 — Friction #3 from 06/18 launch audit)
- Logged-out visitors to canonical `/communities/{slug}` now see a public read-only preview instead of a login wall. New public page `app/preview/[slug]/page.tsx` (outside `(app)` group). `middleware.ts` **rewrites** (not redirects) logged-out hits on bare `/communities/{slug}` → `/preview/{slug}` so the URL stays canonical/shareable. Logged-in users fall through to the real page; logged-in hit on `/preview/...` redirects to `/communities/...`.
- Regex `^/communities/([^/]+)/?$` + exclude `['new','mine']` → only bare slug pages preview; directory, /new, /mine, and subpaths (settings/channels/questions) stay gated. `/preview/` added to middleware public allowlist.
- **Privacy boundary:** only `is_listed` communities expose a bulletin teaser; unlisted ones show header + "private community" note → slug doesn't leak content. (Body Doubling was the example here when it was unlisted; **it is `is_listed = true` as of 07/26**, so it now DOES show the teaser. The rule is unchanged — only the example moved.)
- Preview CTAs carry `?redirect=/communities/{slug}` (login + signup both honor redirect) so users land inside after auth.
- **LESSON: never hardcode '— Stoke Community' in page titles** — root `app/layout.tsx` metadata has `title.template: '%s — Stoke Community'` which auto-appends it (a hardcoded suffix double-appends).

## Member-facing Landing (06/22/2026 — Friction #4 from 06/18 launch audit)
- `app/page.tsx` now speaks to joiners, not just organizers: hero "Join a community" CTA + invite hint, a "Two ways in" section (Organizer / Joiner cards), joiner line on bottom CTA. **All joiner CTAs route to `/signup`, NOT the `/communities` directory** (directory is auth-gated → would hit a login wall).

## Reviews / Testimonials (06/23/2026 — `4b83f22` + `e1262ad`)
> Full build narrative archived in `docs/claude-md-archive/2026-07-26-narrative-archive.md`.
- Members leave reviews (optional 1–5 stars + text); mods approve, then **feature** a curated few that surface publicly as testimonials. Private feedback stays in tickets.
- **One `reviews` table, scope by nullable `community_id`** (NULL = a platform-level review of Stoke; non-null = community). Migrations `20260623000000_reviews.sql` + `20260623120000_review_replies_ordering.sql` — **both verified run**.
- **Two-tier:** pending → published (in-app to members) → `is_featured` (the public subset). Pending reads + all writes via `createAdminClient()`. All joins need `profiles!author_id(...)`.
- **⚠️ One review per author per scope needs TWO partial unique indexes** (`where community_id is not null` / `where community_id is null`) — NULLs are distinct in a plain unique constraint, so a single one wouldn't hold.
- **Edit → re-approval:** `editReview` forces `status='pending', is_featured=false` in the same update, so an edited review drops from all public display until re-approved.
- **Featured cap = 6**, ordered by `featured_position` (`reorderFeatured`). Organizer replies: `reply_body`/`reply_is_public`/`reply_by`/`reply_at`, one per review, public replies show wherever the review shows; private ones only to the author + staff (`canSeeReply` helper).
- **Eligibility:** community review = active member (mod/owner auto-publishes); platform review = any logged-in user. Platform-scope "mod" = owner/platform_moderator only.
- **Surfaces:** community Reviews tab (display-only for members, "manage in settings"), `ReviewsManager.tsx` in community settings AND `/admin/reviews`, featured reviews on `preview/[slug]` and the landing page (**renders nothing when zero featured**). Member entry at `/feedback`.
## Seed / Cleanup Scripts (`scripts/`)
- `seed-communities.mjs` / `unseed-communities.mjs` — 15 demo communities + ~45 fake users on `@seed.stoke.community` emails. Seed is idempotent/re-runnable; unseed deletes seed-owned communities (FK cascade) then the fake users (cascade clears profiles + memberships, including seed members of real communities). Run unseed before launch.
- `seed-bodydoubling-qa.mjs` — Body Doubling starter Q&A (KEEP; intentional content).
- `inventory.mjs` (read-only) — lists all communities (SEED vs REAL, owner email, listed, member count) + non-seed users (what they own, review count). Use before any deletion.
- `cleanup-test-communities.mjs` — deletes a hardcoded allow-list of hand-made test community slugs (Dracula Fans, Dorky Platypus Lovers, Mom's Art Group, Stonington Lobsta Party, Intrepid Design Gurus); hard-excludes bodydoubling; dry-run unless `--yes`.
- `cleanup-accounts.mjs` — deletes auth users by email passed as args; PROTECTED list refuses `baldwinseana@gmail.com` (flagship owner); dry-run unless `--yes`.
- All scripts load `apps/web/.env.local` (service role key). The CC auto-mode classifier blocks Claude from running `--yes` destructive deletes directly; Sean runs them himself in-session via the `! <command>` prefix.
- **Real account note:** `baldwinseana@gmail.com` owns the flagship BodyDoubling.com (slug `bodydoublingcom`, **listed as of 07/26**) + was the owner of test communities Dracula Fans + Dorky Platypus Lovers. `sean@bodydoubling.com` is Sean's CC login (owned test community Mom's Art Group). Stoke has NO public people directory (v1), so accounts owning no communities are invisible at launch.

## Static Assets, Hosted Docs & Launch (06/23–07/01/2026)
> Day-by-day launch post-mortem + Discord announcement history archived in `docs/claude-md-archive/2026-07-26-narrative-archive.md`.
- **⚠️ The middleware matcher must exclude EVERY hosted static file extension.** `middleware.ts` `config.matcher` originally excluded only image types, so `.pdf`/`.html` files in `apps/web/public/` hit the auth gate and redirected logged-out visitors to `/login`. Now excludes `pdf|html|ico|txt|xml|webmanifest` too. **Any new public static file type must be added there.**
- **⚠️ ALWAYS test hosted assets while LOGGED OUT, and check content markers not just status.** The login shell also returns 200 `text/html` (~13–23KB) with no `type=password` in the source (the form is client-rendered) — trivially mistaken for success. Verify `%PDF-` magic bytes for PDFs; for pages, look for real content markers.
- **PDF generation from HTML** (zero deps): headless Chrome/Edge print-to-pdf — see the elevated-terminal `--do-not-de-elevate` gotcha in the global CLAUDE.md tooling section, which is what silently breaks this.
- **✅ LAUNCHED 06/29/2026** via an `@everyone` blast in Discord #announcements (13k members), re-posted 06/30. **~42 reactions, ~11 signups in the first two days**; by 07/07, **35 signups / 32 active BD members**, ~2–3/day.
- **Funnel diagnosis (with real data, after an earlier wrong read from a *plan* rather than the posted message):** reach HIGH ✅, hook/resonance STRONG ✅, **signup completion LOW ❌**. The leak is CONVERSION — the intention-action gap between a frictionless 🔥 react and "leave Discord, make an account, learn a platform" (steep for an ADHD audience). Encouraging read: the idea is validated, the fix is friction.
- **Levers, prioritized:** (1) seed the room so a first visit shows a LIVING library, not an empty one; (2) shrink the per-touchpoint ask — "answer this one question" beats "explore a platform", which is exactly what QotW is for now the @everyone card is spent; (3) work the reactors as warm leads via direct DMs.
- **LESSON:** don't record a launch's reach or ping from a plan or a mod's stated intention — confirm from the actual posted message.
- Join how-to guide: `apps/web/public/how-to-join-body-doubling.{html,pdf}`. **⚠️ Written for the OPEN-join flow** — if Body Doubling switches back to closed, its instant-join steps need updating or the link taken down.
## Messaging / Framing Accuracy (06/29/2026 — Sean corrected me twice in one session)
- **Stoke is NOT "member-owned."** Sean owns the platform (Body Doubling LLC, platform `owner` role, Stripe billing). Communities have owners (`owner_id`) and are member-*driven* (members supply the value/Q&A), but nobody owns it collectively. Accurate strength framing = **independent** (not Discord, not VC/IPO-pressured, not ad/engagement-monetized) + **purpose-built** + **privacy-respecting** (no government-ID age-verification flow).
- **Stoke is NOT neurodivergent-specific.** It's a GENERAL platform for *any* reciprocal community ("LinkedIn meets Meetup"). Body Doubling is just its flagship/premiere community, not its theme.
- **Body Doubling leans neurodivergent but is NOT neurodivergent-exclusive.** The technique is *primarily* used by ADHD/neurodivergent folks but helps anyone; the community is open to all. Sean's locked launch wording *"tools and tips that work for our minds"* speaks to the lean WITHOUT claiming exclusivity — keep copy that way.
- **The Discord launch announcement draft is NOT persisted verbatim anywhere** (session logs/daily notes/diary only DESCRIBE its framing). Sean holds the working copy and is still iterating it. Don't reconstruct-as-retrieval — ask Sean for the current text.

## Profile Back Navigation (07/01/2026)
- **Problem (Sean):** clicking a member's profile had "no way to go back to where you clicked on it" — relied on the browser back button. Wanted it "part of the platform so nobody has to click 'back'."
- **`apps/web/components/BackButton.tsx`** (NEW, client component): "← Back" control, inline SVG arrow (no lucide in this repo — inline SVGs throughout). Calls `router.back()` when `window.history.length > 1` (returns to the exact origin — members list / Q&A / chat / audit log / reviews, wherever), else `router.push(fallback)` (default `/home`) for deep links with no in-app history. Prop: `fallback?: string`.
- Rendered at top of `app/(app)/profile/[username]/page.tsx` (a server component; BackButton is the client island). `npx tsc --noEmit` clean. Profile links are clicked from 11 files → "go back to origin" beats any hardcoded destination.
- ✅ Committed `8df1e1b` + pushed (Sean said "go") → deployed with the Stripe fix. **NOTE: now that Stoke is LIVE, I stopped auto-pushing and asked first (commit vs push are separate steps); Sean confirmed each.** Reconsider the global "always push after commit" CLAUDE.md rule — for a launched product, confirm before the push that triggers a prod deploy.

## Known Bugs / Open Items
- ~~Run BOTH reviews migrations~~ ✅ VERIFIED RUN 07/04: both `20260623000000_reviews.sql` (base `reviews` table) and `20260623120000_review_replies_ordering.sql` (reply + `featured_position` cols) confirmed present via a read-only service-role check (`reviews` selectable incl. `reply_body`/`featured_position`; 0 rows). Reviews feature + management are LIVE.
- ~~QotW question-page delete orphans the qotw_item / 404~~ ✅ FIXED 07/04: (1) `deleteQuestion` in `knowledge.ts` now also deletes the linked `qotw_items` row (was FK ON DELETE SET NULL → orphan with dead `/qotw/N` link) + revalidates `/qotw`; (2) on `questions/[questionId]/page.tsx`, a published QotW question (detected via `qotw_items.question_id`) shows a `⭐ QotW-N` badge and swaps the generic Delete button for a **"Manage in QotW →"** link to the manager — one canonical delete path, no confusing dual-confirm. tsc clean.
- **Repo hygiene (07/04):** added `*.stackdump` + `.claude/settings.local.json` to `.gitignore` (Windows/cygwin crash dumps kept reappearing); deleted the three stray stackdumps.
- ~~Run the QOTW migration~~ ✅ DONE 07/03: Sean ran `20260703000000_qotw_items.sql` (Supabase "success"; verified `qotw_items` queryable via service role, 0 rows). Commit `c87c531` (+ docs `0d5eabe`) PUSHED — both Railway services SUCCESS at `c87c531`. QOTW back-end is LIVE. Bank seeded with the 24 PDF questions as private drafts via `scripts/seed-bodydoubling-qotw-bank.mjs` (idempotent, `--remove` clears only unpublished). Nothing published yet.

## Role Hierarchy Clarifications (06/14/2026)
- **"Platform staff" is a narrow term:** `isPlatformStaff = ['owner','platform_moderator']` only. `community_manager` + `support` are platform TEAM but get NO in-community mod authority — a community organizer outranks them inside a community.
- **Most powerful non-owner = `platform_moderator`:** treated as `'owner'` by `getCallerRole` in EVERY community (can even appoint organizers), plus platform-wide bans. Still below owner: only owner assigns platform roles + bans platform-team members.
- **Community owner vs platform owner:** "community owner" = `communities.owner_id` (per-community, many people, scoped to that one community, their plan gates its limits). "Owner" = `platform_roles.role='owner'` (Sean, one person, authority across all communities + platform admin). Inside a community `getCallerRole` returns `'owner'` for BOTH — identical authorization, different reach. Sean is both for Body Doubling + dorky-platypus-lovers + dracula-fans.

## Context Budget / CLAUDE.md hygiene (07/26/2026)
- **Trigger:** Sean, looking at the memory file: *"I don't understand what can be freed here?"* Measured rather than guessed — startup load was **~238 KB ≈ 59k tokens = 30% of the 200k window gone before he typed a word** (project CLAUDE.md 153 KB + global 39 KB + SessionStart hook 45 KB).
- **Two fixes, ~112 KB / ~28k tokens freed (47%):**
  1. **The duplicate.** `C:/Users/Sean/.claude/scripts/session_start.py` was injecting the **global** CLAUDE.md, which Claude Code already loads natively as user memory — it was in context twice, verbatim. Removed (comment left in the script so a future session doesn't re-add it). Hook output 45.5 KB → 7.9 KB. It still injects the last 3 session logs; only the CLAUDE.md read was dropped.
  2. **Archive pass.** Six narrative-heavy sections moved **verbatim** to `docs/claude-md-archive/2026-07-26-narrative-archive.md` (99,832 bytes, nothing deleted), each replaced by a condensed version + a `>` pointer line. Project CLAUDE.md 153,202 → 79,184 bytes.
- **⚠️ THE RULE THIS ESTABLISHES — what belongs in CLAUDE.md vs the archive:** KEEP every schema, migration name, ID, file path, decision, and ⚠️ gotcha. ARCHIVE the day-by-day debugging narrative — how a bug was found, what was tried, what turned out wrong. Once a thing is fixed, *the fix* is durable and *the hunt* is history. A section that reads like a story instead of a reference is the signal.
- **Also corrected 3 stale headers** claiming "NOT yet committed" for work that shipped weeks earlier (capture pipeline `de58d9d`, bulk-add `b12e951`, moderator guide `504f65e`). Stale status lines cost tokens **and actively mislead** — they're worse than bloat.
- **Method worth reusing** (avoids re-reading the whole file into context to edit it): a PowerShell pass extracts the target line ranges verbatim into the archive and leaves `<!--SLOT-NAME-->` markers behind; then `Edit` each marker with freshly-written condensed prose. Original backed up to the session scratchpad first.
- **Shipped as `b8f2e33`** (CLAUDE.md + `docs/claude-md-archive/`), alongside the join gate `70c085b`. Deliberately left untracked: `CLAUDEbackup.md` (superseded by the archive doc), `images/`, `Question-of-the-Week-BodyDoubling.pdf` (already seeded to DB), `.claude/name` + `.claude/settings.json` (local tooling).
- **⏳ THE REAL LEVER IS GROWTH RATE, not size.** Every `/s` appends a new dated section and nothing ever compacts one, so this file re-bloats on a predictable curve. `/pulse` reports size vs threshold but doesn't act. Offered Sean an archive threshold folded into `/s`; **not yet built.** Until it is, expect to repeat this pass.

## Git
- No Co-Authored-By lines in commits
- Use PowerShell with semicolons not `&&`
- **Always push to GitHub after every commit** — no need to ask. This stands until Sean explicitly says the project has gone live.
- **⚠️ CHANGELOG — STANDING RULE (every session must follow; this is the mechanism that keeps `/changelog` current):** whenever a commit ships a **user-facing** change (something a *member* would notice — a new feature, a visible behavior/UI change, a new page), **add a plain-language entry to `apps/web/lib/changelog.ts` in the SAME commit.** `lib/changelog.ts` is the single source of truth for the public `stoke.community/changelog` ("What's new") page AND for Sean's Discord/announcement copy.
  - **Curate — do NOT log everything.** Skip internal-only work: bug/cron fixes, refactors, `tsc`/build tweaks, docs/CLAUDE.md edits, repo hygiene, migrations with no visible effect. (Example: the 07/07 session shipped a cron fix + doc commits that produced ZERO entries, and features that produced 3.)
  - **Format:** newest entry first; `{ date: 'YYYY-MM-DD', title: 'short headline', items: ['You can now…', …] }`. Bullets short + benefit-led. Group a day's shippable changes under one dated entry (add items to today's entry if one already exists).
  - **Proactively offer** a matching changelog entry when Sean ships a user-facing feature even if he doesn't ask — the whole point (his words) is *"track system changes so I can put out announcements."* Then he lifts announcement copy straight from the entry.
  - This rule exists because a stated in-session intention does NOT persist across sessions — only CLAUDE.md (auto-injected each session by the SessionStart hook) does. If this rule is here, future sessions will actually act on it.

## Discord Capture Pipeline: Silas! → Stoke (SHIPPED 07/23–07/25/2026)
> Five dated build sections (P0–P4 plan, capture photos, photos tab, dismiss fix, photo audit, moderator guide) consolidated here. Full narrative in `docs/claude-md-archive/2026-07-26-narrative-archive.md`.

**What it does.** A Discord mod right-clicks a message → **Apps → "📚 Capture for Stoke"** → Silas! DMs the original author for consent (✅ credit / 👤 anonymous / ❌ no) → granted captures land in Stoke's mod review queue → a mod files them into the Q&A library → the author can later claim the post onto their own profile. **Consent is the durable record; nothing publishes while pending.**

**Consent properties (the heart of it):** a button click tied to their Discord account, timestamped, stored beside the content; declines are terminal AND recorded; anonymous is first-class; credit upgrades to a real profile only via the author's own claim action.

- **Silas system user on Stoke:** `silas@stoke.community`, **`SILAS_USER_ID = 28184489-f70d-4943-a050-fc51e833905b`** — filed captures are authored by this user with an `attribution` line instead of an author profile link.
- **`discord_captures` table** (`20260723000000_discord_captures.sql`, RLS-on-no-policy = service-role only). **⚠️ ACTUAL column names** (the original spec was wrong): `discord_author_name` (not `author_name`), `created_at` (not `captured_at`), plus `consent_asked_at`/`consent_answered_at`, `discord_message_id` UNIQUE, `content`, `photos text[]`, `claim_token`, `claimed_by`, `question_id`, `answer_id`, `dismissed_at`. Also adds nullable `attribution` + `photos[]` to `kb_answers`/`kb_questions`.
- **Silas side** (`src/capture.js` in the Silas repo, Supabase via plain fetch, zero new deps). `captureEnabled()` = `SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && STOKE_COMMUNITY_ID` — unset = dormant. Consent PATCH filters `consent_status=eq.pending` so an answer can never be overwritten (race-safe). On a 409 duplicate it revives a `declined`/`dismissed` row to pending; granted/filed ones stay blocked.
- **⚠️ Silas Railway project is `energetic-possibility` / service `bodydoubling-pomodoro-bot`** — NOT `melodious-purpose` (that's Plish).
- **⚠️ THE ENV-VAR GOTCHA:** command registration (`railway run npm run deploy`) is SEPARATE from runtime env — `deploy-commands.js` only needs DISCORD_TOKEN/CLIENT_ID/GUILD_ID, so **a successful registration proves NOTHING about the Stoke vars**. The first live test failed with "Capture isn't configured" because the 4 Stoke vars were never set on the service. `railway variables --set` auto-triggers a redeploy.
- **⚠️ Discord CDN attachment URLs are SIGNED and EXPIRE (~24h)** (`?ex=&is=&hm=`) — you CANNOT store the raw link. Silas downloads each image at capture time and re-uploads to Stoke's public `avatars` bucket at `discord-captures/{messageId}/{i}-{rand}.{ext}`. TIP: strip Discord's `format=webp&width=&height=` params (keep `ex`/`is`/`hm`) to fetch the full-res original instead of the thumbnail.
- **⚠️ The bot CANNOT REST-`GET` a message** in a channel it lacks View/Read History on (403 code 50001) — but a **context-menu capture works anyway**, because the interaction hands it the resolved `targetMessage`.
- **Stoke side:** `app/actions/captures.ts` + `components/community/CaptureActions.tsx`; a "Discord captures" section on `communities/[slug]/moderation` lists granted-but-unfiled captures; filing publishes pre-approved (the mod curated by capturing — no second queue). Anonymous renders "a community member".
- **Claim funnel:** `/claim/{token}`; middleware sends logged-out visitors to `/signup?redirect=/claim/{token}` so the token survives auth. Works months later. Identity proof = token possession (no Discord OAuth in v1 — a known soft spot). **⚠️ Claiming NULLS `attribution`** — the "Shared by X on Discord" line disappears BY DESIGN and it renders as ordinary self-authored content. Don't misread that as the capture having failed.
- **Delete ≠ discard:** deleting filed content sets `dismissed_at` on the linked capture BEFORE deleting, so it doesn't bounce back into the queue via `ON DELETE SET NULL` (`20260724020000_capture_dismissed.sql`; the queue + gear badge both filter `.is('dismissed_at', null)`). A **discarded** capture's row is DELETED (only the audit event survives); a **declined** one is KEPT as the record that consent was asked and refused. Deleting the question then discarding also walks around the "discard blocked once published" guard — published is not a durable lock.

### Photos Tab + photo auditing
- **Photos tab** (6th community tab): members see the curated gallery only; the **"All photos" aggregate is organizer/mod-only**, because some inline images come from role-gated channels a member can't see. `components/community/CommunityPhotoWall.tsx`. Tab is conditional — mods always, members only when a curated gallery exists.
- **Multi-image readiness:** `messages.photos text[]` added (`20260724010000`) and the aggregate reads BOTH `image_url` (legacy single) and `photos[]`, so a future multi-image chat composer needs no rework. The composer UI itself is NOT built.
- **Photo audit:** `logPhotos({actorId, communityId, added, removed, source, parentId})` + `PHOTO_SOURCE_LABELS` in `lib/audit.ts`, wired into gallery/bulletin/events/captures/knowledge. **Chat needed a DB trigger instead** (`log_message_photos()`, `20260724030000`) because chat sends are client-side direct inserts. Both audit renderers show a 48px thumbnail + source label. **GOTCHA (not a bug):** the trigger doesn't backfill — a message created before the migration logs only its removal.
- PostgREST validated: `.or('image_url.not.is.null,photos.neq.{}')` — the empty-array clause parses fine.

### Moderator guide (`/guide/capture`, LIVE)
- Staff-gated page `app/guide/capture/page.tsx` with 10 screenshots, same guard as `/guide`. PDF (`docs/moderator-guide-silas-stoke.pdf`) is **NOT hosted** — attached directly in Discord mod-chat. It was moved OUT of `public/` because anything there is served to anyone with the URL, which would have contradicted the gating.
- **⚠️ Screenshots are gated too, via `app/guide/capture/shots/[name]/route.ts`** serving from `apps/web/guide-shots/` (outside `public/`): 404 (not 403) for non-staff, filename allowlist regex, traversal guard. **`lib/guide-access.ts` `getGuideAccess()` is the ONE gate shared by page and asset route** — *a gated page whose images are ungated is not gated.* Reuse this pattern for any future gated-asset page.
- **⚠️⚠️ THE PROD-ONLY TRAP:** `output: 'standalone'` only bundles files Next can TRACE, and **images read via `fs` are invisible to the tracer** — they work locally and 404 in production only. Fixed with `outputFileTracingIncludes` in `next.config.ts`. **Any future file served via `fs` from a route handler needs this.**
- **PRE-EXISTING BUG, deliberately not fixed:** the `postbuild` script copies to `.next/standalone/.next/static`, but monorepo standalone output actually nests at `.next/standalone/apps/web/.next/` → postbuild fails on a local build. Railway's env resolves differently and deploys succeed. **Method worth repeating: when a build breaks after your change, revert ONLY your change and rebuild before claiming or denying ownership.**
- `CommunityGear`'s badge only renders when `pendingCount > 0`, so the gear-badge screenshot is only shootable in the window between consent granted and filing.

### Reusable lessons from this feature
- **⭐ When the artifact is retrievable, LOOK AT IT before characterizing what was lost.** I reasoned from metadata (real moderator + credited consent + a filed question) to "lost member content worth restoring" and recommended a re-capture — then opened the surviving image and found it was a UI/config screenshot from a mod working conversation, i.e. deleting it was correct curation. Storage outlives the row; a public `avatars` URL + the Read tool is all it takes.
- **A notes-vs-DB "discrepancy" is usually neither a bug nor a bad note** — the note was true when written and reality moved on. **Check `audit_log` FIRST:** it outlives the rows it describes and reconstructs the whole timeline.
- **Read-only Supabase probes with ZERO deps:** a scratchpad `.mjs` can't `import '@supabase/supabase-js'` (resolves from the script dir, not cwd) → plain `fetch` on `${SUPABASE_URL}/rest/v1/…` with `apikey` + Bearer headers. Exact counts via `Prefer: count=exact` + `Range: 0-0`, then read `content-range`.

### Parked
- **`/library` retrieval slash command** in Discord (Silas searches the Stoke KB, returns links = the funnel in reverse). **⚠️ Join mode is part of its design, not a separate setting** — switching Body Doubling back to closed would turn every `/library` link into an approval wall or a dead end.
- Silas features INSIDE Stoke (pomodoro/chimes) = NO, voice is out of v1 scope.
- Pending-capture auto-expiry (mods re-nudge manually) and consent revocation (honored manually via ticket/DM) — both deliberate v1 defaults.
