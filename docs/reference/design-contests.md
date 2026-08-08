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

## ⏸️ PAUSED 08/07/2026 — resumes Tuesday 08/11 (Sean in Denmark)

**Live state at pause:** the Body Doubling Design Contest
(`cf1a3cb4-323e-4404-a17d-5c38625b0b7f`) was moved **`submissions` → `draft`**
by Sean via the UI, so it 404s for non-mods. **0 entries, 0 votes** — nothing was
lost by reverting. `submissions_close_at` still `2026-09-01T04:00:00Z`
(Sept 1, 12:00 AM ET) = **21 days from the resume date**, and it is
*server-enforced*, so re-check it before reopening.

### Decided (Sean, 08/07)
- **No cash prizes.** Rationale is selection, not budget: a cash prize attracts
  design-contest hunters who have never body doubled, and the brief explicitly
  asks for something representing *"the kind of community and help that is
  received while using the server"* — which an outsider cannot answer honestly.
  **Prizes should be valuable to an insider and near-worthless to a stranger.**
- **Multiple categories**, not a single winner.

### ⭐ Multiple categories = multiple CONTESTS, not a category column
Settled by the schema, not by preference:
- The Contests tab already maps over many contests (`communities/[slug]/page.tsx`),
  so N contests render with **zero code**.
- **`contest_votes` PK is `(contest_id, voter_id)`** → one vote per contest, so
  separate contests give one vote *per category* for free. Categories *inside*
  one contest would give a member one vote **total** across all categories and
  would require changing the primary key.
- `max_entries_per_member` is per contest, so it scopes per category too.

### Proposed, NOT yet decided — do not treat as settled
- **Three categories chosen by required SKILL, not product type:** (1) Wearable
  design (flagship illustration); (2) Sticker (small format, low barrier);
  (3) **Words** — a slogan, *no drawing at all*. The third is the inclusion
  lever: "I can't draw" is the main reason people skip design contests, and far
  more of 13k members can write one true line than can illustrate one.
- **Package per winner:** design produced + credit on the listing + physical item
  free + custom Discord role + a year of a Plish supporter tier (costs nothing
  real; worthless to an outsider = the selection filter).
  **Finalists:** design printed as a sticker. **Everyone who enters:** a
  "Contributed a design" Discord role — so entering isn't a gamble.
- Rationale for spreading rewards: winner-take-all is the exact shape that stops
  this audience starting. Same instinct as no-deadline QotW.

### ⚠️ Don't promise selling
The storefront **does not exist** (see the split above). Promise what's certain —
the design gets **produced** and the winner gets a physical item (print-on-demand
handles one-offs with no store) — and phrase selling as intent. A contest promise
that slips is highly visible.

### ⏱️ Timezones: the DISPLAY side is already solved; only the INPUT side isn't
Sean's Denmark trip is **08/10 – 11/03/2026 (85 days, Aalborg)** — travels the
10th, arrives the 11th, works throughout. The Sept 1 deadline plus voting and the
winner **all** happen while he is on Copenhagen time, so the entire contest runs
from abroad.

**⚠️ The offset is not constant — it changes twice mid-contest.** Denmark falls
back **Oct 25**, the US **Nov 1**, so the gap to ET is **6h → 5h for one week →
6h**. Any deadline arithmetic done in October must check which side of those
dates it lands on.

**The membership is global** — Sean: *"there is likely a person from most
countries on the planet, so having a time offset is not a problem."* No single
deadline can give everyone a full final day, and chasing one is the wrong goal.

- ✅ **Members are fine.** `components/LocalDate.tsx` renders
  `new Date(ts).toLocaleDateString()` — i.e. in **the viewer's own timezone**. A
  member in Tokyo sees JST, Berlin sees CEST. Nobody converts anything. Do not
  "fix" this into a fixed zone.
- ⚠️ **The organizer's INPUT side is the real exposure.** `ContestManager`
  converts `datetime-local` through **the browser's zone** — correct, and what
  stopped the original deadline being four hours short, but it means *the same
  typed value means different things depending on where the laptop is standing*.
  "11:59 PM" typed in Denmark and typed at home are **six hours apart**. The
  inconsistency is the bug, not the offset.
- **Sean's lean: use Eastern Time as the canonical reference zone** — *"because
  it is where I am from, and I started the community, but I'm not picky."*
  Arbitrary-but-stable beats correct-but-drifting. Set deadlines in ET and verify
  the stored UTC by probe.
- **⚠️ The EXISTING deadline is already correct** (`2026-09-01T04:00:00Z`,
  hand-corrected = midnight ET). It merely *displays* as 6:00 AM Sept 1 in
  Denmark. **Do not "fix" it because it looks wrong** — that recreates the
  original bug.
- 💡 Proposed, not built: an opt-in `withZone` prop on `LocalDate`
  (`timeZoneName: 'short'`) for deadline displays only, so a member can tell the
  time was localized *for them* rather than quoted in someone else's zone. 8
  usages across 6 files, so keep it opt-in — zone labels would be noise in the
  audit log.

### First thing on resume
**The existing contest's brief is frozen** — `updateContest` exists but nothing
calls it. It must become category 1 (Wearable), which needs either the edit form
built (small: the action exists, it needs a form) or a one-off DB update. The two
new contests can be created fresh in settings with correct briefs.

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
