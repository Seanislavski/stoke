'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addReply } from '@/app/actions/tickets'
import RichContent from '@/components/RichContent'

type Profile = { username: string; display_name: string | null; avatar_url?: string | null }
type Reply = {
  id: string
  content: string
  created_at: string
  author_id: string
  profiles: Profile | null
}

export default function TicketThread({
  ticketId,
  currentUserId,
  initialReplies,
  initialProfiles,
  isClosed,
}: {
  ticketId: string
  currentUserId: string
  initialReplies: Reply[]
  initialProfiles: Record<string, Profile>
  isClosed: boolean
}) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies)
  const [profiles, setProfiles] = useState<Record<string, Profile>>(initialProfiles)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies])

  useEffect(() => {
    const channel = supabase
      .channel(`ticket_replies:${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_replies', filter: `ticket_id=eq.${ticketId}` },
        async (payload) => {
          const row = payload.new as { id: string; content: string; created_at: string; author_id: string }

          let profile = profiles[row.author_id] ?? null
          if (!profile) {
            const { data } = await supabase
              .from('profiles')
              .select('username, display_name, avatar_url')
              .eq('id', row.author_id)
              .single()
            if (data) {
              profile = data
              setProfiles(p => ({ ...p, [row.author_id]: data }))
            }
          }

          setReplies(rs => {
            const optimisticIdx = rs.findIndex(r =>
              r.id.startsWith('optimistic-') &&
              r.author_id === row.author_id &&
              r.content === row.content
            )
            if (optimisticIdx !== -1) {
              const next = [...rs]
              next[optimisticIdx] = { ...row, profiles: profile }
              return next
            }
            if (rs.some(r => r.id === row.id)) return rs
            return [...rs, { ...row, profiles: profile }]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [ticketId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return

    setSending(true)
    setError('')
    setInput('')

    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: Reply = {
      id: optimisticId,
      content,
      created_at: new Date().toISOString(),
      author_id: currentUserId,
      profiles: profiles[currentUserId] ?? null,
    }
    setReplies(rs => [...rs, optimistic])

    const result = await addReply(ticketId, content)
    if (result.error) {
      setError(result.error)
      setInput(content)
      setReplies(rs => rs.filter(r => r.id !== optimisticId))
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' at ' + new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <>
      <div className="space-y-4 mb-6">
        {replies.map(reply => {
          const author = reply.profiles ?? profiles[reply.author_id] ?? null
          const isOwn = reply.author_id === currentUserId
          return (
            <div key={reply.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-semibold text-stone-500 shrink-0">
                {((author?.display_name ?? author?.username) || '?')[0].toUpperCase()}
              </div>
              <div className={`max-w-[80%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`rounded-xl px-4 py-3 text-sm ${isOwn ? 'bg-orange-500 text-white' : 'bg-white border border-stone-200 text-stone-800'}`}>
                  <RichContent
                    content={reply.content}
                    className="whitespace-pre-wrap"
                    linkClassName={isOwn ? 'text-white underline break-all' : 'text-orange-600 hover:underline break-all'}
                    embeds={false}
                  />
                </div>
                <p className="text-xs text-stone-400 mt-1 px-1">
                  {author?.display_name ?? author?.username} · {formatDate(reply.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-600 mb-2 px-1">{error}</p>}
      {!isClosed ? (
        <form onSubmit={handleSend} className="sticky bottom-0 -mx-4 px-4 pb-4 pt-3 bg-stone-50 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Reply…"
            disabled={sending}
            className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-stone-400 text-center">This ticket is closed.</p>
      )}
    </>
  )
}
