# Community Lifecycle — profile, members, ownership, preview, reviews, guide

> Split out of the project `CLAUDE.md` on 07/28/2026 so it is read on demand
> instead of injected into every session. This is REFERENCE, not an archive —
> it is current, and new detail about this area belongs here, not back in
> CLAUDE.md. Content below is verbatim from the original file.

## Organizer Guide (06/13/2026)
- **Two deliverables, one content:** portable markdown `docs/running-a-community.md` (paste into email/Discord) + in-app page `apps/web/app/guide/page.tsx` (standalone, outside `(app)`, own marketing header + `MarketingFooter`, `Section`/`Tip` subcomponents, TOC anchors).
- **⚠️ STAFF-ONLY, enforced not just hidden** (Sean: *"I do not want a public guide link, but I want the guide to be available to moderators/organizers/owners"*): `/guide` is NOT in the middleware public bypass (unauth → `/login`, platform-ban check applies); the page has a **server-side guard** — `isStaff = (active community_members count with role in [organizer,moderator], via admin client) > 0 || !!platform_roles`, else `redirect('/home')`. `(app)/layout.tsx` computes `isCommunityStaff` the same way for the gear-menu link. `MarketingFooter` has NO guide link (public surface = About/Privacy/Terms).
- **OnboardingChecklist** keeps its guide link and is **dismissable** (`'use client'`, × button, `localStorage` key `stoke_onboarding_dismissed_{slug}` — per community per browser, NOT per account; reads storage before render via a `ready` gate so it never flashes). Auto-hides when all 4 steps are done. Organizer-only surface → no changelog entry.
- **⚠️ Plan caps come from CODE, not memory:** `apps/web/lib/billing.ts` PLANS map is authoritative — Free `{1, 50, 3}`, Starter `{3, 300, 15}`, Pro `{Infinity×3}` (communities/members/channels). LESSON: when a "missing fact" is about platform BEHAVIOR, check the code first.

## Community Profile (About + Cover + Gallery — 07/08/2026)
- Trigger: Sean wanted GRACE (a just-created community) to "have more substance." A community's single photo was only the square **logo/avatar** (`image_url`, 64×64 header). Added three fields, all on `communities`:
  - `about text` — long-form free-form story (chose free-form over rigid structured fields). Editable in Settings→General (5000-char textarea, labeled `description` as the short tagline). Shown as an **About card under the header** on the community page (`RichContent`); on the public **preview it's LISTED-ONLY** (content privacy boundary).
  - `banner_url text` — wide cover image across the top of the community page + preview. Shown **publicly regardless of listed** (branding, like the avatar).
  - `photos text[] default '{}'` — gallery reusing existing `PhotoUploader`/`PhotoGallery`/`ImageLightbox`; saved via `updateCommunityInfo` (photos JSON injected into the form submit); shown as a Photos card after About; **LISTED-ONLY on preview**.
- `CommunityImageCropModal` was **generalized** with an `aspect`/`outputWidth`/`title` prop (defaults `1`/`400`/'Crop photo' → square avatar math UNCHANGED); banner passes `aspect=3, outputWidth=1500`. Storage all in the `avatars` bucket: avatar `community-{id}`, banner `community-banner-{id}`, gallery `community-photos/gallery-{id}/`.
- Privacy rule locked: **branding (avatar, banner) shows on public preview; content (About, gallery, bulletin teaser) is listed-only.**


