'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addDraft, updateDraft, deleteItem, publishItem } from '@/app/actions/qotw'
import { qotwLabel } from '@/lib/qotw'

export type DraftItem = {
  id: string
  title: string
  body: string | null
  planned_for: string | null
}

export type PublishedItem = {
  id: string
  number: number
  title: string
  question_id: string | null
  published_at: string | null
}

type Props = {
  communityId: string
  slug: string
  bank: DraftItem[]
  published: PublishedItem[]
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function QotwManager({ communityId, slug, bank, published }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copiedNum, setCopiedNum] = useState<number | null>(null)

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res && 'error' in res && res.error) setError(res.error)
      else router.refresh()
    })
  }

  function copyLink(number: number) {
    const url = `${window.location.origin}/communities/${slug}/qotw/${number}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedNum(number)
      setTimeout(() => setCopiedNum(n => (n === number ? null : n)), 1500)
    })
  }

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Add to bank */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-1">Add a question to the bank</h2>
        <p className="text-sm text-stone-500 mb-3">Stockpile questions now; publish one whenever you&apos;re ready.</p>
        <form
          action={(fd) => run(() => addDraft(communityId, slug, fd).then(r => { if (!r.error) (document.getElementById('qotw-add') as HTMLFormElement)?.reset() ; return r }))}
          id="qotw-add"
          className="space-y-3 bg-white border border-stone-200 rounded-xl p-4"
        >
          <input
            name="title" required placeholder="The question…"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <textarea
            name="body" rows={2} placeholder="Optional context or prompt…"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-stone-500 flex items-center gap-2">
              Auto-publish date (optional)
              <input name="planned_for" type="date" className="px-2 py-1 border border-stone-300 rounded text-xs text-stone-900" />
            </label>
            <button
              type="submit" disabled={pending}
              className="ml-auto text-sm bg-stone-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-stone-900 disabled:opacity-50"
            >
              Add to bank
            </button>
          </div>
          <p className="text-xs text-stone-400">
            Set a date to auto-publish this question that day. Leave it blank and it joins the weekly auto-rotation (the next
            undated draft publishes once ~7 days have passed since the last one). You can always publish any draft manually below.
          </p>
        </form>
      </section>

      {/* Bank */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-3">Bank <span className="text-stone-400 font-normal">({bank.length})</span></h2>
        {bank.length === 0 ? (
          <p className="text-sm text-stone-400">No draft questions yet.</p>
        ) : (
          <div className="space-y-3">
            {bank.map(item => (
              <div key={item.id} className="bg-white border border-stone-200 rounded-xl p-4">
                {editingId === item.id ? (
                  <form
                    action={(fd) => run(() => updateDraft(item.id, communityId, slug, fd).then(r => { if (!r.error) setEditingId(null); return r }))}
                    className="space-y-2"
                  >
                    <input name="title" required defaultValue={item.title}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900" />
                    <textarea name="body" rows={2} defaultValue={item.body ?? ''}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900" />
                    <div className="flex items-center gap-2">
                      <input name="planned_for" type="date" defaultValue={item.planned_for ?? ''}
                        className="px-2 py-1 border border-stone-300 rounded text-xs text-stone-900" />
                      <button type="submit" disabled={pending} className="ml-auto text-xs bg-stone-800 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-stone-900 disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs text-stone-500 px-2 py-1.5">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="font-medium text-stone-900 text-sm">{item.title}</p>
                    {item.body && <p className="text-stone-500 text-sm mt-1 whitespace-pre-wrap">{item.body}</p>}
                    <div className="flex items-center gap-3 flex-wrap mt-3">
                      {item.planned_for && (
                        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded">⏱ Auto-publishes {fmtDate(item.planned_for)}</span>
                      )}
                      <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setEditingId(item.id)} disabled={pending}
                          className="text-xs text-stone-500 hover:text-stone-800 px-2 py-1">Edit</button>
                        <button
                          onClick={() => { if (confirm('Delete this draft?')) run(() => deleteItem(item.id, communityId, slug)) }}
                          disabled={pending}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Delete</button>
                        <button
                          onClick={() => run(() => publishItem(item.id, communityId, slug, true))}
                          disabled={pending}
                          title="Publish as a throwaway QotW-t preview — never uses a real number"
                          className="text-xs border border-stone-300 text-stone-600 px-3 py-1.5 rounded-lg font-medium hover:bg-stone-50 disabled:opacity-50">
                          Preview as test
                        </button>
                        <button
                          onClick={() => run(() => publishItem(item.id, communityId, slug))}
                          disabled={pending}
                          className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50">
                          Publish as QotW
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Published */}
      <section>
        <h2 className="text-base font-semibold text-stone-800 mb-3">Published <span className="text-stone-400 font-normal">({published.length})</span></h2>
        {published.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing published yet. Publish a draft to give it a permanent QotW link.</p>
        ) : (
          <div className="space-y-2">
            {published.map(item => (
              <div key={item.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-3">
                <span className="shrink-0 text-xs font-semibold text-orange-600 bg-orange-50 rounded px-2 py-1">{qotwLabel(item.number)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900 text-sm">{item.title}</p>
                  <div className="flex items-center gap-3 flex-wrap mt-2 text-xs">
                    <a href={`/communities/${slug}/qotw/${item.number}`} target="_blank" rel="noopener noreferrer"
                      className="text-orange-600 hover:underline">/qotw/{item.number} ↗</a>
                    <button onClick={() => copyLink(item.number)} className="text-stone-500 hover:text-stone-800">
                      {copiedNum === item.number ? 'Copied!' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => {
                        const msg = item.number === 0
                          ? 'Remove this QotW-t test? Your original question stays safe in the bank.'
                          : `Delete ${qotwLabel(item.number)} and its answers? This can’t be undone.`
                        if (confirm(msg)) run(() => deleteItem(item.id, communityId, slug))
                      }}
                      disabled={pending}
                      className="ml-auto text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
