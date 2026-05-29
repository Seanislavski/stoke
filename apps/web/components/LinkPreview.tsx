'use client'

import { useEffect, useState } from 'react'
import { isImageUrl, getYouTubeId } from '@/lib/embeds'

type OGData = {
  title: string | null
  description: string | null
  image: string | null
  url: string
  domain: string
}

function ImageEmbed({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
      <img
        src={url}
        alt=""
        className="max-h-64 max-w-sm rounded-lg border border-stone-200 object-cover"
      />
    </a>
  )
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-stone-200 max-w-sm aspect-video">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  )
}

function OGCard({ data }: { data: OGData }) {
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex gap-0 border border-stone-200 rounded-lg overflow-hidden hover:bg-stone-50 transition-colors max-w-sm block"
    >
      {data.image && (
        <img
          src={data.image}
          alt=""
          className="w-20 h-20 object-cover shrink-0"
        />
      )}
      <div className="py-2 px-3 min-w-0 flex flex-col justify-center">
        {data.title && (
          <p className="text-sm font-medium text-stone-800 line-clamp-1">{data.title}</p>
        )}
        {data.description && (
          <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{data.description}</p>
        )}
        <p className="text-xs text-stone-400 mt-1">{data.domain}</p>
      </div>
    </a>
  )
}

function OGLoader({ url }: { url: string }) {
  const [data, setData] = useState<OGData | null>(null)

  useEffect(() => {
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setData(d) })
      .catch(() => {})
  }, [url])

  if (!data) return null
  return <OGCard data={data} />
}

export default function LinkPreview({ url }: { url: string }) {
  const ytId = getYouTubeId(url)
  if (ytId) return <YouTubeEmbed videoId={ytId} />
  if (isImageUrl(url)) return <ImageEmbed url={url} />
  return <OGLoader url={url} />
}
