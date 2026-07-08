'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { updateCommunityInfo } from '@/app/actions/community'
import CommunityImageCropModal from './CommunityImageCropModal'
import PhotoUploader from '@/components/PhotoUploader'

type Category = { id: string; name: string }
type Community = {
  id: string
  slug: string
  name: string
  description: string | null
  about: string | null
  join_mode: string
  is_listed: boolean
  category_id: string | null
  image_url: string | null
  banner_url: string | null
  photos: string[] | null
}

export default function CommunityInfoForm({
  community,
  categories,
}: {
  community: Community
  categories: Category[]
}) {
  const [imageUrl, setImageUrl]   = useState(community.image_url)
  const [cropFile, setCropFile]   = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [bannerUrl, setBannerUrl]     = useState(community.banner_url)
  const [bannerFile, setBannerFile]   = useState<File | null>(null)
  const [bannerBusy, setBannerBusy]   = useState(false)
  const [photos, setPhotos]       = useState<string[]>(community.photos ?? [])
  const [saving, setSaving]       = useState(false)
  const [message, setMessage]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropFile(file)
    e.target.value = ''
  }

  async function handleCropSave(blob: Blob) {
    setUploading(true)
    setMessage('')
    const supabase = createClient()
    const path = `community-${community.id}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) { setMessage('Upload failed: ' + error.message); setUploading(false); setCropFile(null); return }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`
    await supabase.from('communities').update({ image_url: url }).eq('id', community.id)
    setImageUrl(url)
    setUploading(false)
    setCropFile(null)
    setMessage('Image updated.')
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    e.target.value = ''
  }

  async function handleBannerCropSave(blob: Blob) {
    setBannerBusy(true)
    setMessage('')
    const supabase = createClient()
    const path = `community-banner-${community.id}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) { setMessage('Upload failed: ' + error.message); setBannerBusy(false); setBannerFile(null); return }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`
    await supabase.from('communities').update({ banner_url: url }).eq('id', community.id)
    setBannerUrl(url)
    setBannerBusy(false)
    setBannerFile(null)
    setMessage('Cover image updated.')
  }

  async function removeBanner() {
    setBannerBusy(true)
    const supabase = createClient()
    await supabase.from('communities').update({ banner_url: null }).eq('id', community.id)
    setBannerUrl(null)
    setBannerBusy(false)
    setMessage('Cover image removed.')
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setMessage('')
    formData.set('photos', JSON.stringify(photos))
    const result = await updateCommunityInfo(community.id, community.slug, formData)
    setSaving(false)
    setMessage(result.error ? `Error: ${result.error}` : 'Saved.')
  }

  return (
    <>
    {cropFile && (
      <CommunityImageCropModal
        file={cropFile}
        onSave={handleCropSave}
        onCancel={() => setCropFile(null)}
      />
    )}
    {bannerFile && (
      <CommunityImageCropModal
        file={bannerFile}
        onSave={handleBannerCropSave}
        onCancel={() => setBannerFile(null)}
        aspect={3}
        outputWidth={1500}
        title="Crop cover image"
      />
    )}
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

      {/* Cover image (banner) */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">Cover image</label>
        <div className="w-full aspect-[3/1] rounded-xl bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center mb-2">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm text-stone-300">No cover image yet</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            disabled={bannerBusy}
            className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {bannerBusy ? 'Working…' : bannerUrl ? 'Change cover' : 'Upload cover'}
          </button>
          {bannerUrl && !bannerBusy && (
            <button type="button" onClick={removeBanner} className="text-xs text-stone-400 hover:text-red-600">
              Remove
            </button>
          )}
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
        </div>
        <p className="text-xs text-stone-400 mt-1">Wide image shown across the top of your community page.</p>
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
        <p className="mt-1 text-xs text-stone-400">Short tagline shown in the header and the directory.</p>
      </div>

      <div>
        <label htmlFor="about" className="block text-sm font-medium text-stone-700 mb-1">
          About this community
        </label>
        <textarea
          id="about"
          name="about"
          defaultValue={community.about ?? ''}
          maxLength={5000}
          rows={8}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          placeholder="Tell people what this community is about — its mission, who it's for, how it works, when you meet, any guidelines. Links you paste become clickable."
        />
        <p className="mt-1 text-xs text-stone-400">The full story, shown at the top of your community page. Links become clickable.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">Photo gallery</label>
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          pathPrefix={`community-photos/gallery-${community.id}`}
          multiple
        />
        <p className="mt-1 text-xs text-stone-400">Show off your community — events, people, the vibe. Saved when you click Save changes.</p>
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
    </>
  )
}
