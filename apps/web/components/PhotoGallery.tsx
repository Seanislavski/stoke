'use client'

import { useState } from 'react'
import ImageLightbox from '@/components/ImageLightbox'

export default function PhotoGallery({ photos }: { photos: string[] }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  if (!photos.length) return null

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {photos.length === 1 ? (
        <button type="button" onClick={() => setLightboxSrc(photos[0])} className="inline-block mt-2">
          <img
            src={photos[0]}
            alt=""
            className="max-h-72 max-w-full rounded-lg border border-stone-200 object-contain photo-pop"
          />
        </button>
      ) : (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxSrc(url)}
              className="aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
            >
              <img src={url} alt="" className="w-full h-full object-cover photo-pop" />
            </button>
          ))}
        </div>
      )}
    </>
  )
}
