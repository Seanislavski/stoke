// Who a story or reply is shown as. The ONE place anonymity is decided, so the
// list, the detail page and the review queue can't disagree. Server-only use:
// callers render the returned label and must not ship the author's profile to
// the client when `link` is null.

type Profile = { username: string; display_name: string | null } | null

export type Byline = { label: string; link: string | null }

function nameOf(p: Profile) {
  return p ? (p.display_name ?? p.username) : 'A member'
}

/** How the story's author appears to this viewer. */
export function storyByline(
  story: { is_anonymous: boolean; author_id: string },
  author: Profile,
  viewer: { id: string; isMod: boolean },
): Byline {
  if (!story.is_anonymous) {
    return { label: nameOf(author), link: author ? `/profile/${author.username}` : null }
  }
  if (viewer.id === story.author_id) return { label: 'Anonymous (only mods can see it was you)', link: null }
  if (viewer.isMod) return { label: `Anonymous · mods only: ${nameOf(author)}`, link: null }
  return { label: 'Anonymous member', link: null }
}

/**
 * How a reply's author appears. On an anonymous story the story's author must
 * stay anonymous in the replies too, or replying would unmask them.
 */
export function replyByline(
  reply: { author_id: string },
  author: Profile,
  story: { is_anonymous: boolean; author_id: string },
  viewer: { id: string; isMod: boolean },
): Byline {
  const byStoryAuthor = reply.author_id === story.author_id
  if (story.is_anonymous && byStoryAuthor) {
    if (viewer.id === reply.author_id) return { label: 'You (story author)', link: null }
    if (viewer.isMod) return { label: `Story author · mods only: ${nameOf(author)}`, link: null }
    return { label: 'Story author', link: null }
  }
  const label = byStoryAuthor ? `${nameOf(author)} (story author)` : nameOf(author)
  return { label, link: author ? `/profile/${author.username}` : null }
}
