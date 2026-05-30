'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { updateCommunityInfo } from '@/app/actions/community'

type Category = { id: string; name: string }
type Community = {
  id: string
  slug: string
  name: string
  description: string | null
  join_mode: string
  is_listed: boolean
  category_id: string | null
  image_url: string | null
}

export default function CommunityInfoForm({
  community,
  categories,
}: {
  community: Community
  categories: Category[]
}) {
  const [imageUrl, setImageUrl] = useState(community.image_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage('')
    const supabase = createClient()
    const path = `community-${community.id}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) { setMessage('Upload failed: ' + error.message); setUploading(false); return }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`
    await supabase.from('communities').update({ image_url: url }).eq('id', community.id)
    setImageUrl(url)
    setUploading(false)
    setMessage('Image updated.')
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setMessage('')
    const result = await updateCommunityInfo(community.id, community.slug, formData)
    setSaving(false)
    setMessage(result.error ? `Error: ${result.error}` : 'Saved.')
  }

  return (
    <form action={handleSubmit} className="space-y-5 max-w-lg">

      {/* Community image */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">Community photo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center shrink-0">
            {imageUrl ? (
              <Image src={imageUrl} alt="Community" width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-stone-300">🏘</span>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : imageUrl ? 'Change photo' : 'Upload photo'}
            </button>
            <p className="text-xs text-stone-400 mt-1">JPG, PNG or GIF</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
          Community name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={community.name}
          maxLength={80}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={community.description ?? ''}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
        />
      </div>

      <div>
        <label htmlFor="join_mode" className="block text-sm font-medium text-stone-700 mb-1">
          Who can join?
        </label>
        <select
          id="join_mode"
          name="join_mode"
          defaultValue={community.join_mode}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
        >
          <option value="open">Open — anyone can join</option>
          <option value="request">Request to join — mods approve</option>
          <option value="invite_only">Invite only</option>
        </select>
      </div>

      <div>
        <label htmlFor="category_id" className="block text-sm font-medium text-stone-700 mb-1">
          Category
        </label>
        <select
          id="category_id"
          name="category_id"
          defaultValue={community.category_id ?? ''}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
        >
          <option value="">No category</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="is_listed"
          name="is_listed"
          type="checkbox"
          defaultChecked={community.is_listed}
          className="w-4 h-4 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
        />
        <label htmlFor="is_listed" className="text-sm text-stone-700">
          List this community in the public directory
        </label>
      </div>

      {message && (
        <p className={`text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
