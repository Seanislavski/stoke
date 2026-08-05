# Design Contests

> Reference, not an archive — current, and new detail about contests belongs
> here rather than in the project `CLAUDE.md`.
> Started 08/05/2026. **LIVE** — backend `d55b6d8`, UI `bead219`, migration
> applied and verified 08/05. A contest can run end to end.

## Why it exists

A Body Doubling Discord member suggested a community design competition whose
winning designs become official server merch — an idea he'd raised long before,
which Sean liked and never followed up. Sean wanted it managed on Stoke rather
than in Discord threads or a Google Form.

## ⚠️ The competition is deliberately NOT the storefront

Selling merch was **split out and deferred**, and the reason is structural:
`lib/stripe.ts` + `api/stripe/checkout` + `api/webhooks/stripe` are
**single-merchant subscription billing** — they exist to collect Sean's plan
revenue. There is **no Stripe Connect anywhere in the codebase**.

- *"Communities can sell merch"* = multi-merchant = Connect, KYC onboarding,
  payouts, per-community tax liability. Platform-scale project.
- *"Body Doubling sells merch"* = one merchant = the account that already exists
  = payment-mode Checkout + print-on-demand fulfillment. Roughly a week.

A contest runs start to finish before any store exists, so the two are
decoupled: if the storefront slips, the contest still happened. **Don't
re-scope the storefront without re-reading this** — the cost difference between
the two readings is months.

Other deferred pieces: shipping addresses (a new PII category, needs Terms +
Privacy updates), sales tax/VAT across a global 13k community, chargebacks, and
merch becoming its own support-ticket category.

## Decisions locked (08/05/2026, with Sean)

- **Winner = mods shortlist finalists, then members vote on the shortlist.** Not
  a raw open vote.
- **All communities**, opt-in via `communities.has_contests`, default `false`.
  Built as a real platform feature, not a Body Doubling special case.
- **Entries hidden until voting opens.** The entrant always sees their own.
- **Phase transitions are manual mod actions, not cron.**

### ⚠️ Voting vs. the "no upvotes/karma" rule

Q&A deliberately has **no upvotes or karma** — gamifying help attracts
transactional behavior and repels genuine helpers. Contest voting is a
deliberate exception, decided on purpose rather than by accident: a time-boxed
contest is a different context from a permanent help library, and the
shortlist model keeps it from being a raw popularity engine. **This is settled —
don't re-litigate it, and don't cite it as precedent for adding voting to Q&A.**

## Schema — `20260805000000_contests.sql`

- **`contests`** — community_id, title, description (the brief), rules, `terms`,
  `status` (`draft|submissions|voting|closed`), `submissions_close_at`,
  `voting_close_at`, `max_entries_per_member`, `winner_entry_id`, created_by,
  timestamps, closed_at.
  `winner_entry_id` is added by an `alter table` at the **end** of the migration
  because it references `contest_entries`, which doesn't exist yet at the point
  `contests` is created.
- **`contest_entries`** — contest_id, `community_id` (denormalized like
  `kb_answers`, so the mod queue filters by community without a join), author_id,
  title, description, `photos text[]`, `status` (`pending|approved|rejected`),
  `is_finalist`, **`terms_agreed_at` NOT NULL**, approved_by, timestamps.
- **`contest_votes`** — contest_id, entry_id, voter_id, **PK
  `(contest_id, voter_id)`**.
- **All three: RLS on, no policies** = service-role only, same as `qotw_items`
  and `discord_captures`. Every read/write goes through `createAdminClient()`
  inside a mod-gated or membership-gated server action.

### ⭐ The PK *is* the one-vote rule

`contest_votes` has primary key `(contest_id, voter_id)`. That constraint —
not application logic — is what prevents double voting. `entry_id` is merely
*which* entry they picked, so **changing a vote is a plain upsert**
(`onConflict: 'contest_id,voter_id'`), never a delete-then-insert. Reusable
shape any time "one X per Y" needs enforcing.

### ⚠️ `terms_agreed_at` is NOT NULL by design

The whole point of the feature is producing a design the community can legally
print. An entry **cannot exist** without a recorded licence grant. If a future
change makes this nullable or backfills it, the legal basis for printing the
winner is gone. The default terms text is editable per contest and lives in
`DEFAULT_TERMS` in `app/actions/contests.ts`.

> The default wording is a plain-language grant, **not lawyer-reviewed**. Flagged
> to Sean 08/05: worth a real review if money attaches.

## Lifecycle

| Phase | Members see | Members can | Mods can |
|---|---|---|---|
| `draft` | nothing | — | edit, open submissions |
| `submissions` | brief + rules + own entry | submit, edit own entry | approve/reject |
| `voting` | finalists only | cast/change one vote | mark finalists, close |
| `closed` | winner + gallery + counts | — | set/change winner |

Vote counts stay hidden until `closed` so early votes don't snowball.
`ALLOWED_TRANSITIONS` in `lib/contests.ts` is the whitelist.

