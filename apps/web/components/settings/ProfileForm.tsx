'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/app/actions/profile'
import { COMMON_TIMEZONES } from '@/lib/eventTime'

type Profile = {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  show_memberships: boolean
  timezone: string
  discord_username: string | null
  show_discord: boolean
}

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  // Tracked in state so the visibility checkbox can disable itself while the
  // handle is empty — an opt-in to show nothing is a confusing control.
  const [discord, setDiscord] = useState(profile.discord_username ?? '')
  const fileRef = useRef<HTMLInputElement>(null)

  // Ensure the user's current zone is selectable even if it's not in the curated list.
  const tzOptions = COMMON_TIMEZONES.some(t => t.value === profile.timezone)
    ? COMMON_TIMEZONES
    : [{ value: profile.timezone, label: profile.timezone }, ...COMMON_TIMEZONES]

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage('')

    const supabase = createClient()
    const path = `${profile.id}/avatar`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (error) {
      setMessage('Upload failed: ' + error.message)
      setUploading(false)
      return
    }

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`

    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
    setAvatarUrl(url)
    setUploading(false)
    setMessage('Avatar updated.')
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setMessage('')
    const result = await updateProfile(formData)
    setSaving(false)
    setMessage(result.error ? `Error: ${result.error}` : 'Profile saved.')
  }

  return (
    <div className="max-w-lg space-y-8">
      {/* Avatar */}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-3">Photo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-stone-200 overflow-hidden flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-400 text-2xl font-semibold">
                {(profile.display_name ?? profile.username)[0].toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <p className="mt-1 text-xs text-stone-400">JPG, PNG or GIF. Max 5MB.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>
      </div>

      {/* Profile fields */}
      <form action={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Username</label>
          <p className="px-3 py-2 bg-stone-100 rounded-lg text-stone-500 text-sm">
            @{profile.username}
          </p>
          <p className="mt-1 text-xs text-stone-400">Username cannot be changed.</p>
        </div>

        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-stone-700 mb-1">
            Display name
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            defaultValue={profile.display_name ?? ''}
            maxLength={50}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-stone-700 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={profile.bio ?? ''}
            maxLength={300}
            rows={4}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
          />
          <p className="mt-1 text-xs text-stone-400">Max 300 characters.</p>
        </div>

        <div>
          <label htmlFor="discord_username" className="block text-sm font-medium text-stone-700 mb-1">
            Discord username
          </label>
          <input
            id="discord_username"
            name="discord_username"
            type="text"
            value={discord}
            onChange={e => setDiscord(e.target.value)}
            placeholder="sean.baldwin"
            maxLength={37}
            autoComplete="off"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-stone-400">
            Optional. Just the username — no @ and no link.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <input
              id="show_discord"
              name="show_discord"
              type="checkbox"
              defaultChecked={profile.show_discord}
              disabled={!discord.trim()}
              className="w-4 h-4 rounded border-stone-300 text-orange-500 focus:ring-orange-400 disabled:opacity-40"
            />
            <label
              htmlFor="show_discord"
              className={`text-sm ${discord.trim() ? 'text-stone-700' : 'text-stone-400'}`}
            >
              Show my Discord username on my profile
            </label>
          </div>
          <p className="mt-1 text-xs text-stone-400">
            Off by default. Communities that use Discord can also show it beside your name in their
            member list.
          </p>
        </div>

        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-stone-700 mb-1">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={profile.timezone}
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          >
            {tzOptions.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-400">
            Event times are shown in your timezone. We set this automatically from your browser — change it here if it&apos;s wrong.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="show_memberships"
            name="show_memberships"
            type="checkbox"
            defaultChecked={profile.show_memberships}
            className="w-4 h-4 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
          />
          <label htmlFor="show_memberships" className="text-sm text-stone-700">
            Show my community memberships on my public profile
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
    </div>
  )
}
