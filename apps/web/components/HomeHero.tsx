'use client'

import { useEffect, useState } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

export default function HomeHero() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    document.body.classList.add('hero-mode')

    function handleScroll() {
      if (window.scrollY > window.innerHeight * 0.55) {
        document.body.classList.remove('hero-mode')
        setScrolled(true)
      } else {
        document.body.classList.add('hero-mode')
        setScrolled(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.body.classList.remove('hero-mode')
    }
  }, [])

  return (
    <div
      style={{ height: scrolled ? 0 : 'calc(100svh - 3.5rem)' }}
      className={`-mt-6 flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ${
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
