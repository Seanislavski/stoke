'use client'

import { useEffect } from 'react'
import { setDetectedTimezone } from '@/app/actions/profile'

// Seeds the user's profile timezone from the browser on first visit. The server
// action is a no-op once timezone_detected is true, so this never overrides a
// zone the user has chosen manually — it just fills in a sensible default.
export default function TimezoneDetector({ alreadyDetected }: { alreadyDetected: boolean }) {
  useEffect(() => {
    if (alreadyDetected) return
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) void setDetectedTimezone(tz)
    } catch {
      // Intl unavailable — leave the default in place.
    }
  }, [alreadyDetected])

  return null
}
