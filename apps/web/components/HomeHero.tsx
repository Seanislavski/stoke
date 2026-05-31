'use client'

import { useEffect, useRef } from 'react'
import StokeWordmark from '@/components/StokeWordmark'

export default function HomeHero() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('hero-mode')

    function update() {
      const wrapper = wrapperRef.current
      const inner = innerRef.current
      if (!wrapper || !inner) return

      const heroHeight = window.innerHeight - 56 // header ~3.5rem
      const progress = Math.min(1, window.scrollY / (window.innerHeight * 0.5))

      wrapper.style.height = `${heroHeight * (1 - progress)}px`
      inner.style.opacity = `${1 - progress}`
      document.body.classList.toggle('hero-mode', progress < 1)
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
    <div ref={wrapperRef} className="-mt-6 overflow-hidden" style={{ height: 'calc(100svh - 3.5rem)' }}>
      <div ref={innerRef} className="h-full flex flex-col items-center justify-center pointer-events-none">
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
    </div>
  )
}
