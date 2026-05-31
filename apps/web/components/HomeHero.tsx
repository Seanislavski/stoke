'use client'

import { useEffect, useRef, useState } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

export default function HomeHero() {
  const [scrolled, setScrolled] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const suppressRef = useRef(false)

  useEffect(() => {
    document.body.classList.add('hero-mode')

    function handleScroll() {
      if (suppressRef.current) return
      if (window.scrollY > window.innerHeight * 0.55) {
        if (scrolled) return
        document.body.classList.remove('hero-mode')
        setScrolled(true)
      } else {
        if (!scrolled) return
        // Scrolling back up — suppress before layout change to avoid feedback loop
        suppressRef.current = true
        setTimeout(() => { suppressRef.current = false }, 300)
        document.body.classList.add('hero-mode')
        setScrolled(false)
        setCollapsed(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [scrolled])

  // After opacity fade completes, collapse layout — suppress scroll events first
  useEffect(() => {
    if (!scrolled) return
    const t = setTimeout(() => {
      suppressRef.current = true
      setCollapsed(true)
      setTimeout(() => { suppressRef.current = false }, 300)
    }, 500)
    return () => clearTimeout(t)
  }, [scrolled])

  useEffect(() => {
    return () => document.body.classList.remove('hero-mode')
  }, [])

  if (collapsed) return null

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
