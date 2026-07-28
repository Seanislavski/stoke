# CLAUDE.md narrative archive — 2026-07-28

Second archive pass (the first is `2026-07-26-narrative-archive.md`). These
sections were moved out of the project CLAUDE.md **verbatim** — nothing was
deleted. Each was replaced there by a condensed reference version plus a
pointer back to this file.

What moved: the day-by-day build narrative — how a feature was found to be
needed, which commit changed what, what was tried and superseded. The durable
part (schemas, ids, paths, decisions, gotchas) stayed behind.

---

## SLOT: GEAR-MENUS  (original lines 110-117)

## Gear Menus
- **Global gear** (AppNav): avatar + gear icon → dropdown; items gated on `platformRole` prop passed from layout; platform team items only shown when role exists. **Admin section consolidated (07/07/2026, `df942dd`):** the four separate admin links ("Admin panel"/"Moderation"/"Manage communities"/"Support queue") that were MISLABELED + incomplete vs `AdminNav` (same URLs, different names; Users/Reviews/Audit missing entirely) are now a SINGLE "Admin" entry → `adminHref(role)` lands each platform role on its first usable page (owner→/admin, platform_moderator→/admin/users, community_manager→/admin/communities, support→/admin/support); `AdminNav` is the source of truth once inside. Also added a "What's new" link (→/changelog) in the common section.
- **Community gear → DROPDOWN (07/07/2026, `e0e3f5d`):** `CommunityGear.tsx` was a bare icon-link to /settings; now it's a client dropdown (click-outside close) surfacing every mod destination: **Review queue (N badge) · Question of the Week · Settings · Audit log** (audit → `/settings#audit-log` anchor). Pending-count badge on the gear icon = `totalPending` (all pending: joins+reviews+posts+questions+answers). Gated on `isMod`. **The old standalone "N to review" pill was REMOVED** (it duplicated the gear badge — same number, two destinations).
- **Community header role labels — role-aware (07/07/2026, `ef92213`; SUPERSEDES the 07/01 owner-only "Organizer" note):** Sean: *"can't we do everything?"* → `JoinButton.tsx` now shows an accurate role badge for ALL staff, coexisting with the Leave action (badge + button together, not one-or-the-other): community **owner** → "Owner" badge (no Leave, owners can't leave); **organizer** → "Organizer" badge + Leave; **moderator** → "Moderator" badge + Leave; **member** → Leave (no badge); non-member → Join/Request; logged-out → never (preview). `JoinButton` gained a `role` prop (`myMembership?.role`), `isOwner` still authoritative for the "Owner" label. `RoleBadge` subcomponent. (Old behavior was owner-only "Organizer" — replaced.)
- **Community header mobile fix (07/01/2026):** header row `communities/[slug]/page.tsx` changed `flex items-start justify-between` → `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4` so it **stacks on mobile** (title/meta on top, action row [Organizer label / Join + gear] below, full width) and stays side-by-side at `sm`+ (desktop unchanged). Fixed "Organizer" being cramped on mobile. Also added `whitespace-nowrap` to the Organizer span in `JoinButton.tsx`. tsc clean. Committed `16737b3` and PUSHED — live in prod.
- **Settings quick-nav (07/07/2026, `98006f8`):** the 10-section settings scroll got a **sticky anchor sub-nav** (top-14 z-[5] overflow-x-auto, under AppNav) — General·Spaces·Q&A·QotW·Reviews·Invites·Members·Email·Danger·Audit; each `<section>` got an `id` + `scroll-mt-20`; Email/Danger links render conditionally (organizer/owner, owner). The gear-dropdown's "Audit log" deep-links `#audit-log`.
- **Community tab strip mobile (07/07/2026, `0f57e32`):** 5 tabs (Bulletin/Events/Q&A/Channels/Reviews) → container `overflow-x-auto` + each tab `shrink-0 whitespace-nowrap` so they scroll horizontally instead of crowding on narrow screens.


---

## SLOT: QA-EDITING  (original lines 118-122)

## Q&A Question/Answer Editing (07/07/2026 — `d1af1d8`, LIVE, no migration)
- **Trigger:** Sean answered QotW-1 himself, realized *"once a post has been made [there is no way to] edit it"* (only delete + accept existed). Chose scope = **Answers + Questions**; re-approval model = **re-queue** (Sean: *"I think it makes sense for it to re-queue but I also understand your recommendation"*).
- **Rules:** author/asker-only edit. **Member edit to a PUBLISHED item → back to `pending`** (mods emailed via `kbAnswerSubmittedHtml`/`kbQuestionSubmittedHtml`, amber "back in review" notice), clears approved_by/published_at (+ `is_accepted=false` on answers). **Mod/owner edit stays LIVE** (no re-queue). Member edit to a pending item stays pending. **QotW questions are edit-locked to mods** (`canEdit = isMod || (isAsker && !isQotw)`) so a member can't pull a live/numbered QotW back into review. Non-authors can't edit others' answers (mods delete only, no rewording).
- **Impl:** `editAnswer`/`editQuestion` in `knowledge.ts` (`requeue = !isMod && status !== 'pending'`); audit labels `answer.edited`/`question.edited`; NEW `components/knowledge/EditAnswer.tsx` + `EditQuestion.tsx` (children-slot pattern — view mode renders the server display + an "Edit" affordance, edit mode a form; `canEdit` prop short-circuits to `<>{children}</>`; `RichContent` is `'use client'` so reusable inside). Wired into `questions/[questionId]/page.tsx` (question title→body wrapped; each published answer body/url wrapped).


---

## SLOT: REVIEW-QUEUE  (original lines 123-127)

## Moderation Review Queue (07/07/2026 — `071c191`, LIVE, no migration)
- **Trigger:** Sean found a pending Q&A answer only via email — *"how do I make it so mods (and myself) can see what needs approval and what needs to be taken care of?"* Gap: pending items were fragmented (bulletin pending on bulletin tab only, Q&A questions on qa tab only, **pending ANSWERS only on each individual question detail page = no aggregation**, gear badge counted only joins+reviews). Sean chose the **full queue page** (vs just fixing the Q&A gap).
- **New mod-only page `app/(app)/communities/[slug]/moderation/page.tsx`** — aggregates ALL pending in one place with inline approve/reject: **join requests · bulletin posts · Q&A questions · Q&A answers · reviews** (empty state "🎉 All clear"). Reuses existing actions/components (`approveRequest`/`rejectRequest`, `ModActions`=posts, `QuestionModActions`+category, `AnswerModActions`, `approveReview`/`rejectReview`). Pending answers labeled with their question title + link (batch `titleById` map). NEW generic `components/community/QueueActions.tsx` (bound-action approve/reject, Done-in-place) for requests+reviews.
- **Gear badge now = `totalPending`** (joins+reviews+posts+questions+**answers**) via 3 new count queries on the community `page.tsx`. Reachable from the gear dropdown ("Review queue N"). All reused components use the in-place "Done" pattern (item gone on reload).


---

## SLOT: CHANGELOG-FEATURE  (original lines 128-132)

## Changelog / "What's New" (07/07/2026 — `e12659d` + rule `0adb2fe`, LIVE)
- **Trigger:** Sean: *"at some point I would like to better track system changes so I can put out announcements."* Framed: internal record (git/CLAUDE.md/logs, already exists) vs a **curated user-facing changelog** (the gap). Sean chose **doc + public page now**.
- **Single source of truth = `apps/web/lib/changelog.ts`** (typed `ChangelogEntry[] {date,title,items[]}`, human-readable = the "doc", NO markdown-parser dep, no drift). **Public page `app/changelog/page.tsx`** ("What's new", timeline UI, mirrors `/about` header + `MarketingFooter`); `middleware.ts` `isLegalPage` += `/changelog` (public logged-out). Linked from `MarketingFooter` + AppNav dropdown. Seeded with 3 releases (Jul5/6/7).
- **⚙️ THE MECHANISM that keeps it current (this is why it persists):** a STANDING RULE was added to the **Git section of this CLAUDE.md** (`0adb2fe`) — on any commit shipping a user-facing change, add a plain-language entry to `lib/changelog.ts` in the SAME commit; curate (skip internal work); proactively offer it. PLUS a project-agnostic **backstop step 5 in the global `/s` skill** (`C:/Users/Sean/.claude/commands/s.md`) that sweeps for un-logged user-facing changes at session end (only activates where a project defines such a rule). Two layers: per-commit (precise) + `/s` (safety net). Rationale (Sean asked "what ensures regular updating?"): an in-session intention does NOT persist; only CLAUDE.md (auto-injected each session) + `/s` do.


---

## SLOT: ORGANIZER-GUIDE  (original lines 133-144)

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


---

## SLOT: NONMEMBER-GATE  (original lines 204-212)

## Signed-in non-member question gate (07/26/2026 — SHIPPED `70c085b`, pushed)
- **Found while answering a question about the parked `/library` idea.** Sean assumed *"answers remain available to people who have signed up"* and asked *"that is how it currently is, right?"* — checked the code instead of memory, and he was off by one step: the gate is **MEMBERSHIP, not signup**. `questions/[questionId]/page.tsx` had `canSee = isMember || isMod` → else `notFound()`, so a signed-up non-member got a **bare 404** — the least informative screen on the platform handed to the person furthest along the funnel.
- **`components/knowledge/QuestionJoinGate.tsx` (NEW, client):** replaces that 404 with the question + answer COUNT + a way in — `Join` (open), `Request to join` + "Request sent" confirmation (request), explanatory note (invite_only, no dead button). **⚠️ `joinCommunity` only `revalidatePath('/communities/{slug}')`, which does NOT refresh the question page** — so the component calls `router.refresh()` after an open join, or you join and keep staring at the locked panel.
- **`questions/[questionId]/page.tsx`:** question is now fetched **BEFORE** the access gate (a non-member has to be shown it). Non-member branch returns early with title/body/photos/asker/date + the gate.
- **Privacy rule:** `canPreview = !canSee && status==='published' && (community.is_listed || question.is_public || isNumberedQotw)`. Everything else still 404s → an unlisted community's Q&A is never exposed by URL guessing. Answers stay members-only: the non-member path runs a `count`-only query with `head: true`, so answer bodies are never fetched (same discipline as the logged-out preview).
- **⭐ SELF-CAUGHT INVERSION (the reusable lesson):** the first version gated on `is_listed || is_public` only — which left a **numbered QotW in an unlisted community as a 404 for signed-in visitors while staying readable to logged-out strangers** via `/qotw/N`. That is the SAME "signed-in sees less than a stranger" bug the fix exists to kill. **Whenever you gate a page, check it against what the LOGGED-OUT preview already exposes — the authenticated path must never be strictly more restrictive.** Fixed by adding the `isNumberedQotw` lookup.
- Changelog 07-26 entry added (member-facing — unlike the staff-only work earlier the same day).
- **⏳ OPEN / tied to `/library`:** this fix is good under `join_mode='open'` (current). Sean's recorded plan to switch Body Doubling back to closed would turn every Silas `/library` link into an approval wall (request) or a polite dead end (invite_only) — so **join mode is part of `/library`'s design, not a separate setting.**


---

## SLOT: HOMEHERO  (original lines 317-330)

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


---

## SLOT: OWNERSHIP-TRANSFER  (original lines 346-353)

## Community Ownership Transfer (06/22/2026 — was the "Known Bugs / Open Items" gap, now BUILT)
- `transferOwnership(communityId, slug, newOwnerId)` in `app/actions/community.ts`. UI = `components/community/settings/TransferOwnershipSection.tsx`, a red "Danger zone" section on the settings page, **shown only to the real community owner** (`isOwner` = `community.owner_id === user.id`; orgs/mods/platform-staff viewing settings don't see it).
- **No DB migration** — reuses `owner_id` column + `community_members` rows.
- **Billing follows owner_id automatically:** `getCommunityOwnerPlan()` in `lib/billing.ts` reads owner_id live, so transfer just updates owner_id and the new owner's plan takes over the limits. No per-community billing record to migrate.
- **Rules:** initiator = real owner OR platform staff (action allows both for future admin tool; UI only the real owner). Recipient must be an **active organizer** (deliberate pre-vetting; solo organizer must promote someone first — intentional friction). Old owner stays an active organizer (keeps access, loses owner-only powers). Billing guardrail: `checkCommunityLimit(newOwnerId)` blocks if recipient is at their plan's community cap. Member/channel counts NOT retroactively enforced (same as a downgrade). Confirmation = type-the-community-name. Notifies new owner by email (`ownershipTransferredHtml`).
- **Audit:** action `community.ownership_transferred` (label "Transferred community ownership"); metadata `{from_owner, to_owner, from_owner_name, to_owner_name}` (names stored at write time). Both audit surfaces (community settings + platform `AuditLogClient`) render `· from {previous owner}` after the `· {new owner}` target_user line. Matters because platform-staff-initiated transfers have actor≠prev owner, so "from X" is the only place the original owner shows.
- **Post-transfer UX:** old owner's `router.refresh()` → `isOwner` now false → Danger zone disappears, but they're still organizer so `callerRole='organizer'`, no redirect, keeps settings access.


---

## SLOT: REVIEWS  (original lines 364-373)

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

---

## SLOT: STATIC-LAUNCH  (original lines 383-392)

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

---

## SLOT: PROFILE-BACK-NAV  (original lines 399-404)

## Profile Back Navigation (07/01/2026)
- **Problem (Sean):** clicking a member's profile had "no way to go back to where you clicked on it" — relied on the browser back button. Wanted it "part of the platform so nobody has to click 'back'."
- **`apps/web/components/BackButton.tsx`** (NEW, client component): "← Back" control, inline SVG arrow (no lucide in this repo — inline SVGs throughout). Calls `router.back()` when `window.history.length > 1` (returns to the exact origin — members list / Q&A / chat / audit log / reviews, wherever), else `router.push(fallback)` (default `/home`) for deep links with no in-app history. Prop: `fallback?: string`.
- Rendered at top of `app/(app)/profile/[username]/page.tsx` (a server component; BackButton is the client island). `npx tsc --noEmit` clean. Profile links are clicked from 11 files → "go back to origin" beats any hardcoded destination.
- ✅ Committed `8df1e1b` + pushed (Sean said "go") → deployed with the Stripe fix. **NOTE: now that Stoke is LIVE, I stopped auto-pushing and asked first (commit vs push are separate steps); Sean confirmed each.** Reconsider the global "always push after commit" CLAUDE.md rule — for a launched product, confirm before the push that triggers a prod deploy.


---

## SLOT: CONTEXT-BUDGET  (original lines 416-428)

## Context Budget / CLAUDE.md hygiene (07/26/2026)
- **Trigger:** Sean, looking at the memory file: *"I don't understand what can be freed here?"* Measured rather than guessed — startup load was **~238 KB ≈ 59k tokens = 30% of the 200k window gone before he typed a word** (project CLAUDE.md 153 KB + global 39 KB + SessionStart hook 45 KB).
- **Two fixes, ~112 KB / ~28k tokens freed (47%):**
  1. **The duplicate.** `C:/Users/Sean/.claude/scripts/session_start.py` was injecting the **global** CLAUDE.md, which Claude Code already loads natively as user memory — it was in context twice, verbatim. Removed (comment left in the script so a future session doesn't re-add it). Hook output 45.5 KB → 7.9 KB. It still injects the last 3 session logs; only the CLAUDE.md read was dropped.
  2. **Archive pass.** Six narrative-heavy sections moved **verbatim** to `docs/claude-md-archive/2026-07-26-narrative-archive.md` (99,832 bytes, nothing deleted), each replaced by a condensed version + a `>` pointer line. Project CLAUDE.md 153,202 → 79,184 bytes.
- **⚠️ THE RULE THIS ESTABLISHES — what belongs in CLAUDE.md vs the archive:** KEEP every schema, migration name, ID, file path, decision, and ⚠️ gotcha. ARCHIVE the day-by-day debugging narrative — how a bug was found, what was tried, what turned out wrong. Once a thing is fixed, *the fix* is durable and *the hunt* is history. A section that reads like a story instead of a reference is the signal.
- **Also corrected 3 stale headers** claiming "NOT yet committed" for work that shipped weeks earlier (capture pipeline `de58d9d`, bulk-add `b12e951`, moderator guide `504f65e`). Stale status lines cost tokens **and actively mislead** — they're worse than bloat.
- **Method worth reusing** (avoids re-reading the whole file into context to edit it): a PowerShell pass extracts the target line ranges verbatim into the archive and leaves `<!--SLOT-NAME-->` markers behind; then `Edit` each marker with freshly-written condensed prose. Original backed up to the session scratchpad first.
- **Shipped as `b8f2e33`** (CLAUDE.md + `docs/claude-md-archive/`), alongside the join gate `70c085b`. Deliberately left untracked: `CLAUDEbackup.md` (superseded by the archive doc), `images/`, `Question-of-the-Week-BodyDoubling.pdf` (already seeded to DB), `.claude/name` + `.claude/settings.json` (local tooling).
- **THE REAL LEVER IS GROWTH RATE, not size.** Every `/s` appends and nothing ever compacts, so this file re-bloats on a predictable curve. Measured: **79,184 bytes after the 07/26 pass → 89,795 two days later (+10.6 KB)**.
- **✅ ARCHIVE THRESHOLD BUILT 07/28** as **step 6 of the global `/s`** (`C:/Users/Sean/.claude/commands/s.md`). Measures the project CLAUDE.md in **BYTES** and bands it 🟢 <55 KB (silent) / 🟡 55–80 KB (one-line mention) / 🔴 80 KB+ (offers an archive pass — offers, never acts unasked). Carries the keep-vs-archive rule and the SLOT-marker method inline so it works in any project.
- **⚠️ BYTES, NOT LINES — `/pulse` and `/preserve` are measuring the wrong thing for this file.** Both threshold at **280 lines**, but a reference-style CLAUDE.md averages ~205 bytes/line (each bullet is a paragraph), so 437 lines here = 89.8 KB ≈ 22k tokens while the 227-line global file = 39 KB ≈ 9.5k. `/pulse` also only ever looks at the **global** file, so it reports 🟢 while the project file — the bigger cost — is invisible to it. Don't try to reconcile the two numbers; they measure different things.


---

