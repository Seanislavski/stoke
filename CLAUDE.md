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

## Feature Reference — split out of this file (07/28/2026)
> **These are NOT archives.** They are full reference docs — schemas, IDs, file paths, decisions, ⚠️ gotchas — moved out of the auto-injected context because they're only needed when working on that feature. This file is injected into *every* session; these are read on demand. **Read the relevant file BEFORE touching that feature**, and keep adding to it there rather than back here.
> Rule of thumb for what lives where: **cross-cutting patterns, governance, and traps that fire unexpectedly stay here; per-feature detail goes to `docs/reference/`.**
- **`docs/reference/discord-capture-pipeline.md`** — the Silas!→Stoke capture → consent → file → claim funnel; `discord_captures` + `discord_outbox` schemas; `SILAS_USER_ID`; Photos tab + photo auditing; the staff-gated `/guide/capture`. ⚠️ Discord CDN URLs expire, so images are re-uploaded at capture time; a gated page needs a gated asset route (`lib/guide-access.ts`); files served via `fs` need `outputFileTracingIncludes` or they 404 **in production only**; the outbox's partial unique index makes a suppressed duplicate look identical to a broken feature.
- **`docs/reference/events-and-channels.md`** — Events (recurring series materialized as real rows, RSVPs, reminders) and Channels/Gathering Spaces (messages, edits + undo, replies, reactions). ⚠️ Timezones have TWO independent problems — the creator's input zone and the viewer's display zone; chat sends are **client-side direct inserts**, so anything needing server logic (e.g. photo auditing) needs a DB trigger, not app code.
- **`docs/reference/community-lifecycle.md`** — Community profile (about/cover/gallery), Bulk-Add Members, ownership transfer, public preview, member-facing landing, Reviews/testimonials, Organizer Guide. ⚠️ The privacy boundary: **branding (avatar, banner) shows on public preview; content (About, gallery, bulletin teaser) is listed-only.**
- **`docs/reference/billing-tickets-invites.md`** — Stripe billing (plans, webhooks, Dahlia API), support tickets, invite links. ⚠️ **Plan caps come from `apps/web/lib/billing.ts`, never from memory.**
- **`docs/reference/ui-and-media.md`** — Photos & media components + upload paths, link embeds, HomeHero scroll, profile back navigation, the legacy Resources tab. ⚠️ New storage upload paths need a matching storage policy.
- **`docs/reference/ops-and-launch.md`** — hosted static assets, launch history + funnel diagnosis, seed/cleanup scripts. ⚠️ **The middleware `config.matcher` must exclude EVERY hosted static file extension** (`pdf|html|ico|txt|xml|webmanifest`) — a new public file type that isn't listed gets auth-gated and redirects logged-out visitors to `/login`. Always test hosted assets **while logged out**, checking content markers (`%PDF-`) not just status codes.

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
> Commit-by-commit UI history archived in `docs/claude-md-archive/2026-07-28-narrative-archive.md`.
- **Global gear** (AppNav): avatar + gear → dropdown; items gated on the `platformRole` prop from the layout. ONE "Admin" entry → `adminHref(role)` lands each platform role on its first usable page (owner→`/admin`, platform_moderator→`/admin/users`, community_manager→`/admin/communities`, support→`/admin/support`); **`AdminNav` is the source of truth once inside**. Plus a "What's new" link → `/changelog`.
- **Community gear** (`CommunityGear.tsx`): client dropdown (click-outside close), gated on `isMod` — **Review queue (N badge) · Question of the Week · Settings · Audit log** (audit deep-links `/settings#audit-log`). Badge = `totalPending` = joins + reviews + posts + questions + **answers**. There is deliberately no separate "N to review" pill (it duplicated this badge).
- **Header role badges** (`JoinButton.tsx`, `role` prop from `myMembership?.role`, `RoleBadge` subcomponent) — badge and Leave coexist: owner → "Owner" (no Leave, owners can't leave); organizer → "Organizer" + Leave; moderator → "Moderator" + Leave; member → Leave only; non-member → Join/Request; logged-out → nothing (preview).
- **Mobile:** community header row is `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4` (stacks on mobile); the 5-tab strip is `overflow-x-auto` with `shrink-0 whitespace-nowrap` tabs.
- **Settings quick-nav:** sticky anchor sub-nav (`top-14 z-[5] overflow-x-auto`) — General·Spaces·Q&A·QotW·Reviews·Invites·Members·Email·Danger·Audit; each `<section>` has an `id` + `scroll-mt-20`; Email/Danger render conditionally (organizer/owner, owner).

## Q&A Question/Answer Editing (07/07/2026 — `d1af1d8`, LIVE, no migration)
- **Rules:** author/asker-only. **Member edit to a PUBLISHED item → back to `pending`** (mods emailed via `kbAnswerSubmittedHtml`/`kbQuestionSubmittedHtml`, amber "back in review" notice; clears approved_by/published_at, plus `is_accepted=false` on answers). **Mod/owner edit stays LIVE.** Member edit to a pending item stays pending. **QotW questions are edit-locked to mods** (`canEdit = isMod || (isAsker && !isQotw)`) so a member can't pull a numbered QotW back into review. Non-authors can't reword others' answers (mods delete only).
- **Impl:** `editAnswer`/`editQuestion` in `knowledge.ts` (`requeue = !isMod && status !== 'pending'`); audit labels `answer.edited`/`question.edited`; `components/knowledge/EditAnswer.tsx` + `EditQuestion.tsx` use the **children-slot pattern** (view mode renders the server display + an Edit affordance; `canEdit` false short-circuits to `<>{children}</>`; `RichContent` is `'use client'` so it nests inside). Wired into `questions/[questionId]/page.tsx`.

## Moderation Review Queue (07/07/2026 — `071c191`, LIVE, no migration)
- **Mod-only page `app/(app)/communities/[slug]/moderation/page.tsx`** aggregates ALL pending in one place with inline approve/reject: **join requests · bulletin posts · Q&A questions · Q&A answers · reviews** (empty state "🎉 All clear"). Exists because pending items were otherwise fragmented per-tab, and **pending ANSWERS appeared only on each question's own detail page** — no aggregation anywhere.
- Reuses `approveRequest`/`rejectRequest`, `ModActions` (posts), `QuestionModActions` + category, `AnswerModActions`, `approveReview`/`rejectReview`; pending answers are labeled with their question title + link via a batch `titleById` map. Generic `components/community/QueueActions.tsx` (bound-action approve/reject, Done-in-place) serves requests + reviews.
- Gear badge = `totalPending` via 3 count queries on the community `page.tsx`. All reused components use the in-place "Done" pattern.

## Changelog / "What's New" (07/07/2026 — `e12659d` + rule `0adb2fe`, LIVE)
- **Single source of truth = `apps/web/lib/changelog.ts`** (typed `ChangelogEntry[] {date,title,items[]}` — human-readable, so it IS the doc; no markdown-parser dep, no drift). Public page `app/changelog/page.tsx` (timeline UI, mirrors `/about` header + `MarketingFooter`); `middleware.ts` `isLegalPage` includes `/changelog` so it's readable logged-out. Linked from `MarketingFooter` + the AppNav dropdown.
- **⚙️ THE MECHANISM that keeps it current — two layers, deliberately:** (1) a STANDING RULE in the **Git section of this file** — any commit shipping a user-facing change adds a plain-language entry in the SAME commit; (2) a project-agnostic **backstop step 5 in the global `/s`** (`C:/Users/Sean/.claude/commands/s.md`) that sweeps for un-logged changes at session end. Per-commit is precise, `/s` is the safety net. **Rationale: an in-session intention does NOT persist across sessions — only CLAUDE.md (auto-injected) and `/s` do.**

## Storage
- `avatars` bucket (public): path `{userId}/avatar`, upsert:true; URL has `?t={Date.now()}` for cache busting
- Supabase storage domain added to `next.config.ts` remotePatterns: `gzssbicdblkmllutegju.supabase.co`

## Platform Ban
- `profiles.is_banned` bool — account-wide ban
- Middleware checks `is_banned` for all authenticated protected routes → redirects to `/banned`
- **NEVER put signOut() in middleware** — causes redirect loop where banned user can't re-access /login. Client-side signOut in /banned page useEffect only.
- `/banned` page: client component, calls `supabase.auth.signOut()` in useEffect, shows suspended message + link to /login
- Only `owner` platform role can ban other platform team members (platform_moderator, community_manager, support)

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
- **QotW congrats on unclaimed Discord captures — ✅ FIXED 07/28 via the DM outbox (see the Discord Capture Pipeline section).** The bug: `captures.ts` files a capture with `asker_id: capture.claimed_by ?? SILAS_USER_ID` and `qotw.ts` congratulated `question.asker_id`, so promoting an **unclaimed** capture emailed the `silas@stoke.community` bot mailbox while the human who wrote it heard nothing. Now `publishExistingQuestion` looks up `discord_captures` by `question_id`: an unclaimed capture routes to the Discord author via `discord_outbox` (bell + email SKIPPED — the bot has no business getting either); a **claimed** one falls through to the normal in-app path, which is correct because claiming reassigns `asker_id` to the real profile.
- **Capture → QotW is a CURATION call, not a pipeline (decided 07/26).** Captures are strong QotW candidates because they already proved they resonate in a 13k-member Discord (better signal than a cold bank draft), but most are specific/advice-shaped, so auto-routing would dilute the bank. `PublishAsQotwButton` already sits on the question detail page = one click for mods. **Always promote IN PLACE; never copy capture text into the bank** — a bank release creates a new owner-authored question and destroys both the member's credit and the consent chain. An already-answered question makes a FINE QotW (no-deadlines rule keeps it open; it reads as a living library, matching the post-launch seeding lever).
- **`source: 'maintenance-script'` appears in `audit_log.metadata`** for actions taken by scripts rather than the UI — useful when a question's history looks like it changed on its own.
- **Public numbered links:** `/communities/{slug}/qotw/{n}`; middleware rewrites logged-out hits → `/preview/{slug}/qotw/{n}`. `deleteQuestion` also deletes the linked `qotw_items` row (else a dead `/qotw/N`); a published QotW's detail page swaps the generic Delete for "Manage in QotW →" so there's one canonical delete path.
- **⚠️ CRON_SECRET is deliberately NOT recorded in this file** (it's in the repo) — it lives in `apps/web/.env.local`, Railway env vars, and Obsidian.
- **Body Doubling:** slug `bodydoublingcom`, id `5310e8c7-1276-485f-b77e-406d7edcf890`. **⚠️ LIVE STATE 07/26: `is_listed = true`, `join_mode = 'open'`** (verified by service-role probe). Older notes saying "unlisted" are stale — re-probe if privacy reasoning depends on it.
- **LESSON (cost a wrong answer twice):** never quote a live metric or live DB state from memory — pull it. Seed scripts: `seed-bodydoubling-qa.mjs`, `seed-bodydoubling-qotw-bank.mjs` (both idempotent, `--remove` to undo).

## Signed-in non-member question gate (07/26/2026 — SHIPPED `70c085b`, pushed)
- **The gate is MEMBERSHIP, not signup.** Before this, `questions/[questionId]/page.tsx` did `canSee = isMember || isMod` → else `notFound()`, so a signed-up non-member got a **bare 404** — the least informative screen on the platform, handed to the person furthest along the funnel.
- **`components/knowledge/QuestionJoinGate.tsx`** (client) replaces that 404 with the question + answer COUNT + a way in: `Join` (open), `Request to join` + "Request sent" confirmation (request), explanatory note for invite_only (no dead button). **⚠️ `joinCommunity` only revalidates `/communities/{slug}`, NOT the question page** — the component calls `router.refresh()` after an open join, or you join and keep staring at the locked panel.
- The question is fetched **BEFORE** the access gate (a non-member has to be shown it); the non-member branch returns early with title/body/photos/asker/date + the gate.
- **Privacy rule:** `canPreview = !canSee && status==='published' && (community.is_listed || question.is_public || isNumberedQotw)`. Everything else still 404s, so an unlisted community's Q&A is never exposed by URL guessing. Answers stay members-only — the non-member path runs a `count`-only query with `head: true`, so answer bodies never reach memory.
- **⭐ SELF-CAUGHT INVERSION (the reusable lesson):** the first version gated on `is_listed || is_public` only, which left a **numbered QotW in an unlisted community as a 404 for signed-in visitors while logged-out strangers could read it** via `/qotw/N` — the same "signed-in sees less than a stranger" bug the fix existed to kill. **Whenever you gate a page, check it against what the LOGGED-OUT preview already exposes; the authenticated path must never be strictly more restrictive.**
- **⏳ OPEN / tied to `/library`:** this is good under `join_mode='open'` (current). Switching Body Doubling back to closed turns every Silas `/library` link into an approval wall or a polite dead end — **join mode is part of `/library`'s design, not a separate setting.**

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

## Audit Log
- `components/admin/AuditLogClient.tsx`: client component, instant text search across actor/action/community/target, 500 entry limit
- Full ACTION_LABELS list includes: member.joined, member.requested, post.created, post.submitted, resource.created, resource.submitted, event.created, event.deleted, and all mod actions
- Pattern: always `.select('id').single()` on insert, then `logAction({ actorId, communityId, action, targetId, targetType })`
- **TWO audit surfaces, keep in sync:** the PLATFORM audit (`AuditLogClient.tsx`, `/admin/audit-log`) AND an inline community audit renderer in `communities/[slug]/settings/page.tsx` (`#audit-log` section) — both compute their own `targetLink` `View →`. Add any new target-type link to BOTH.
- **`View →` link resolution by `target_type`:** `post`/`resource`/`event` → `?tab=...`; `message` → channel `?message=`; `question` → `/communities/{slug}/questions/{target_id}`; `answer` → `/communities/{slug}/questions/{meta.question_id}#answer-{target_id}` (answer's `target_id` is the ANSWER id; the question id lives in `metadata.question_id`, present for created/submitted/approved/edited/accepted, NOT rejected/deleted). Both surfaces skip links for `*.deleted`/`*.rejected` actions (`gone` guard — their pages 404). Published answers carry an `id="answer-{id}"` + `scroll-mt-20` anchor on `questions/[questionId]/page.tsx` for the jump-to-answer target. (Commit `a5e13f3`, 07/09; **✅ verified live 07/10 — the answer `View →` jumps to the exact answer**.)
- **`message.edited` shows before/after (07/10):** the edit action stores `metadata.before`/`metadata.after` and BOTH surfaces render a strikethrough `old → new` line (`truncEdit()` = whitespace-collapse + 140-char cap). Delete still stores `metadata.content` but nothing renders it (deleted content is intentionally not surfaced; only edits show the diff). Any edit made before the 07/10 follow-up has no before/after (only `channel_id` in metadata).

## Messaging / Framing Accuracy (06/29/2026 — Sean corrected me twice in one session)
- **Stoke is NOT "member-owned."** Sean owns the platform (Body Doubling LLC, platform `owner` role, Stripe billing). Communities have owners (`owner_id`) and are member-*driven* (members supply the value/Q&A), but nobody owns it collectively. Accurate strength framing = **independent** (not Discord, not VC/IPO-pressured, not ad/engagement-monetized) + **purpose-built** + **privacy-respecting** (no government-ID age-verification flow).
- **Stoke is NOT neurodivergent-specific.** It's a GENERAL platform for *any* reciprocal community ("LinkedIn meets Meetup"). Body Doubling is just its flagship/premiere community, not its theme.
- **Body Doubling leans neurodivergent but is NOT neurodivergent-exclusive.** The technique is *primarily* used by ADHD/neurodivergent folks but helps anyone; the community is open to all. Sean's locked launch wording *"tools and tips that work for our minds"* speaks to the lean WITHOUT claiming exclusivity — keep copy that way.
- **The Discord launch announcement draft is NOT persisted verbatim anywhere** (session logs/daily notes/diary only DESCRIBE its framing). Sean holds the working copy and is still iterating it. Don't reconstruct-as-retrieval — ask Sean for the current text.

## Known Bugs / Open Items
- ~~Run BOTH reviews migrations~~ ✅ VERIFIED RUN 07/04: both `20260623000000_reviews.sql` (base `reviews` table) and `20260623120000_review_replies_ordering.sql` (reply + `featured_position` cols) confirmed present via a read-only service-role check (`reviews` selectable incl. `reply_body`/`featured_position`; 0 rows). Reviews feature + management are LIVE.
- ~~QotW question-page delete orphans the qotw_item / 404~~ ✅ FIXED 07/04: (1) `deleteQuestion` in `knowledge.ts` now also deletes the linked `qotw_items` row (was FK ON DELETE SET NULL → orphan with dead `/qotw/N` link) + revalidates `/qotw`; (2) on `questions/[questionId]/page.tsx`, a published QotW question (detected via `qotw_items.question_id`) shows a `⭐ QotW-N` badge and swaps the generic Delete button for a **"Manage in QotW →"** link to the manager — one canonical delete path, no confusing dual-confirm. tsc clean.
- **Repo hygiene (07/04):** added `*.stackdump` + `.claude/settings.local.json` to `.gitignore` (Windows/cygwin crash dumps kept reappearing); deleted the three stray stackdumps.
- ~~Run the QOTW migration~~ ✅ DONE 07/03: Sean ran `20260703000000_qotw_items.sql` (Supabase "success"; verified `qotw_items` queryable via service role, 0 rows). Commit `c87c531` (+ docs `0d5eabe`) PUSHED — both Railway services SUCCESS at `c87c531`. QOTW back-end is LIVE. Bank seeded with the 24 PDF questions as private drafts via `scripts/seed-bodydoubling-qotw-bank.mjs` (idempotent, `--remove` clears only unpublished). Nothing published yet.

## Role Hierarchy Clarifications (06/14/2026)
- **"Platform staff" is a narrow term:** `isPlatformStaff = ['owner','platform_moderator']` only. `community_manager` + `support` are platform TEAM but get NO in-community mod authority — a community organizer outranks them inside a community.
- **Most powerful non-owner = `platform_moderator`:** treated as `'owner'` by `getCallerRole` in EVERY community (can even appoint organizers), plus platform-wide bans. Still below owner: only owner assigns platform roles + bans platform-team members.
- **Community owner vs platform owner:** "community owner" = `communities.owner_id` (per-community, many people, scoped to that one community, their plan gates its limits). "Owner" = `platform_roles.role='owner'` (Sean, one person, authority across all communities + platform admin). Inside a community `getCallerRole` returns `'owner'` for BOTH — identical authorization, different reach. Sean is both for Body Doubling + dorky-platypus-lovers + dracula-fans.

## Context Budget / CLAUDE.md hygiene
> Full narrative of the 07/26 measurement + first archive pass is in `docs/claude-md-archive/2026-07-26-narrative-archive.md`; the 07/28 pass is in `2026-07-28-narrative-archive.md`.
- **⚠️ THE RULE — what belongs here vs the archive:** KEEP every schema, migration name, ID, file path, decision, and ⚠️ gotcha. ARCHIVE the day-by-day narrative — how a bug was found, what was tried, what turned out wrong. Once a thing is fixed, *the fix* is durable and *the hunt* is history. **A section that reads like a story instead of a reference is the signal.**
- **Stale status lines are worse than bloat** — they cost tokens AND actively mislead. Sweep for "NOT yet committed"/"pending" headers on work that shipped.
- **Two structural fixes already made (07/26):** (1) `C:/Users/Sean/.claude/scripts/session_start.py` was injecting the **global** CLAUDE.md that Claude Code already loads natively — it was in context twice, verbatim; removed (comment left so it isn't re-added), hook output 45.5 KB → 7.9 KB, session logs still injected. (2) First archive pass, 153,202 → 79,184 bytes.
- **✅ ARCHIVE THRESHOLD BUILT 07/28** as **step 6 of the global `/s`** (`C:/Users/Sean/.claude/commands/s.md`): measures the project CLAUDE.md in **BYTES**, bands it 🟢 <55 KB (silent) / 🟡 55–80 KB (one-line mention) / 🔴 80 KB+ (**offers** a pass — never acts unasked), and carries the keep-vs-archive rule + method inline so it works in any project.
- **⚠️ BYTES, NOT LINES — `/pulse` and `/preserve` measure the wrong thing for this file.** Both threshold at **280 lines**, but a reference-style CLAUDE.md averages ~205 bytes/line, so 437 lines here = 89.8 KB ≈ 22k tokens while the 227-line global file = 39 KB ≈ 9.5k. `/pulse` also only reads the **global** file, so it reports 🟢 while the project file — the bigger cost — is invisible. Don't reconcile the two numbers; they measure different things.
- **THE REAL LEVER IS GROWTH RATE.** Every `/s` appends and nothing compacts. Measured: 79,184 bytes (07/26 pass) → 89,795 two days later, **+10.6 KB in 48 hours**.
- **Method (avoids reading the whole file into context to edit it):** back up to the session scratchpad → a PowerShell pass extracts target line ranges **verbatim** into `docs/claude-md-archive/YYYY-MM-DD-narrative-archive.md` and leaves `<!--SLOT-NAME-->` markers → `Edit` each marker with freshly-written condensed prose + a `>` pointer. Nothing is ever deleted, only moved.
- **✅ SPLIT-BY-TOPIC DONE 07/28 (the pass that actually worked): 85,172 → 41,566 bytes, −51%, 49 sections → 30 + a pointer index.** 20 feature sections moved VERBATIM into six `docs/reference/*.md` files (see the "Feature Reference" section above). **This is a different tool from archiving and it is now the primary one:** archiving condenses *story* and was exhausted at 27% compression by the second pass; splitting relocates *reference* — the content stays 100% intact and current, it just stops being injected into every session.
- **⚠️ WHERE NEW DETAIL GOES NOW:** per-feature detail belongs in the matching `docs/reference/` file, **not** appended back here — otherwise this file re-inflates and the split has to be redone. What still belongs HERE: cross-cutting patterns (Supabase/Railway/Next.js), governance + roles, the audit-log dual-surface rule, Git/changelog standing rules, actively-worked features, and traps that fire when you *aren't* thinking about that feature.
- **⚠️ A pointer must be an INDEX, not a filename** — list what's inside and name the biggest gotchas inline, or a future session never knows the file is worth opening. That's the whole safety mechanism of the split.
- **Method gotcha (cost a silent no-op):** in PowerShell, `@(@(403,459))` **unrolls to a flat `@(403,459)`**, so a single-range group iterates an int and `$r[1]` is `$null` — the loop body never runs and the section is silently left in place. Multi-range groups are unaffected, which is why 5 of 6 groups worked and only the biggest one didn't. **Verify by byte count per output file, not by exit code.**
- **Verification that proves a move was lossless:** compare the backup line-by-line against (new CLAUDE.md + all new docs files) — every non-blank original line must appear **exactly once**. Cheap, and it catches both loss and accidental duplication. (07/28 result: 415 lines, 0 missing, 0 lost sections; the only 2 "duplicates" were bare ``` fences.)

## Git
- No Co-Authored-By lines in commits
- Use PowerShell with semicolons not `&&`
- **Always push to GitHub after every commit** — no need to ask. This stands until Sean explicitly says the project has gone live.
- **⚠️ CHANGELOG — STANDING RULE (every session must follow; this is the mechanism that keeps `/changelog` current):** whenever a commit ships a **user-facing** change (something a *member* would notice — a new feature, a visible behavior/UI change, a new page), **add a plain-language entry to `apps/web/lib/changelog.ts` in the SAME commit.** `lib/changelog.ts` is the single source of truth for the public `stoke.community/changelog` ("What's new") page AND for Sean's Discord/announcement copy.
  - **Curate — do NOT log everything.** Skip internal-only work: bug/cron fixes, refactors, `tsc`/build tweaks, docs/CLAUDE.md edits, repo hygiene, migrations with no visible effect. (Example: the 07/07 session shipped a cron fix + doc commits that produced ZERO entries, and features that produced 3.)
  - **Format:** newest entry first; `{ date: 'YYYY-MM-DD', title: 'short headline', items: ['You can now…', …] }`. Bullets short + benefit-led. Group a day's shippable changes under one dated entry (add items to today's entry if one already exists).
  - **Proactively offer** a matching changelog entry when Sean ships a user-facing feature even if he doesn't ask — the whole point (his words) is *"track system changes so I can put out announcements."* Then he lifts announcement copy straight from the entry.
  - This rule exists because a stated in-session intention does NOT persist across sessions — only CLAUDE.md (auto-injected each session by the SessionStart hook) does. If this rule is here, future sessions will actually act on it.

