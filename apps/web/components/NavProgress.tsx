'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// A thin orange bar across the top of the window while a page is loading.
//
// The App Router keeps the old page on screen until the new one has rendered
// on the server, with no sign anything is happening — on a slow page a click
// looks dead (found on /guide, 09/21/2026). This starts on any internal link
// click and finishes when the URL actually changes.
//
// Waits SHOW_DELAY_MS before appearing, so fast pages don't flash a bar.

const SHOW_DELAY_MS = 120
const GIVE_UP_MS = 15000

export default function NavProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`

  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const loading = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearAll() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (trickle.current) clearInterval(trickle.current)
    trickle.current = null
  }

  function finish() {
    if (!loading.current) return
    loading.current = false
    clearAll()
    setWidth(100)
    timers.current.push(setTimeout(() => setVisible(false), 200))
    timers.current.push(setTimeout(() => setWidth(0), 450))
  }

  // The URL changed: the new page is here.
  useEffect(() => {
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  useEffect(() => {
    function start() {
      clearAll()
      loading.current = true
      timers.current.push(setTimeout(() => {
        if (!loading.current) return
        setVisible(true)
        setWidth(15)
        trickle.current = setInterval(() => {
          // Creep towards 90% and never reach it; finish() does the rest.
          setWidth(w => w + (90 - w) * 0.08)
        }, 200)
      }, SHOW_DELAY_MS))
      timers.current.push(setTimeout(finish, GIVE_UP_MS))
    }

    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || !a.href || a.hasAttribute('download')) return
      if (a.target && a.target !== '_self') return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page (or only the #hash differs): nothing will load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start()
    }

    // Capture phase, so this runs before next/link handles the click.
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      clearAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-hidden
      className="fixed left-0 top-0 z-[100] h-[3px] bg-orange-500 pointer-events-none"
      style={{
        width: `${width}%`,
        opacity: visible ? 1 : 0,
        transition: 'width 200ms ease-out, opacity 250ms ease',
        boxShadow: '0 0 8px rgba(249, 115, 22, 0.6)',
      }}
    />
  )
}
