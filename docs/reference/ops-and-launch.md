# Ops & Launch — hosted assets, launch history, seed scripts

> Split out of the project `CLAUDE.md` on 07/28/2026 so it is read on demand
> instead of injected into every session. This is REFERENCE, not an archive —
> it is current, and new detail about this area belongs here, not back in
> CLAUDE.md. Content below is verbatim from the original file.

## Seed / Cleanup Scripts (`scripts/`)
- `seed-communities.mjs` / `unseed-communities.mjs` — 15 demo communities + ~45 fake users on `@seed.stoke.community` emails. Seed is idempotent/re-runnable; unseed deletes seed-owned communities (FK cascade) then the fake users (cascade clears profiles + memberships, including seed members of real communities). Run unseed before launch.
- `seed-bodydoubling-qa.mjs` — Body Doubling starter Q&A (KEEP; intentional content).
- `inventory.mjs` (read-only) — lists all communities (SEED vs REAL, owner email, listed, member count) + non-seed users (what they own, review count). Use before any deletion.
- `cleanup-test-communities.mjs` — deletes a hardcoded allow-list of hand-made test community slugs (Dracula Fans, Dorky Platypus Lovers, Mom's Art Group, Stonington Lobsta Party, Intrepid Design Gurus); hard-excludes bodydoubling; dry-run unless `--yes`.
- `cleanup-accounts.mjs` — deletes auth users by email passed as args; PROTECTED list refuses `baldwinseana@gmail.com` (flagship owner); dry-run unless `--yes`.
- All scripts load `apps/web/.env.local` (service role key). The CC auto-mode classifier blocks Claude from running `--yes` destructive deletes directly; Sean runs them himself in-session via the `! <command>` prefix.
- **Real account note:** `baldwinseana@gmail.com` owns the flagship BodyDoubling.com (slug `bodydoublingcom`, **listed as of 07/26**) + was the owner of test communities Dracula Fans + Dorky Platypus Lovers. `sean@bodydoubling.com` is Sean's CC login (owned test community Mom's Art Group). Stoke has NO public people directory (v1), so accounts owning no communities are invisible at launch.


## Static Assets, Hosted Docs & Launch (06/23–07/01/2026)
> Launch post-mortem, funnel analysis + Discord announcement history archived in `docs/claude-md-archive/2026-07-26-narrative-archive.md` and `2026-07-28-narrative-archive.md`.
- **⚠️ The middleware matcher must exclude EVERY hosted static file extension.** `config.matcher` originally excluded only image types, so `.pdf`/`.html` in `apps/web/public/` hit the auth gate and redirected logged-out visitors to `/login`. Now excludes `pdf|html|ico|txt|xml|webmanifest`. **Any new public static file type must be added there.**
- **⚠️ ALWAYS test hosted assets while LOGGED OUT, and check content markers not just status.** The login shell also returns 200 `text/html` (~13–23KB) with no `type=password` in the source (client-rendered form) — trivially mistaken for success. Verify `%PDF-` magic bytes for PDFs; for pages, look for real content markers.
- **PDF from HTML** (zero deps): headless Chrome/Edge print-to-pdf — see the elevated-terminal `--do-not-de-elevate` gotcha in the global CLAUDE.md, which is what silently breaks it.
- **✅ LAUNCHED 06/29/2026** (`@everyone` in Discord #announcements, 13k members; re-posted 06/30). ~42 reactions, ~11 signups in two days; 35 signups / 32 active BD members by 07/07, ~2–3/day. **Diagnosis: reach HIGH ✅, resonance STRONG ✅, signup completion LOW ❌ — the leak is CONVERSION**, the gap between a frictionless 🔥 react and "leave Discord, make an account, learn a platform" (steep for an ADHD audience). Levers: seed the room so a first visit shows a LIVING library; shrink the per-touchpoint ask ("answer this one question" beats "explore a platform" — that's what QotW is for now the @everyone card is spent); work reactors as warm leads via DMs.
- **LESSON:** never record a launch's reach or ping from a *plan* or a mod's stated intention — confirm from the actual posted message.
- **⚠️ YOU CANNOT VERIFY A GATED PAGE'S DEPLOYMENT FROM OUTSIDE — middleware runs BEFORE routing.** `https://stoke.community/guide/discord` returns `307 → /login` when logged out, and so does `/guide/definitely-not-a-page-xyz`: a shipped page and a nonexistent one are **indistinguishable** externally. Don't report the 307 as evidence either way. The only real checks are the Railway build status for the commit, or opening the URL **signed in**. (Run the nonexistent-route control probe before believing any gated-route status check — 08/02/2026.)
- Join how-to: `apps/web/public/how-to-join-body-doubling.{html,pdf}`. **⚠️ Written for the OPEN-join flow** — if Body Doubling goes closed, update the instant-join steps or pull the link.

