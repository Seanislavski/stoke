# Stoke Community — Claude Code Project

## Project
- **Name:** Stoke Community
- **Domain:** stoke.community
- **Directory:** `C:\Users\Sean\OneDrive\reciprocal-community-platform`
- **GitHub:** `github.com/Seanislavski/stoke-community` (private, not yet created)
- **Status:** Scaffold complete, pre-Supabase setup

## What It Is
A platform for building reciprocal communities — anyone can create and organize a community where members genuinely give and receive value from each other. Think LinkedIn meets Meetup, focused on mutual exchange. No time banking or point systems; the platform provides infrastructure, the community provides the exchange.

## Stack
- **Frontend:** Next.js + TypeScript + Tailwind (`apps/web`)
- **Backend:** Node.js / Express + TypeScript (`apps/server`)
- **Database + Auth:** Supabase (PostgreSQL + Auth + Storage) — not yet created
- **Deployment:** Railway — not yet set up
- Same stack as Plish, completely separate codebase and infrastructure

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
- Ban is community-level, not platform-level
- Email never exposed to organizers/members — proxied outreach only

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

## Git
- No Co-Authored-By lines in commits
- Use PowerShell with semicolons not `&&`
