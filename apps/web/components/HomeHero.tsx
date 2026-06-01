'use client'

import { useEffect, useRef } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

const FADE_PX = 150

export default function HomeHero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('hero-mode')
    // Guarantee the page is tall enough to complete the fade
    document.body.style.minHeight = `calc(100svh + ${FADE_PX}px)`

    function update() {
      if (!heroRef.current) return
      const progress = Math.min(1, window.scrollY / FADE_PX)
      heroRef.current.style.opacity = `${1 - progress}`
      document.body.classList.toggle('hero-mode', progress < 0.95)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.body.classList.remove('hero-mode')
      document.body.style.minHeight = ''
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
      {/* Spacer: scroll distance = fade distance, so content is at top when hero finishes fading */}
      <div style={{ height: `${FADE_PX}px` }} />
    </>
  )
}
