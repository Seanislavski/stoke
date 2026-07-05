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
- **Global gear** (AppNav): avatar + gear icon → dropdown; items gated on `platformRole` prop passed from layout; platform team items only shown when role exists
- **Community gear** (`CommunityGear.tsx`): shown to organizers/mods/owner on community page header; shows pending count badge if join_mode=request. Gear itself renders ONLY the icon (no text). Gated on `isMod` (`isPlatformStaff || isOwner || ['organizer','moderator'].includes(role)`).
- **Community header "Organizer" label** (07/01/2026): the uppercase "Organizer" text next to the gear is rendered by `JoinButton.tsx`, gated on **`isOwner` = `user.id === community.owner_id`** — so ONLY the community owner sees it (NOT all organizers). In that same header slot: active member → "Leave" button; pending → "Request pending"; non-member → "Join"/"Request to join"; logged-out → never (they get `/preview/[slug]`). So no regular member/visitor ever sees "Organizer" — but note the label is *narrower* than "organizers": a co-organizer/moderator sees "Leave" there, not their role. (Left as-is; offered a role-aware label, Sean hasn't decided.)
- **Community header mobile fix (07/01/2026):** header row `communities/[slug]/page.tsx` changed `flex items-start justify-between` → `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4` so it **stacks on mobile** (title/meta on top, action row [Organizer label / Join + gear] below, full width) and stays side-by-side at `sm`+ (desktop unchanged). Fixed "Organizer" being cramped on mobile. Also added `whitespace-nowrap` to the Organizer span in `JoinButton.tsx`. tsc clean. Committed `16737b3` and PUSHED — live in prod.

## Organizer Guide (06/13/2026)
- **Two deliverables, one content:** portable markdown doc `docs/running-a-community.md` (paste into email/Discord/hand off) + in-app page `apps/web/app/guide/page.tsx`. Layered: quick-start ("first 15 minutes") + full feature reference + closing philosophy.
- **Staff-only access** (not public — Sean: "I do not want a public guide link, but I want the guide to be available to moderators/organizers/owners"):
  - `/guide` REMOVED from middleware public-route bypass → unauth redirects to `/login`, platform-ban check applies
  - Page (`guide/page.tsx`) has a **server-side guard**: `if (!user) redirect('/login')`; computes `isStaff = (community_members count, role in [organizer,moderator] active, via admin client) > 0 || !!platform_roles` ; `if (!isStaff) redirect('/home')` — real protection, not just hidden link
  - `(app)/layout.tsx` computes `isCommunityStaff` the same way and passes it to `AppNav`; gear-menu "Organizer guide" link only renders when `isCommunityStaff`
  - `MarketingFooter.tsx` has NO guide link (public surface); links = About / Privacy / Terms
  - OnboardingChecklist keeps its guide link ("New to running a community? Read the organizer guide →") — only mods/orgs see the checklist anyway
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
- `events` table: community_id, title, description, starts_at, ends_at, location_type (online/in_person/hybrid), location_url, location_address, created_by
- `event_rsvps` table: event_id, user_id, status (going/maybe/not_going) — UNIQUE on (event_id, user_id)
- Events tab on community page; past events in `<details>` toggle
- RSVPs: Going/Maybe/Can't go buttons; clicking active status clears (upsert with null)

## Resources (LEGACY — replaced by Q&A 06/11/2026)
- `resources` table still exists; `resources.ts` actions + `SubmitResourceForm`/`ResourceModActions` components left in place but ORPHANED (no longer rendered). Resources tab was replaced by the Q&A Knowledge Base.
- `resources` table: community_id, submitted_by, title, url, description, status (pending/published/rejected)

## Q&A Knowledge Base (replaces Resources tab — 06/11/2026)
- **Concept:** community Q&A as durable, searchable "external memory" — members ask questions + contribute answers; BOTH queue for mod approval; only approved content is viewable. Replaces the old flat link/photo Resources tab. Piloted with Body Doubling (premiere/flagship community before official Stoke launch). Origin: Fable 5 phone convo (saved in Obsidian `+ Encounters/Fable 5 and Sean.md`) — "the knowledge exists; the retrieval fails."
- **Tables** (migration `20260611000000_knowledge_base.sql`):
  - `kb_categories`: community_id, name, description, position, created_by — organizer-defined; assigned to a question at approval time
  - `kb_questions`: community_id, category_id (FK→kb_categories on delete set null), asker_id, title, body, status (published/pending/rejected), approved_by, published_at
  - `kb_answers`: question_id, community_id (denormalized), author_id, body, url, status, is_accepted bool, approved_by, published_at
- **PostgREST FK hint REQUIRED:** kb_questions has asker_id + approved_by both → profiles, kb_answers has author_id + approved_by both → profiles ⇒ ambiguous joins → always use `profiles!asker_id(...)` / `profiles!author_id(...)`
- **RLS:** select published-only + insert-own; all pending reads + mod writes go through `createAdminClient()` (same pattern as bulletin/resources). No `is_community_mod` helper used.
- **Decisions locked:** ranking = accepted-answer marking ONLY, NO upvotes/karma (Fable warning: gamifying "attract[s] transactional behavior + repel[s] genuine helpers"); tab name = "Q&A" (reserving "Ask" for the future real-time requests flow); both Q + A need approval (high question volume expected, many rejected); accepted answer = asker OR mod, one per question (`toggleAcceptAnswer` clears all then sets)
- **Files:** `app/actions/knowledge.ts` (all actions + `modEmails()`/`emailFor()` helpers); `components/knowledge/` (KnowledgeBoard=client instant search+category-chip filter; AskQuestionForm, AnswerForm, QuestionModActions=approve+file-category in one step, AnswerModActions, AcceptAnswerButton, CategoryManager); detail route at `questions/[questionId]/page.tsx`
- **Recategorize-after-approval (07/02/2026):** Sean approved a question but "forgot to choose a category first" — category was previously ONLY settable at approval time (via `QuestionModActions`), no way back in once published. Added: `setQuestionCategory(questionId, communityId, slug, categoryId)` action in `knowledge.ts` (mod-only, same auth as `approveQuestion`, audited + revalidates both `/communities/{slug}` and the question path); `components/knowledge/QuestionCategoryPicker.tsx` (client, auto-saves on `<select>` change — "Saving…"/"Saved", reverts on error, renders null if 0 categories); wired into `questions/[questionId]/page.tsx` for `isMod && status==='published'` (pending questions still use QuestionModActions). Audit label `question.recategorized` → "Changed a question's category" added to `lib/audit.ts` ACTION_LABELS. `npx tsc --noEmit` clean. **Committed `37438f1` on main (bundled with the YouTube-embed work below) and PUSHED — live in prod** (verified 07/03: `main == origin/main`, nothing ahead).
- **UX:** Q&A tab = mod pending-questions review section + KnowledgeBoard (search/filter) + AskQuestionForm; pending answers reviewed inline on the question detail page (contextual). Client-side instant search for v1 (no tsvector); answer authors credited with profile links ("close the loop visibly").
- **Email templates** (`lib/email.ts`): kbQuestionSubmitted/Approved, kbAnswerSubmitted/Approved. **Audit actions** (`lib/audit.ts`): question.created/submitted/approved/rejected/deleted, answer.created/submitted/approved/rejected/deleted/accepted.
- **Question of the Week (07/03/2026 — commit `34583e9`, local-not-pushed):** Sean starts posting a weekly question on Stoke Mondays + pointing Discord to it (the "shrink the per-touchpoint ask" funnel lever). Sean: *"I think it can have its own area on Stoke (not necessarily its own page, but maybe within the Q&A section?)"* → built INSIDE Q&A, no separate page. **Chosen landing = public per-question view** (out of 3 options I offered; opt2=block-on-preview, opt3=members-only-ruled-out).
  - **NO migration** — QOTW is derived from a Q&A **category named exactly `Question of the Week`** (`lib/qotw.ts` `findQotwCategoryId()`, case-insensitive, scoped per community). Current spotlight = newest published question in that category (boardQuestions already ordered `published_at desc` → first match). Past weeks accumulate there as an answerable archive. Mod-controlled (askers don't set category; only mods/owner do at ask/approve time) so members can't populate it by accident.
  - **Spotlight card** pinned atop the Q&A tab (`communities/[slug]/page.tsx`, orange gradient, "⭐ Question of the Week · N answers · Add yours →"); renders only when `qotwSpotlight` exists.
  - **Public read-only view** `app/preview/[slug]/questions/[questionId]/page.tsx` — logged-out visitors see the question + published answers + a "Sign up to answer" CTA (`/signup?redirect={canonical}` → lands them on the real answerable page post-auth). `middleware.ts` **rewrites** logged-out `/communities/{slug}/questions/{id}` → `/preview/{slug}/questions/{id}` so the shared URL stays canonical (mirrors the bare-slug preview rewrite; logged-in users fall through to the real gated page). **Privacy guard:** the public page redirects to `/communities/{slug}` unless the question is published AND in the QOTW category — so ONLY the QOTW is exposed, rest of the (unlisted) Q&A stays private (mirrors featured-reviews "explicit publish-publicly" principle).
  - LinkPreview logged-out safety: YouTube→iframe + image→img need NO API; generic-link OGCard fetches the auth-gated `/api/link-preview` and **degrades to null** (renders nothing) logged-out → safe to reuse `RichContent` on the public page.
  - **Setup switch (one-time):** the `Question of the Week` category must EXIST in a community for any of this to activate (spotlight hidden + public route redirects until then). The category was CREATED 07/03 via `scripts/add-qotw-category.mjs` (id `996c2934-afe4-4223-b7b0-0eefb07fa222`) + the morning feature PUSHED live (commit `93be1e1`, both Railway services SUCCESS). Monday flow (morning-feature version): Ask a question → pick the QOTW category (owner auto-publishes) → instant spotlight + live public link.
- **Question of the Week BACK-END (07/03/2026 — commit `c87c531`, local-not-pushed, SUPERSEDES the morning ad-hoc flow):** Sean wanted a management page to *"store questions in there if I think of one well in advance, and then... select one and with a click of a button assign the question to be QotW"* + *"assign ones for future weeks... pre-loaded for (potentially) months!"* Then REVISED the share model: he wants *numbered permanent links* (`example.link/QotW-1`) so questions are *"look[ed] up in the future"* and — critically — *"there is no time that someone MUST answer by. I don't like that, and I think most Neurodivergents would agree with me. This also means that if someone is bored, they can answer previous QotW's."* So: NO deadlines, every QotW stays open forever, whole back-catalog answerable.
  - **New table `qotw_items`** (migration `20260703000000_qotw_items.sql`): community_id, title, body, `number` int (QotW-N, null while draft, assigned on publish, unique per community), `planned_for` date (organizational LABEL only — does NOT auto-publish), `question_id` (fk kb_questions, set on publish), position, created_by, published_at. RLS-on-no-policy (all access via service-role admin client). **⚠️ migration NOT yet run — feature inert until it is** (code is fail-safe: `qotw_items` reads use `.then(r=>r.data??[])` so a missing table → empty bank, nothing crashes; spotlight is unchanged since it reads kb_questions).
  - **Model:** Bank (drafts, number=null) → **one-click Publish** (`publishItem`: assigns next number = max+1, creates the answerable kb_question in the QOTW category authored by owner/auto-published, links question_id). Deliberately **manual publish, NO cron/auto-rotation** — Sean's no-deadline philosophy made auto-release optional; "pre-loaded for months" = stockpile the bank + click weekly. (Offered auto-weekly-release as a small follow-on if he wants zero clicks.)
  - **Files:** `app/actions/qotw.ts` (addDraft/updateDraft/deleteItem/publishItem, `requireMod` gate mirrors knowledge.ts); `components/qotw/QotwManager.tsx` (client: add-to-bank form, bank list w/ edit/delete/publish + planned-week label, published list w/ QotW-N + copy-link/delete; imports server actions directly — not via `.bind` props); management page `app/(app)/communities/[slug]/qotw/page.tsx` (mod-gated); numbered redirector `app/(app)/communities/[slug]/qotw/[n]/page.tsx` (logged-in → real question); public numbered view `app/preview/[slug]/qotw/[n]/page.tsx` (logged-out, "QotW-N" label + Sign-up-to-answer, mirrors the morning per-question preview). `middleware.ts` rewrites logged-out `/communities/{slug}/qotw/{n}` → `/preview/{slug}/qotw/{n}` (bare `/qotw` = management, stays mod-gated). Settings page has a "Question of the Week → Manage" link section (after Q&A categories). Audit labels `qotw.published`/`qotw.deleted`. tsc + `next build` clean (3 new routes registered).
  - **"Preview as test" publish (07/03, commit `d558049`, PUSHED live d558049 both services SUCCESS):** Sean wanted to test the full flow *"without using the QotW-1 (maybe use QotW-t instead?)"*. Added a throwaway test publish using **sentinel number `0`** → renders as **"QotW-t"** at `/qotw/0` via shared `qotwLabel(n)` helper (`lib/qotw.ts`: `n===0 ? 'QotW-t' : 'QotW-'+n`, `QOTW_TEST_NUMBER=0`). `publishItem` got a 4th arg `asTest=false`; real publishes now use `max(number > 0)+1` so the test-0 NEVER inflates real numbering (Monday's first real = QotW-1 whether or not the test is deleted). QotwManager has a secondary "Preview as test" button next to "Publish as QotW". Delete the QotW-t row when done → spotlight clears. Caveat told to Sean: while QotW-t is live it IS a real published kb_question so members see it as the current spotlight (fine for a quick pre-Monday test).
  - **Test-copy FIX (07/03, commit `4f16bfa`, pushed):** first version of `asTest` UPDATED the draft in place → the bank row *became* QotW-t, so deleting the test would delete the question. Sean hit this ("I'm afraid that I will delete it?") — reverted his first test via a one-off script (number/question_id→null + delete the throwaway kb_question). Fixed: `asTest` now INSERTS a separate throwaway COPY, original draft stays in the bank; deleting QotW-t only removes the copy. Verified live: 24 bank drafts intact after a second test. **TWO delete paths that confuse (Sean asked why the warning differed):** (1) the **manager** QotW-t row Delete = clean + friendly confirm ("Remove this QotW-t test? Your original question stays safe in the bank"); (2) the **question detail page** generic mod delete ("Delete this question and its answers?", `DeleteItemButton`→`deleteQuestion` in `questions/[questionId]/page.tsx`) = deletes the test's kb_question but orphans the qotw_item (question_id→null via FK ON DELETE SET NULL). Guide users to the MANAGER delete. Possible follow-up: suppress/redirect the generic delete for QotW-numbered questions, or have it clean the qotw_item too.
  - **Self-serve for ANY community (07/03, commit `2a3c346`, PUSHED live):** Sean asked *"how is QotW a useable system (if desired) for other communities?"* — answer: the app was already fully multi-tenant (qotw_items scoped by community_id, pages by slug, numbering per community, "Manage" link on every community's settings). The one friction was the manual exact-name category requirement. FIXED: `ensureQotwCategory(admin, communityId, userId)` in `qotw.ts` find-or-creates the "Question of the Week" category on first publish → organizers never need the magic name; removed the "create a category first" warning + button gating from QotwManager (dropped the `hasCategory` prop + the `cats` fetch from the manage page). Also DOCUMENTED QotW in the Organizer Guide — new "Question of the Week" section in BOTH `apps/web/app/guide/page.tsx` (+ TOC entry `#qotw`) and `docs/running-a-community.md` (private bank, one-click publish, numbered links, no deadlines, Preview as test). Only BD-specific bits left are the two seed scripts (hardcode slug `bodydoublingcom`).
  - **Model-choice aside:** Sean asked *"is this something that I should switch to Fable 5 for?"* → I said no for the BUILD (coding/agentic = Opus 4.8's strength), yes for the CONTENT/strategy layer (writing the actual weekly questions = where he already uses Fable 5). Principle: Opus for the plumbing, Fable for the words. Kept Opus 4.8.
- **Per-question public toggle (07/05/2026 — built, NOT yet committed/pushed):** Sean posted an unanswered member question to Discord, then noticed that opening it logged-out showed the private-community screen (Image #1) instead of the question. Root cause = deliberate design: the public preview page (`preview/[slug]/questions/[questionId]/page.tsx`) `loadPublicQuestion` guard exposed ONLY published questions in the QotW category; everything else redirected to `/communities/{slug}` (→ unlisted-community private screen). Sean: *"I want the question itself to be visible even to those who are not yet logged in — can we somehow make that the default?"* Offered 3 scopes (any published Q / listed-communities-only / per-question toggle); **Sean chose "Just add a per-question toggle"** — private by default, mod flips individual questions public. Built:
  - **Migration `supabase/migrations/20260705000000_kb_question_public.sql`** — `alter table public.kb_questions add column if not exists is_public boolean not null default false;`. **⚠️ MUST RUN BEFORE PUSHING** — new code selects `is_public`; if the column is missing, PostgREST errors → `question` null → the logged-in question detail page 404s for everyone. Column-add is backward-compatible (deployed code doesn't reference it) so run it early, then push.
  - `setQuestionPublic(questionId, communityId, slug, isPublic)` in `knowledge.ts` — mirrors `setQuestionCategory` auth (`requireModAccess`), audited `question.made_public`/`question.made_private` (labels added to `lib/audit.ts`), revalidates `/communities/{slug}` + the question path.
  - Public guard now exposes a question if published AND (`category_id === qotwCategoryId` OR `is_public`). `loadPublicQuestion` returns an `isQotw` flag; the "⭐ Question of the Week" eyebrow renders only when actually QotW, else "{community.name} · Q&A"; metadata desc generalizes off the QotW "this week" copy. QotW no longer requires a category to exist for the page to work (dropped the early `if (!qotwCategoryId) return` bail).
  - `components/knowledge/QuestionPublicToggle.tsx` (client, checkbox auto-saves + reverts on error, shows the canonical share URL + Copy-link when on). Wired into `questions/[questionId]/page.tsx` for `status==='published' && isMod && !isQotw` (QotW questions are already public via their numbered link, so no toggle there). Detail-page question query gained `is_public`.
  - No middleware change (existing question-URL rewrite already sends all logged-out question hits to the preview). tsc clean. Migration RUN by Sean 07/05 (Supabase success). Committed+pushed `97e4ac6`.
  - **Answers gated behind sign-up (07/05, follow-up):** Sean: *"the question should (with the toggle on) be visible to all, but the answers should only be visible by logged-in users. I think this will encourage people to sign up."* On the public preview page, a public question shows the question + an answer-COUNT teaser ("🔒 N answers have been shared. Sign in to read them" + Sign-up button) instead of the answer bodies. Then Sean: *"The QotW answers also should be gated"* → gating is now UNIVERSAL on the public page (QotW included) — removed the `isQotw` branch in the answers block. The `loadPublicQuestion` answers query was trimmed to `.select('id')` (count only) so answer bodies are never even pulled into memory, let alone the HTML. Commits `b46c631` (initial non-QotW gate) then `a02f6d3` (universal gate, count-only query). All PUSHED — Railway redeploying. Toggle copy later trimmed: dropped "and its answers" (wrong — answers are gated) `31153d7`, then dropped the Discord mention `b142e58` (Sean: not applicable to most communities).
  - **Asker public-sharing preference + against-preference confirm (07/05, built, PUSH HELD pending migration):** Sean wants the ASKER to signal consent at post time without granting them control: *"when someone is posting the question, they should be able to select a box indicating that they are okay with sharing it publically - and it should be selected by default... If it has been selected or not simply indicates to moderators what the choice is, and if they choose to go 'against' the asker's preference, they have to click on a new pop up which says something like 'Are you sure? This goes against what was indicated at the time of initial posting.'"* So the asker still CANNOT publish (mod-only `setQuestionPublic` unchanged) — the checkbox is purely an advisory signal.
    - **Migration `supabase/migrations/20260705010000_kb_question_asker_pref.sql`** — `add column if not exists asker_public_pref boolean;` (nullable; NULL = legacy/no-pref). **⚠️ MUST RUN BEFORE PUSHING** (code selects + inserts it → missing column breaks question submit + the detail page). NOT yet run.
    - `AskQuestionForm.tsx`: checkbox `public_ok`, **defaultChecked**, shown to all askers ("I'm okay with this question being shared publicly. Organizers decide whether to actually publish it; this just records your preference. (Answers always stay members-only.)"). `submitQuestion` stores `asker_public_pref: formData.get('public_ok') === 'on'`.
    - Detail page passes `askerPref={question.asker_public_pref ?? null}` to `QuestionPublicToggle`. Toggle shows the recorded preference (✔ okay / ⚠ prefers private) and, on any toggle change where `askerPref !== null && next !== askerPref`, fires `window.confirm('Are you sure? This goes against what the asker indicated at the time of initial posting.')`. Initially SYMMETRIC; Sean then chose ONE-WAY — the confirm now fires ONLY on the privacy-sensitive direction (`next && askerPref === false`, i.e. making public when the asker preferred private); turning a question back private is never blocked. tsc clean. Migration run 07/05; `39bb9d1` pushed, one-way tweak follows.
- **DEFERRED sibling feature:** real-time "Ask / I can help" requests flow (ephemeral: "partner at 2pm" → tap "I can help" → fulfilled). Designed KB as a clean sibling; NOT built. Scope decision was "Both, knowledge base first."
- **Body Doubling community:** slug `bodydoublingcom`, id `5310e8c7-1276-485f-b77e-406d7edcf890`, owner_id `4e216ab6...` (Sean's account; also owns dorky-platypus-lovers + dracula-fans). Currently unlisted.
- **Seed script:** `scripts/seed-bodydoubling-qa.mjs` — 6 categories + 6 starter questions (the recurring Discord ones), authored by owner so auto-published. Idempotent; `--remove` to undo. Already run successfully.
- **Live Q&A state (inspected 07/02/2026, read-only via a temp `scripts/` script using service-role key + kb_categories/kb_questions/kb_answers):** 6 categories; 7 questions (6 published seed + **1 pending, member-asked** "Cleaning and organizing habits/systems that stick?"); 7 answers, **ALL authored by members not owner** (real unprompted activity — encouraging) — 6 published + **1 pending** (an answer on "Morning routine ideas"). Per-question answer counts: "Best apps/extensions for blocking distractions?" = 3; "Morning routine ideas" = 2 (1 pub/1 pending); "How do I start…" = 1; "How do I run a good body doubling session?" = 1; **"What timer setup actually works for ADHD?" = 0** and **"What do you do when you lose focus mid-session?" = 0** (empty); **no accepted answers marked anywhere**. **This REVISES the conversion/funnel fix ("#1 seed the room"): the room is NOT empty — members are contributing.** Refined 3 gaps, priority order: (1) ⚡ approve the 2 items stuck in the mod queue (1 question + 1 answer) — instant fill + rewards contributors, pure upside, but publishes member content so Sean reviews text first; (2) fill the 2 zero-answer questions with real Discord advice (Claude can't invent it); (3) mark accepted/best answers for a "resolved library" signal. LESSON: don't assume the room is empty — inspect live data first; my initial "seed the empty room" framing was wrong.

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
- **Message reactions (07/05/2026 — built, PUSH HELD pending migration):** Sean got his first Stoke @mention (someone "@Sean"'d him in a new Introductions channel in Body Doubling) and noticed Stoke chat had no emoji like Plish. Root cause: Stoke ≠ Plish (separate codebase); `ChannelView` chat was built lean (image attach + @mention + Send only). Sean chose **reactions** over a plain emoji-insert picker.
  - **Migration `supabase/migrations/20260705020000_message_reactions.sql`** — `message_reactions` (id, message_id FK messages ON DELETE CASCADE, **channel_id denormalized** FK channels, user_id FK profiles, emoji text, `unique(message_id,user_id,emoji)`); RLS mirrors messages (select/insert on active membership of the channel's community, delete-own); **`replica identity full`** so realtime DELETE payloads carry channel_id/message_id/emoji (default ships only PK → would break the filter + not tell us which reaction to drop); added to `supabase_realtime`. **⚠️ MUST RUN before push** (inert-but-safe until then: page admin read `?? []`s a missing table). NOT yet run.
  - channel_id is denormalized because a `postgres_changes` filter only keys off a column on the SAME table (can't reach message_id→messages.channel_id). Client subscribes `reactions:{channelId}` filtered `channel_id=eq.{channelId}` for INSERT + DELETE.
  - **`ChannelView.tsx`:** new `initialReactions` prop (page loads reactions for the 50 messages via admin `.in('message_id', ids)`); `reactionPills(id)` groups → ordered `{emoji,count,mine}`; `toggleReaction` insert/delete via the supabase CLIENT under RLS (like message-send) w/ optimistic + rollback; realtime dedup by (message_id,user_id,emoji). UI: pill row under each non-deleted/non-optimistic message (mine=orange, click toggles) + hover-reveal (`md:opacity-0 md:group-hover:opacity-100`, always visible mobile) smiley button → popover of `['👍','❤️','😂','🎉','😮','😢','🙏','🔥']`; fixed z-20 backdrop closes picker (popover z-30). tsc clean.

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
- **Privacy boundary:** only `is_listed` communities expose a bulletin teaser; unlisted ones (Body Doubling) show header + "private community" note → slug doesn't leak content.
- Preview CTAs carry `?redirect=/communities/{slug}` (login + signup both honor redirect) so users land inside after auth.
- **LESSON: never hardcode '— Stoke Community' in page titles** — root `app/layout.tsx` metadata has `title.template: '%s — Stoke Community'` which auto-appends it (a hardcoded suffix double-appends).

## Member-facing Landing (06/22/2026 — Friction #4 from 06/18 launch audit)
- `app/page.tsx` now speaks to joiners, not just organizers: hero "Join a community" CTA + invite hint, a "Two ways in" section (Organizer / Joiner cards), joiner line on bottom CTA. **All joiner CTAs route to `/signup`, NOT the `/communities` directory** (directory is auth-gated → would hit a login wall).

## Reviews / Testimonials (06/23/2026 — commit 4b83f22)
- **What:** members leave reviews (optional 1–5 stars + text); mods approve them, then **feature** a curated few that surface publicly as testimonials. Sean: "members can leave their reviews/feedback, and admins can choose a few to be displayed to attract users." Purely public testimonials (private feedback stays in tickets).
- **One `reviews` table, scope by nullable `community_id`:** NULL = a platform-level review of Stoke; non-null = a community review. (Mirrors `tickets.community_id` nullable.) Columns: id, community_id, author_id, rating (int nullable, 1–5), body, status (pending/published/rejected), is_featured bool, approved_by, published_at, created_at, updated_at. Migration `supabase/migrations/20260623000000_reviews.sql`. **⚠️ migration must be run manually in Supabase — not yet run as of 06/23.**
- **Two-tier:** `status` pending → published (visible in-app on the Reviews tab to members) → `is_featured` (the curated subset shown PUBLICLY). Mirrors the Q&A (`knowledge.ts`) approve pattern; pending reads + all writes via `createAdminClient()`.
- **Edit → re-approval (Sean's requirement):** `editReview` forces `status='pending', is_featured=false, approved_by=null, published_at=null` in the same update → an edited review instantly drops from ALL public + in-app published display until a mod re-approves. Re-notifies mods. "Once edited, reviews are auto-removed from public display until they are re-approved."
- **Eligibility:** community review = active member (mod/owner auto-publishes); platform review = any logged-in user (platform mod auto-publishes). Platform-scope "mod" = owner/platform_moderator only.
- **One review per author per scope** — enforced with TWO partial unique indexes (`where community_id is not null` and `where community_id is null`) because NULLs are distinct in a plain unique constraint.
- **PostgREST:** `reviews` has author_id + approved_by both → profiles ⇒ all joins use `profiles!author_id(...)`.
- **Surfaces:** Reviews tab on `communities/[slug]` (members + mod approve/feature inline); featured reviews on `preview/[slug]` ("What members say", shown regardless of is_listed — featuring is an explicit publish-publicly act); platform testimonials on `app/page.tsx` landing ("What organizers are saying", **renders nothing when zero featured** → stays hidden until real ones exist post-launch); member platform-review entry at `/feedback` (gear menu "Share your experience"); platform curation at `/admin/reviews` (canModerate).
- **Files:** `app/actions/reviews.ts`, `components/reviews/{ReviewForm,ReviewList,ReviewsManager}.tsx`, `lib/reviews.ts` (shared `REVIEW_COLS` + `mapReview`), `app/(app)/feedback/page.tsx`, `app/(app)/admin/reviews/page.tsx`. Audit actions `review.*` in `lib/audit.ts`; email templates `reviewSubmittedHtml` (mods) + `reviewFeaturedHtml` (author) in `lib/email.ts`.

### Review management for organizers (06/23/2026 — commit e1262ad, migration `20260623120000_review_replies_ordering.sql`)
- Sean: "I want to help the organizers manage their reviews." Chose **all four** capabilities, in **community settings** ("matches my mental model"). Mod controls REMOVED from the member-facing Reviews tab (now display-only + "manage in settings" hint); the tab stays clean for members.
- **`ReviewsManager.tsx`** (client) is the management surface, used in BOTH community settings AND `/admin/reviews` (platform, communityId=null). Sections: sentiment snapshot (avg rating + 5→1 distribution bars), status filter tabs (pending/published/featured/rejected/all with counts), per-row approve/reject/feature/delete + reply, featured ▲▼ reorder.
- **Featured cap = 6** — `toggleFeatureReview` blocks featuring a 7th ("You can feature up to 6 reviews — unfeature one first"); UI also disables the button at cap. `featured_position` int orders the featured set; `reorderFeatured(communityId, slug, orderedIds)` renumbers. Public surfaces (preview/landing) order by `featured_position asc` then `published_at desc`, limit 6.
- **Organizer replies** — `setReviewReply(reviewId, communityId, slug, formData)` (empty body removes the reply). Columns `reply_body, reply_is_public, reply_by, reply_at`. **Public** reply (`reply_is_public=true`) shows wherever the review shows (member tab + preview + landing); **private** only to the review author + community staff. Visibility helper `canSeeReply(review, viewerIsStaff, viewerUsername)` in ReviewList; member tab passes `viewerIsStaff={isMod}` + `viewerUsername` (derived from members list). One reply per review (business-response style). Editing a review still re-queues it (reply persists, hidden while review pending).
- **Gear badge** now sums pending join requests + pending reviews: `pendingCount={(pendingCount ?? 0) + (pendingReviewsCount ?? 0)}` on `CommunityGear` (no gear component change).
- `ReviewModActions.tsx` was DELETED (superseded by ReviewsManager). `ReviewList.tsx` is now display-only (exports `ReviewItem`, `Stars`, `canSeeReply`, `ReplyBlock`).
- Audit labels added: `review.reordered`, `review.replied`, `review.reply_removed`.

## Seed / Cleanup Scripts (`scripts/`)
- `seed-communities.mjs` / `unseed-communities.mjs` — 15 demo communities + ~45 fake users on `@seed.stoke.community` emails. Seed is idempotent/re-runnable; unseed deletes seed-owned communities (FK cascade) then the fake users (cascade clears profiles + memberships, including seed members of real communities). Run unseed before launch.
- `seed-bodydoubling-qa.mjs` — Body Doubling starter Q&A (KEEP; intentional content).
- `inventory.mjs` (read-only) — lists all communities (SEED vs REAL, owner email, listed, member count) + non-seed users (what they own, review count). Use before any deletion.
- `cleanup-test-communities.mjs` — deletes a hardcoded allow-list of hand-made test community slugs (Dracula Fans, Dorky Platypus Lovers, Mom's Art Group, Stonington Lobsta Party, Intrepid Design Gurus); hard-excludes bodydoubling; dry-run unless `--yes`.
- `cleanup-accounts.mjs` — deletes auth users by email passed as args; PROTECTED list refuses `baldwinseana@gmail.com` (flagship owner); dry-run unless `--yes`.
- All scripts load `apps/web/.env.local` (service role key). The CC auto-mode classifier blocks Claude from running `--yes` destructive deletes directly; Sean runs them himself in-session via the `! <command>` prefix.
- **Real account note:** `baldwinseana@gmail.com` owns the flagship BodyDoubling.com (slug `bodydoublingcom`, unlisted) + was the owner of test communities Dracula Fans + Dorky Platypus Lovers. `sean@bodydoubling.com` is Sean's CC login (owned test community Mom's Art Group). Stoke has NO public people directory (v1), so accounts owning no communities are invisible at launch.

## Static Assets, Hosted Docs & Launch (06/23/2026)
- **Middleware matcher must exclude EVERY hosted static file extension.** `apps/web/middleware.ts` `config.matcher` negative-lookahead originally excluded only `svg|png|jpg|jpeg|gif|webp`, so `.pdf`/`.html` files in `apps/web/public/` hit the auth gate → logged-out visitors got redirected to `/login`. Fixed by adding `pdf|html|ico|txt|xml|webmanifest`. **LESSON:** any new public static file type must be added to that list, and ALWAYS test hosted assets while **LOGGED OUT** (Invoke-WebRequest is effectively logged-out; verify `Content` starts with `%PDF-`, not just HTTP 200 — the login shell returns 200 `text/html` ~13KB with no `type=password` because the form is client-rendered, which is easy to mistake for success).
- **PDF generation from HTML (zero deps):** headless Chrome/Edge print-to-pdf. `chrome.exe --headless=new --do-not-de-elevate --disable-gpu --no-first-run --user-data-dir=<temp> --no-pdf-header-footer --print-to-pdf=<out> file:///<in.html>` via PowerShell `Start-Process -Wait -NoNewWindow`. Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`; Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. `--no-pdf-header-footer` strips the default URL/date header.
- **⚠️ ELEVATED-TERMINAL GOTCHA (07/01/2026) — the `--do-not-de-elevate` flag is REQUIRED.** Sean's project Terminal profiles run **elevated** (`"elevate": true`). Chrome 149+ (and Edge) **auto-de-elevate** when launched as admin: they silently relaunch themselves NON-elevated and the process you started exits 0 **immediately with no PDF written** — no error, nothing (the tell in verbose `--enable-logging=stderr --v=1` output is a `Windows.AutoDeElevateResult` histogram line). This is what silently broke a prior PDF session ("long wait then the terminal closed"). Fix = pass Chrome's own internal `--do-not-de-elevate` flag so it stays put and renders headless as admin. Also wrap the launch in a **kill-timeout** so a hang can't take the terminal down: `$p = Start-Process ... -PassThru -NoNewWindow; $p | Wait-Process -Timeout 60 -EA SilentlyContinue; if(-not $p.HasExited){$p | Stop-Process -Force}`. NOTE: `-NoNewWindow` and `-WindowStyle` are mutually exclusive in `Start-Process` (don't pass both). Render to a UNIQUE temp filename then `Copy-Item` over the target (the public PDF gets locked while open in a viewer). AVOID `Remove-Item` on paths under `C:\Program*` (trips a path-protection guard). Single-page layout: `.page { height:11in; overflow:hidden; display:flex; flex-direction:column }` + `.body { justify-content:space-between }` to distribute whitespace evenly.
- **Join how-to guide:** `apps/web/public/how-to-join-body-doubling.{html,pdf}` → live at `stoke.community/how-to-join-body-doubling.{html,pdf}`. One-page branded guide for the OPEN-join launch flow. Wording (per Sean): NOT "new/better home" — it's "a reliable place to build a shared, lasting library of tools and tips for neurodivergent minds."
- **Launch:** ✅ LAUNCHED 06/29/2026 (Discord announcement went out via the mod team). **Signups are slow: ~5 on day 1 (06/29), ~6 on day 2 (06/30) → ~11 total.** Sean is underwhelmed given the 13k Discord. My framing to him: 11 off a *soft* resource-channel launch is not a product verdict — it's early + low-reach + "join another platform" is a high-friction ask (esp. ADHD audience). Before changing anything, diagnose WHERE the funnel leaks: (1) reach — how many actually SAW the post (soft housekeeping post ≠ 13k impressions); (2) click-through — did the hook land (gauge by post reactions/replies); (3) signup completion — preview→signup on-site. Two bets regardless: there must be something pulling signups BACK (seed real Q&A activity so a visitor sees a live room, not empty), and one post is never "the launch" (needs 3–4 repeat touchpoints). ⏳ Waiting on Sean to say how it actually posted (@everyone vs soft) + the post's reaction/reply count to pick the lever. BodyDoubling.com is the ONLY live community (public, `join_mode=open`). Sean still plans to switch join_mode back to closed after the initial wave — at which point the how-to guide's instant-join steps need updating or the link taken down.
- **⚠️ LAUNCH-POST FACTS CORRECTED 07/01 (Sean shared the actual #announcements screenshots) — the "soft launch / low reach" premise was WRONG.** The announcement was a full **`@everyone` blast in #announcements** (06/29 9:38 AM), re-posted `@everyone` again 06/30, plus a softer 06/30 12:51 PM nudge ("Thanks for those who have joined… check out how asking/answering works… DM me"). It carried Sean's locked copy + both links + rich embeds ("Stoke Community — A place where everyone has something to offer" / "BodyDoubling.com on Stoke"). **Engagement was STRONG: ~42 reactions (🔥18, 😍7, 👍5, ✨4, ❤️3, +others).** So the earlier "mods folded it into a calmer housekeeping post, likely no big ping" note (06/28) did NOT reflect what actually posted. **Re-diagnosis with real data: reach = HIGH ✅, hook/resonance = STRONG ✅ (people loved the idea), signup completion = LOW ❌ (~11).** The leak is **CONVERSION (interest→action), i.e. the intention-action gap** (frictionless 🔥 vs the high-friction "leave Discord, make an account, learn how it works" — steep for ADHD). This is the *encouraging* read: the idea is validated; the fix is friction, not messaging. **Levers, prioritized:** (1) SEED the room — a 🔥-reactor who lands on an empty Q&A bounces; run/verify `seed-bodydoubling-qa.mjs` + add real answers from the Discord thread so first visit shows a LIVING library; (2) shrink the per-touchpoint ask — "answer this one question" beats "explore a platform" → the new **Question of the Week** PDF is exactly this repeat-touchpoint engine now the @everyone card is spent; (3) work the ~18 🔥-reactors as warm leads (targeted follow-up/DM). LESSON: don't record a launch's reach/ping from a *plan* or a mod *intention* — confirm from the actual posted message.
- **Discord launch announcement (drafted 06/28, ready to post):** Sean iterated the copy into his own voice. Locked framing (Sean): NOT "new/better home" → "a reliable spot to build a shared, lasting library of tools and tips that work for our minds" + "our community's external memory." Links posted in announcement: `stoke.community/communities/bodydoublingcom` (the public preview, has Join CTA) + the guide PDF `stoke.community/how-to-join-body-doubling.pdf`. Open decision at post time: the ping (`@here` online-only vs `@everyone` 13k vs none) — recommended `@here`. **Mod-team reframe (06/28):** mods folded the announcement into a calmer server-housekeeping post — "new text channels coming to the resources & server-guide category": (1) a *Voice Channel Descriptions* channel and (2) a resource channel that's "a guide to access" the shared library. Softer/embedded rollout → likely NO big ping (lives in a resource channel people discover, not an @everyone blast). ⚠️ **CORRECTED 07/01 — the "tense mismatch" was MY misread, there is NO mismatch.** I thought "A shared library" in the intro referred to Stoke (live now), clashing with "coming over the coming days." Sean corrected me: **"A shared library" is a forthcoming *Discord channel*** (a resource channel that will be a guide to accessing Stoke), NOT Stoke itself. So the intro (Discord channels, all genuinely future) and the body ("come take a look" at Stoke, genuinely live) are two different subjects on correct timelines — internally consistent. LESSON: don't flag a "contradiction" without confirming what each noun refers to. (Only residual, trivial + left alone: the phrase "shared library" names the future *channel* in the intro and the live *platform* in the body — same words, two referents, but coherent.) Optional copy nit: "premiere" vs "premier" (debut vs flagship) — Sean uses "premiere"; left to his call.
- **Both launch URLs verified LOGGED-OUT 06/28** (the 06/23 middleware static-file fix is holding): community link → 200, no redirect, serves the preview not the login wall (has "Get started" / "already have an account", NO password field); PDF → 200 `application/pdf`, 67KB, `%PDF-` magic bytes. Verify technique: a bare 200 `text/html` is NOT proof (login shell is also 200 ~13–23KB) — check content markers + absence of `type=password`; for PDFs check `%PDF-` magic bytes, not just status.
- **Silas! ↔ Q&A KB (future idea, NOT built):** Sean asked if the shared library "is where Silas! works." Functionally NO — Silas! is the Discord Pomodoro **voice** bot (separate system/platform); the library is the Stoke web Q&A KB. But thematically a great match (Silas! = librarian theme + a lasting library). Future possibility: Silas! pointing members to the KB. Don't conflate them in launch comms (would confuse where Silas! lives).

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

## Git
- No Co-Authored-By lines in commits
- Use PowerShell with semicolons not `&&`
- **Always push to GitHub after every commit** — no need to ask. This stands until Sean explicitly says the project has gone live.
