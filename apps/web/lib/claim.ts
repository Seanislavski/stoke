// Where a claimed capture actually lives, by what it was filed as.
//
// Shared by the claim landing page (server) and ClaimCapture (client) so the
// "See it on Stoke" link can't disagree between the already-claimed branch and
// the just-claimed one. ⚠️ A capture filed as a TESTIMONIAL has no question_id,
// and the old fallback sent it to `?tab=qa` — a tab its content isn't on.
export function captureDestination(opts: {
  slug?: string | null
  questionId?: string | null
  reviewId?: string | null
  // ⚠️ Needed because the claim link is sent at CONSENT time, so the common case
  // is claiming BEFORE a mod has filed anything — neither id is set yet, and
  // without this the fallback would send a testimonial to the Q&A tab.
  isTestimonial?: boolean
}): string {
  const { slug, questionId, reviewId, isTestimonial } = opts
  if (!slug) return '/home'
  if (questionId) return `/communities/${slug}/questions/${questionId}`
  if (reviewId || isTestimonial) return `/communities/${slug}?tab=reviews`
  return `/communities/${slug}?tab=qa`
}

// A testimonial and a library post are different promises: one is a quote that
// may be shown publicly, the other an entry in a shared Q&A shelf. The claim
// page speaks in whichever language matches.
export const claimCopy = (isTestimonial: boolean) =>
  isTestimonial
    ? {
        icon: '💬',
        heading: 'Claim your words',
        sub: (community: string) => `Shared as a testimonial for ${community}, with your permission.`,
        explain:
          'Claiming credits you as the author here on Stoke — your profile replaces the “shared on Discord” credit.',
        done: 'Credited to you.',
        doneSub: 'This quote is linked to your profile.',
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
        seeIt: 'See it on Stoke →',
      }