- **Why manual, not cron:** a contest is a one-off. A mod pressing a button beats
  a scheduled transition nobody is watching, and it avoids a second cron
  dependency. Follows the `qotw_items.planned_for` precedent — *"an optional
  organizational label; does NOT auto-publish."*
- **The one exception:** `submissions_close_at` **is enforced server-side** in
  `submissionsOpen()`, so a late entry can't slip in while a mod is asleep.
- **Guard:** `setContestStatus` refuses to open voting with zero finalists —
  otherwise members get an empty ballot.
- **Editing mirrors the Q&A rule:** an author editing an already-*approved* entry
  sends it back to `pending` and clears `is_finalist`. A mod editing doesn't.

## Files

- `supabase/migrations/20260805000000_contests.sql`
- `apps/web/lib/contests.ts` — phase math shared by actions and pages
  (`submissionsOpen`, `votingOpen`, `countsVisible`, `canSeeEntry`,
  `canTransition`, `phaseHint`). Single source, same reason
  `lib/qotw-schedule.ts` exists.
- `apps/web/app/actions/contests.ts` — 13 actions; `getAccess()` and
  `modEmails()` mirror the `knowledge.ts` helpers.
- `lib/email.ts` — `contestEntrySubmittedHtml`, `contestWinnerHtml`
- `lib/audit.ts` — `contest.*` / `entry.*` labels; photo source `contest`

**UI (`bead219`):**
- `app/(app)/communities/[slug]/contests/[contestId]/page.tsx` — the detail page
- `components/contests/` — `SubmitEntryForm` (doubles as the edit form),
  `EntryModActions`, `VoteButton`, `ContestPhaseControls`, `ContestManager`
- Contests tab on `communities/[slug]/page.tsx`, gated on `has_contests`
- `#contests` section + quick-nav anchor in community settings

### ⭐ Two privacy properties built on purpose

1. **Vote counts are only *queried* when `countsVisible()` is true** — not
   fetched and then hidden in the markup. A hidden tally still ships in the RSC
   payload, where a curious member can read it mid-vote. Same reasoning as the
   Q&A non-member path using `count`/`head: true` so answer bodies never reach
   memory.
2. **Draft contests 404 for non-mods** rather than rendering an empty shell.

## Public access — ✅ FIXED 08/05 (`e4e078b`)

Contests originally shipped members-only with no preview: logged-out visitors
**307'd to `/login`**, signed-in non-members got a bare 404. That blocked
announcing a contest anywhere. Now:

- **Logged out** → `app/preview/[slug]/contests/[contestId]/page.tsx`, reached by
  a `middleware.ts` rewrite of the canonical URL so a shared link stays clean.
- **Signed in, not a member** → `components/contests/ContestJoinGate.tsx` in
  place of the entries. ⚠️ It calls `router.refresh()` after an open join because
  `joinCommunity` only revalidates `/communities/{slug}`.
- The contest is now fetched **before** the access gate — a non-member has to be
  shown the brief to have any reason to join.

### ⚠️ Keep the two rules identical

Both paths expose a contest when it is **non-draft AND the community is listed**.
There's a warning comment in each file. If the logged-out rule is ever made
narrower, a signed-in visitor sees *less* than a stranger — the inversion this
bug class keeps producing (twice in Q&A, once here).

### ⭐ Entries are never public — not even the count

Deliberately different from Q&A, which *does* surface an answer count. A contest
still collecting entries shouldn't advertise "0 so far" to strangers. Same
privacy instinct, opposite conclusion, because the context differs.

### ✅ Timezone bug fixed at the source

`submissions_close_at` was stored from a naive `datetime-local` and read as UTC:
the first real contest was set to "Sept 1 00:00" and stored
`2026-09-01T00:00:00Z` = **Aug 31, 8:00 PM ET**, silently four hours short of a
deadline that is *enforced*. `ContestManager` now converts through `Date` in the
browser's zone before submitting. The affected row was corrected by hand to
`2026-09-01T04:00:00Z`.

**Still to build:** moderation-queue "Contest entries" section; audit `View →`
for `target_type: 'entry'`; **editing an existing contest** — `updateContest`
exists in the actions file but nothing calls it yet, so title/brief/rules/terms
are fixed once created. (The settings copy promising terms-editing was corrected
rather than left as a false promise.)

## ⚠️ Traps

- **`contest_entries` has TWO FKs to `profiles`** (`author_id`, `approved_by`) →
  every join must be `profiles!author_id(...)` or PostgREST silently returns
  null.
- **Photo uploads must keep the `community-photos/` prefix** —
  `pathPrefix={`community-photos/contest-${contestId}`}`. Every other caller
  (bulletin, events, resources, gallery) uses that first segment, and the
  existing dashboard storage policy covers it. Inventing a new first segment
  means writing a new storage policy.
- Server actions passed to client components need `.bind(null, ...)`.
- `startTransition(() => void action())` — the callback must return `void`.
