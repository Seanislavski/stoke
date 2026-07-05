'use client'

import { useState } from 'react'
import { setQuestionPublic } from '@/app/actions/knowledge'

type Props = {
  questionId: string
  communityId: string
  slug: string
  isPublic: boolean
  /** Asker's stated preference at posting time; null if none was recorded. */
  askerPref: boolean | null
}

export default function QuestionPublicToggle({ questionId, communityId, slug, isPublic, askerPref }: Props) {
  const [pub, setPub] = useState(isPublic)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = `https://stoke.community/communities/${slug}/questions/${questionId}`

  async function handleToggle(next: boolean) {
    // If the asker recorded a preference and this change goes against it, confirm first.
    if (askerPref !== null && next !== askerPref) {
      const ok = window.confirm(
        'Are you sure? This goes against what the asker indicated at the time of initial posting.'
      )
      if (!ok) return // leave the checkbox as-is
    }
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

      {askerPref !== null && (
        <p className={`mt-2 pl-6 text-xs ${askerPref ? 'text-stone-500' : 'text-amber-700'}`}>
          {askerPref
            ? '✔ The asker is okay with this being shared publicly.'
            : '⚠ The asker preferred to keep this private — you’ll be asked to confirm before turning it on.'}
        </p>
      )}

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
