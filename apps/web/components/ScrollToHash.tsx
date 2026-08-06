'use client'

import { useEffect } from 'react'

/**
 * Scrolls to the #hash on first load.
 *
 * The browser attempts its own hash jump before the server-rendered content
 * has streamed in, finds nothing, and gives up — so a link like
 * /settings#audit-log lands at the top of the page. In-page clicks are fine
 * because the target already exists by then; only arriving with a hash breaks.
 *
 * Retries briefly rather than scrolling once, since the target may appear a
 * frame or two after hydration.
 */
export default function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return

    let cancelled = false
    let tries = 0

    function attempt() {
      if (cancelled) return
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      // ~2s of retries, then stop. A missing id is not worth chasing further.
      if (tries++ < 40) setTimeout(attempt, 50)
    }

    attempt()
    return () => { cancelled = true }
  }, [])

  return null
}
