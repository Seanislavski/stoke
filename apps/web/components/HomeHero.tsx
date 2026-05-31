'use client'

import { useEffect, useRef } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

const HEADER_H = 56   // matches 3.5rem at 16px base
const FADE_PX  = 250  // px of scroll to complete the fade

export default function HomeHero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('hero-mode')

    function update() {
      if (!heroRef.current) return
      const progress = Math.min(1, Math.max(0, (window.scrollY - HEADER_H) / FADE_PX))
      heroRef.current.style.opacity        = `${1 - progress}`
      heroRef.current.style.pointerEvents  = progress > 0.9 ? 'none' : ''
      document.body.classList.toggle('hero-mode', progress < 0.95)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.body.classList.remove('hero-mode')
    }
  }, [])

  return (
    // Spacer: keeps page height stable and provides scroll room for the fade
    <div className="-mt-6" style={{ height: `calc(100svh - 3.5rem + ${FADE_PX}px)` }}>
      {/* Hero sticks at top and fades as the spacer scrolls behind it */}
      <div
        ref={heroRef}
        className="sticky top-0 flex flex-col items-center justify-center"
        style={{ height: 'calc(100svh - 3.5rem)' }}
      >
        <div className="hero-wordmark cursor-default">
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
    </div>
  )
}
