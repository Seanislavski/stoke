'use client'

import { useActionState } from 'react'
import { createCommunity } from '@/app/actions/communities'
import Link from 'next/link'

type Category = { id: string; name: string }

const JOIN_MODES = [
  { value: 'open', label: 'Open', description: 'Anyone can find and join' },
  { value: 'request', label: 'Request to join', description: 'Members apply, you approve' },
  { value: 'invite_only', label: 'Invite only', description: 'Joinable via link or direct invite' },
]

export default function CreateCommunityForm({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return await createCommunity(formData)
    },
    null
  )

  return (
    <form action={action} className="space-y-6">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
          Community name <span className="text-orange-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. Seattle Repair Café"
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700 mb-1">
          Short description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={300}
          placeholder="What is this community about? Who is it for?"
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category_id" className="block text-sm font-medium text-stone-700 mb-1">
          Category <span className="text-orange-500">*</span>
        </label>
        <select
          id="category_id"
          name="category_id"
          required
          defaultValue=""
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
        >
          <option value="" disabled>Select a category…</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Join mode */}
      <div>
        <p className="block text-sm font-medium text-stone-700 mb-2">
          Who can join? <span className="text-orange-500">*</span>
        </p>
        <div className="space-y-2">
          {JOIN_MODES.map(mode => (
            <label key={mode.value} className="flex items-start gap-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:border-orange-300 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
              <input
                type="radio"
                name="join_mode"
                value={mode.value}
                defaultChecked={mode.value === 'open'}
                className="mt-0.5 accent-orange-500"
              />
              <div>
                <div className="text-sm font-medium text-stone-800">{mode.label}</div>
                <div className="text-xs text-stone-500">{mode.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div>
        <p className="block text-sm font-medium text-stone-700 mb-2">Visibility</p>
        <div className="space-y-2">
          {[
            { value: 'true', label: 'Listed', description: 'Appears in the community directory' },
            { value: 'false', label: 'Unlisted', description: 'Only joinable via invite link' },
          ].map(opt => (
            <label key={opt.value} className="flex items-start gap-3 p-3 border border-stone-200 rounded-lg cursor-pointer hover:border-orange-300 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50">
              <input
                type="radio"
                name="is_listed"
                value={opt.value}
                defaultChecked={opt.value === 'true'}
                className="mt-0.5 accent-orange-500"
              />
              <div>
                <div className="text-sm font-medium text-stone-800">{opt.label}</div>
                <div className="text-xs text-stone-500">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-2.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          {pending ? 'Creating…' : 'Create community'}
        </button>
        <Link
          href="/home"
          className="px-4 py-2.5 text-stone-600 hover:text-stone-900 font-medium text-sm flex items-center"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
