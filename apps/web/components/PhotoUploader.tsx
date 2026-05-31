'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PhotoUploader({
  photos,
  onChange,
  pathPrefix,
  multiple = true,
}: {
  photos: string[]
  onChange: (photos: string[]) => void
  pathPrefix: string
  multiple?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    const urls: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
        urls.push(publicUrl)
      }
    }
    setUploading(false)
    e.target.value = ''
    onChange(multiple ? [...photos, ...urls] : urls.slice(0, 1))
  }

  function addUrl() {
    const url = urlInput.trim()
    if (!url) return
    onChange(multiple ? [...photos, url] : [url])
    setUrlInput('')
    setShowUrlInput(false)
  }

  function removePhoto(i: number) {
    onChange(photos.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative w-16 h-16 flex-shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-stone-200" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500 transition-colors leading-none"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {(multiple || photos.length === 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple={multiple}
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-orange-600 border border-stone-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            )}
            {uploading ? 'Uploading…' : multiple ? 'Add photos' : 'Upload photo'}
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(v => !v)}
            className="text-xs text-stone-400 hover:text-stone-600 underline"
          >
            or paste URL
          </button>
        </div>
      )}

      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }}
            placeholder="https://..."
            className="flex-1 px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addUrl}
            className="px-3 py-1.5 text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors"
          >Add</button>
        </div>
      )}
    </div>
  )
}
