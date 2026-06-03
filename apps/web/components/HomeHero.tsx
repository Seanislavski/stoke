'use client'

import { useEffect, useRef } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

export default function HomeHero() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('hero-mode')

    function update() {
      const hero = heroRef.current
      if (!hero) return
      const rect = hero.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, 1 - rect.bottom / rect.height))
      hero.style.opacity = `${1 - progress}`
      // Show nav once hero top has scrolled 40% of viewport height past the top
      document.body.classList.toggle('hero-mode', rect.top > -(window.innerHeight * 0.4))
    }

    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('scroll', update)
      document.body.classList.remove('hero-mode')
    }
  }, [])

  return (
    <div
      ref={heroRef}
      className="-mt-6 min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center"
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
  )
}
