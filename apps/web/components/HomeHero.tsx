'use client'

import { useEffect, useRef, useState } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

export default function HomeHero() {
  const [scrolled, setScrolled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const suppressRef = useRef(false)
  const scrolledRef = useRef(false)

  // hero-mode on mount only — scroll handler manages add/remove from here on
  useEffect(() => {
    document.body.classList.add('hero-mode')
    return () => document.body.classList.remove('hero-mode')
  }, [])

  // Scroll listener — empty deps, uses refs to avoid stale closures
  useEffect(() => {
    function handleScroll() {
      if (suppressRef.current) return
      const threshold = window.innerHeight * 0.55
      if (window.scrollY > threshold) {
        if (scrolledRef.current) return
        scrolledRef.current = true
        document.body.classList.remove('hero-mode')
        setScrolled(true)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // After opacity fade, collapse layout space
  useEffect(() => {
    if (!scrolled) return
    const t = setTimeout(() => {
      suppressRef.current = true
      setCollapsed(true)
      window.scrollTo({ top: 0, behavior: 'instant' })
      setTimeout(() => { suppressRef.current = false }, 300)
    }, 500)
    return () => clearTimeout(t)
  }, [scrolled])

  // Return empty div (not null) so component stays mounted and listeners stay active
  if (collapsed) return <div />

  return (
    <div
      className={`-mt-6 min-h-[calc(100svh-3.5rem)] flex flex-col items-center justify-center transition-opacity duration-500 ${
        scrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
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