## Bulk-Add Members (07/15/2026 — SHIPPED `b12e951` + `d2fae29`)
- Live-meeting onboarding tool: an operator types members' details into a spreadsheet-like grid and creates their accounts on the spot. Page `communities/[slug]/bulk-add/page.tsx` (gated to **owner / organizer / platform-staff** — heavier than everyday mod, mirrors "who can email all members"), linked from Settings → Members. `components/community/BulkAddMembers.tsx` (grid: Username · Email · Password, auto-grows, **paste from Excel/Sheets**, a shared temp-password field + "Apply to all"). Action `app/actions/bulk-members.ts`.
- **⚠️ Email confirmation is OFF on Stoke's Supabase** (verified empirically) and `admin.auth.admin.createUser({ email_confirm: true })` **sends NO email** (unlike `inviteUserByEmail`) — those two facts together are what make operator-created accounts work instantly.
- Per row: `createUser` with `user_metadata: { username, display_name }` (the `handle_new_user` trigger builds the profile from it), then insert/reactivate a `community_members` row as active — **bypasses join_mode by design**. Respects `checkMemberLimit`, skips banned, leaves existing members' roles untouched. Audits `member.added`.
- Welcome email (`bulkWelcomeHtml`) fires **only for newly-created accounts** — existing accounts added to a community already have a login. **⚠️ It emails the PLAINTEXT temp password** (accepted: throwaway, changed on first login).
- **GOTCHA (this box):** `curl` returns `000` for ALL stoke.community URLs here (broken TLS/network in the sandbox) — a poll for "404 → non-404" gives a FALSE positive. Use PowerShell `Invoke-WebRequest -SkipHttpErrorCheck` for status checks. A 307 to /login proves an auth-gated route deployed fine.
- **GOTCHA:** the `resend` SDK import path is fiddly in a standalone node script — just POST `https://api.resend.com/emails` with fetch + Bearer key.
- GRACE community: slug `grace-grassroots-arts-community-education`, `join_mode:'request'`.

## Community Ownership Transfer (06/22/2026 — BUILT)
- `transferOwnership(communityId, slug, newOwnerId)` in `app/actions/community.ts`; UI = `components/community/settings/TransferOwnershipSection.tsx`, a red Danger-zone section **shown only to the real community owner** (`community.owner_id === user.id` — orgs/mods/platform staff viewing settings don't see it). **No migration** — reuses `owner_id` + `community_members`.
- **Billing follows owner_id automatically:** `getCommunityOwnerPlan()` in `lib/billing.ts` reads it live, so the new owner's plan takes over the limits with no billing record to migrate.
- **Rules:** initiator = real owner OR platform staff (the action allows both for a future admin tool; the UI only exposes it to the owner). Recipient must be an **active organizer** — deliberate pre-vetting, so a solo organizer must promote someone first (intentional friction). Old owner stays an active organizer (keeps access, loses owner-only powers; Danger zone disappears on `router.refresh()`, no redirect). Guardrail: `checkCommunityLimit(newOwnerId)` blocks if the recipient is at their plan's community cap; member/channel counts are NOT retroactively enforced (same as a downgrade). Confirmation = type the community name. Emails the new owner (`ownershipTransferredHtml`).
- **Audit:** `community.ownership_transferred`, metadata `{from_owner, to_owner, from_owner_name, to_owner_name}` (names stored at write time). Both audit surfaces render `· from {previous owner}` — **it matters because platform-staff-initiated transfers have actor ≠ previous owner, so this is the only place the original owner appears.**

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
- **One `reviews` table, scoped by nullable `community_id`** (NULL = a platform-level review of Stoke). Migrations `20260623000000_reviews.sql` + `20260623120000_review_replies_ordering.sql` — **both verified run**. Pending reads + all writes via `createAdminClient()`; all joins need `profiles!author_id(...)`.
- **Two-tier:** pending → published (in-app to members) → `is_featured` (the public subset). **Featured cap = 6**, ordered by `featured_position` (`reorderFeatured`).
- **⚠️ One review per author per scope needs TWO partial unique indexes** (`where community_id is not null` / `where community_id is null`) — NULLs are distinct in a plain unique constraint, so one wouldn't hold.
- **Edit → re-approval:** `editReview` forces `status='pending', is_featured=false` in the same update, so an edited review drops from all public display until re-approved.
- **Replies:** `reply_body`/`reply_is_public`/`reply_by`/`reply_at`, one per review; public replies show wherever the review shows, private ones only to the author + staff (`canSeeReply`).
- **Eligibility:** community review = active member (mod/owner auto-publishes); platform review = any logged-in user; platform-scope "mod" = owner/platform_moderator only.
- **Surfaces:** community Reviews tab (display-only, "manage in settings"), `ReviewsManager.tsx` in settings AND `/admin/reviews`, featured reviews on `preview/[slug]` + the landing page (**renders nothing when zero featured**). Member entry at `/feedback`.

