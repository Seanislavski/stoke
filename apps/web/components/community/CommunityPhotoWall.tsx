'use client'

import { useState } from 'react'
import Link from 'next/link'
import ImageLightbox from '@/components/ImageLightbox'

// Organizer/moderator "all photos" grid: every inline image across the
// community, each linking back to where it was posted. Clicking the image
// opens the lightbox; the corner label jumps to the source.
type WallPhoto = { url: string; href: string; source: string }

export default function CommunityPhotoWall({ photos }: { photos: WallPhoto[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null)
  if (!photos.length) return null

  return (
    <>
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
            <button
              type="button"
              onClick={() => setLightbox(p.url)}
              className="absolute inset-0 w-full h-full"
              aria-label="View photo"
            >
              <img src={p.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            </button>
            <Link
              href={p.href}
              className="absolute bottom-0 inset-x-0 px-2 py-1 text-[11px] font-medium text-white bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {p.source} ↗
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}
