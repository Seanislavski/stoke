# Product Spec — Reciprocal Community Platform
*Codename: TBD | Last updated: 05/24/2026*

## Vision

A platform where anyone can build and organize their own reciprocal community. Think LinkedIn meets Meetup — with a calendar, member management, and event tools — but focused on communities where members genuinely give and receive value from each other.

Reciprocal is the philosophy, not a tracked mechanic. No time banking, no point systems. The platform provides the infrastructure; the community provides the exchange.

---

## Core Principles

- **Mobile-first** — base styles for mobile, layered up with `md:`/`lg:` breakpoints
- **Warm** — human and unhurried, not a productivity SaaS tool
- **Spacious** — room to breathe, not information-dense
- **Privacy-respecting** — members are visible only within shared communities; emails never exposed

---

## Account Model

- Single account across all communities (Discord model)
- One profile: name, avatar, bio
- Join multiple communities with the same identity
- **Email required at signup** — unique per account, no duplicates
- Email visible to platform admins always; never exposed to organizers or members
- **Proxied outreach** — organizers can email members through the platform without seeing addresses
- Member opt-in: can choose to share email with their community organizer
- Ban is community-level, not platform-level

---

## Community Setup

Discord-style onboarding — low friction, guided, you're live quickly:

1. Name your community
2. Write a short description
3. Choose a join mode
4. Choose a category (required)
5. Set listing visibility
6. Get your invite link

### Join Modes
*(Set at creation, changeable in settings anytime)*

- **Open** — anyone can find and join
- **Request to join** — member applies, organizer/mod approves
- **Invite-only** — joinable via link or direct invite only

---

## Community Anatomy

### Bulletin Board
- Organizer-curated announcements
- Members can submit posts for consideration
- Submissions require mod approval before publishing

### Gathering Spaces (Text Channels)
- Persistent, always-on text rooms
- Members drop in and converse anytime
- Voice/video: future consideration (v2+)

### Scheduled Events
- Organizer or presenter creates an event with date/time
- Presenter can share their screen
- Event-specific chat sidebar during the event
- Post-event summary for organizers:
  - Attendance list
  - Full chat transcript
  - AI-generated summary (for longer events)

### Resource Library
- Files and links curated by organizers
- Accessible to all community members

---

## Permissions & Moderation

### Permissions System
- Organizer sets roles and permissions
- Moderators manage within those bounds
- Robust, granular — similar to Plish's permission model

### Moderation Toolkit
- **Message deletion** — mods can delete any message; members can delete their own
- **Kick** — remove from community (can rejoin unless banned)
- **Timeout** — temporary restriction
- **Ban** — permanent removal from community
- **Mod action log** — full audit trail
- **Report/flag system** — member-initiated, notifies moderators

---

## Discovery

### Profile Visibility
- Profiles visible only within shared communities
- No public directory of people
- Discovery is community-first, not person-first

### Community Directory
- Organizer chooses: **Listed** (appears in directory) or **Unlisted** (link-only)
- Listed communities searchable by name and description
- **Category** — required, chosen from approved list or proposed (see below)
- **Tags** — deferred to v2

### Category Governance
- Organizer picks from existing approved categories
- Can propose a new category if none fit
- New categories go to platform admins for approval before going live
- Admins can merge near-duplicate categories over time

---

## Tech Stack

- **Frontend:** Next.js + TypeScript
- **Backend:** Node.js / Express
- **Database + Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Deployment:** Railway
- **Repo:** GitHub (private, to be created)
- **Directory:** `C:\Users\Sean\OneDrive\reciprocal-community-platform`

Same stack as Plish — completely separate codebase and infrastructure.

---

## Out of Scope (v1)

- Voice / video channels
- Tags on communities
- Time banking or reciprocity tracking mechanics
- Public people directory
- Mobile native apps

---

## Open Questions

- [ ] What GitHub repo name to use (pending platform name)?
- [ ] Profile visibility: does your profile show your community memberships to other members, or just your name/avatar/bio?
- [ ] Events: who can create them — organizers only, or any member?
- [ ] Resource library: can members contribute, or organizers only?
