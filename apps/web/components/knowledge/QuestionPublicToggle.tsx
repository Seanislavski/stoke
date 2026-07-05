'use client'

import { useState } from 'react'
import { setQuestionPublic } from '@/app/actions/knowledge'

type Props = {
  questionId: string
  communityId: string
  slug: string
  isPublic: boolean
}

export default function QuestionPublicToggle({ questionId, communityId, slug, isPublic }: Props) {
  const [pub, setPub] = useState(isPublic)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `https://stoke.community/communities/${slug}/questions/${questionId}`

  async function handleToggle(next: boolean) {
    setPub(next)
    setSaving(true)
    const result = await setQuestionPublic(questionId, communityId, slug, next)
    setSaving(false)
    if (result.error) setPub(!next) // revert on failure
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={pub}
          disabled={saving}
          onChange={e => handleToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-orange-500 disabled:opacity-50"
        />
        <span className="text-xs text-stone-600">
          <span className="font-medium text-stone-700">Visible to anyone with the link</span>
          <br />
          Let logged-out visitors read this question. Answers stay members-only — they prompt a sign-up. Off by default; the rest of your Q&amp;A stays private.
          {saving && <span className="ml-1 text-stone-400">Saving…</span>}
        </span>
      </label>

      {pub && (
        <div className="mt-2 flex items-center gap-2 pl-6">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 text-xs px-2 py-1 border border-stone-300 rounded bg-white text-stone-500"
            onFocus={e => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={copyLink}
            className="text-xs font-medium text-orange-600 hover:text-orange-700 whitespace-nowrap"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  )
}
