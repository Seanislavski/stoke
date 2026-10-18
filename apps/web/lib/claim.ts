// Where a claimed capture actually lives, by what it was filed as.
//
// Shared by the claim landing page (server) and ClaimCapture (client) so the
// "See it on Stoke" link can't disagree between the already-claimed branch and
// the just-claimed one. ⚠️ A capture filed as a TESTIMONIAL or a STORY has no
// question_id, and the old fallback sent it to `?tab=qa` — a tab its content isn't on.
export type CaptureKind = 'qa' | 'testimonial' | 'story'

export function captureDestination(opts: {
  slug?: string | null
  questionId?: string | null
  reviewId?: string | null
  storyId?: string | null
  // ⚠️ Needed because the claim link is sent at CONSENT time, so the common case
  // is claiming BEFORE a mod has filed anything — no id is set yet, and without
  // this the fallback would send a testimonial or a story to the Q&A tab.
  kind?: CaptureKind
}): string {
  const { slug, questionId, reviewId, storyId, kind } = opts
  if (!slug) return '/home'
  if (questionId) return `/communities/${slug}/questions/${questionId}`
  if (storyId) return `/communities/${slug}/stories/${storyId}`
  if (reviewId || kind === 'testimonial') return `/communities/${slug}?tab=reviews`
  if (kind === 'story') return `/communities/${slug}?tab=stories`
  return `/communities/${slug}?tab=qa`
}

// A testimonial, a story and a library post are different promises: a quote that
// may be shown publicly, a personal story shown to members, an entry in a shared
// Q&A shelf. The claim page speaks in whichever language matches.
export const claimCopy = (kind: CaptureKind) =>
  kind === 'testimonial'
    ? {
        icon: '💬',
        heading: 'Claim your words',
        sub: (community: string) => `Shared as a testimonial for ${community}, with your permission.`,
        explain:
          'Claiming credits you as the author here on Stoke — your profile replaces the “shared on Discord” credit.',
        done: 'Credited to you.',
        doneSub: 'This quote is linked to your profile.',
        noun: 'quote',
        seeIt: 'See it on Stoke →',
      }
    : kind === 'story'
    ? {
        icon: '📖',
        heading: 'Claim your story',
        sub: (community: string) => `Shared in ${community}’s Stories by Silas!, with your permission.`,
        explain:
          'Claiming makes you the author here on Stoke — you’ll hear about replies and see how many people said “me too”. If you shared it anonymously, it stays anonymous.',
        done: 'It’s yours now.',
        doneSub: 'The story is linked to your profile.',
        noun: 'story',
        seeIt: 'See it on Stoke →',
      }
    : {
        icon: '📚',
        heading: 'Claim your post',
        sub: (community: string) => `Archived in ${community}’s library by Silas!, with your permission.`,
        explain:
          'Claiming credits you as the original author — your name here on Stoke replaces the “shared on Discord” credit.',
        done: 'It’s yours now.',
        doneSub: 'The post is credited to your profile.',
        noun: 'post',
        seeIt: 'See it on Stoke →',
      }
