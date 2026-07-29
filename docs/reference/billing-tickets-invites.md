# Billing, Support Tickets & Invite Links

> Split out of the project `CLAUDE.md` on 07/28/2026 so it is read on demand
> instead of injected into every session. This is REFERENCE, not an archive —
> it is current, and new detail about this area belongs here, not back in
> CLAUDE.md. Content below is verbatim from the original file.

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


