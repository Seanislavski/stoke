'use client'

import { useEffect, useRef } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

const FADE_PX = 150

export default function HomeHero() {
  const heroRef   = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('hero-mode')

    // Size the spacer so the page is exactly tall enough to scroll FADE_PX —
    // no body minHeight needed, no collapse, no jump.
    function initSpacer() {
      if (!spacerRef.current) return
      spacerRef.current.style.height = '0'
      const naturalHeight = document.body.scrollHeight
      const needed = window.innerHeight + FADE_PX - naturalHeight
      spacerRef.current.style.height = `${Math.max(FADE_PX, needed)}px`
    }

    function update() {
      if (!heroRef.current) return
      const progress = Math.min(1, window.scrollY / FADE_PX)
      heroRef.current.style.opacity = `${1 - progress}`
      document.body.classList.toggle('hero-mode', progress < 0.95)
    }

    initSpacer()
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', () => { initSpacer(); update() }, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      document.body.classList.remove('hero-mode')
    }
  }, [])

  return (
    <>
      {/* Fixed overlay — fades on scroll, reveals content behind it */}
      <div
        ref={heroRef}
        className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-stone-50 pointer-events-none"
      >
        <div className="hero-wordmark cursor-default pointer-events-auto">
          <StokeWordmark iconSize={80} />
        </div>
        <div className="mt-10 text-stone-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-bounce"
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </div>
      {/* Spacer: sized at init to make the page exactly scrollable enough for the fade */}
      <div ref={spacerRef} />
    </>
  )
}
