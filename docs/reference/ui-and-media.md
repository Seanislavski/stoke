# UI & Media — photos, embeds, hero, navigation, legacy resources

> Split out of the project `CLAUDE.md` on 07/28/2026 so it is read on demand
> instead of injected into every session. This is REFERENCE, not an archive —
> it is current, and new detail about this area belongs here, not back in
> CLAUDE.md. Content below is verbatim from the original file.

## Resources (LEGACY — replaced by Q&A 06/11/2026)
- `resources` table still exists; `resources.ts` actions + `SubmitResourceForm`/`ResourceModActions` components left in place but ORPHANED (no longer rendered). Resources tab was replaced by the Q&A Knowledge Base.
- `resources` table: community_id, submitted_by, title, url, description, status (pending/published/rejected)


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


## HomeHero Scroll (home page)
- `components/HomeHero.tsx` — hero on `/home` for logged-in users, in **normal document flow** (NOT fixed/sticky), fading as it scrolls off via `getBoundingClientRect`. Opacity = `1 - rect.bottom / rect.height` (viewport-relative, so page length doesn't matter). `hero-mode` body class hides the header until the user scrolls 15% of viewport past the hero top (`rect.top > -(window.innerHeight * 0.15)`, ~135px typical). `globals.css` sets `html, body { background-color: #fafaf9 }` to kill the dark-mode black bar.
- **Scroll spacer:** `<div id="hero-spacer" />` at the bottom of both home paths, height set to `max(0, heroHeight - (scrollHeight - viewportHeight))` — exactly the scroll room needed, no excess whitespace.
- **⚠️ No `dangerouslySetInnerHTML` script** — React 19 / Next.js 16 don't execute inline scripts in components; the `hero-mode` class is added in `useEffect` on mount.
- **⚠️ Lessons, all learned the hard way:** fixed-overlay hero = inverted UX (content appears to come first); in-flow = correct. `scrollY / heroHeight` breaks when the page can't scroll the hero fully off — use `getBoundingClientRect().top`. NEVER guard on `hero.offsetHeight === 0` (pre-layout it exits early and hero-mode never toggles). `min-h-screen` on the content div creates dead whitespace when content is short — use the JS spacer. `100svh` differs between Chrome and Firefox — use `100vh` for fullscreen heroes.

## Profile Back Navigation (07/01/2026 — `8df1e1b`)
- **`apps/web/components/BackButton.tsx`** (client): "← Back" with an inline SVG arrow (**no lucide in this repo** — inline SVGs throughout). Calls `router.back()` when `window.history.length > 1` (returns to the exact origin — members list / Q&A / chat / audit log / reviews), else `router.push(fallback)` (default `/home`) for deep links with no in-app history. Prop: `fallback?: string`. Rendered atop `app/(app)/profile/[username]/page.tsx` as the client island in a server component. Profile links are clicked from 11 files, so "back to origin" beats any hardcoded destination.
- **⚠️ This is where the push policy changed:** now that Stoke is LIVE, commit and push are separate steps — **confirm before the push that triggers a prod deploy**, rather than following the global "always push after commit" rule.

