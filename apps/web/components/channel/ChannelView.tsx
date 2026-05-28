'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { deleteMessage } from '@/app/actions/messages'

type Profile = { username: string; display_name: string | null; avatar_url: string | null }
type Message = {
  id: string
  content: string
  created_at: string
  edited_at: string | null
  author_id: string
  profiles: Profile | null
}

function Avatar({ profile }: { profile: Profile | null }) {
  const initials = ((profile?.display_name ?? profile?.username) || '?')[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-semibold text-stone-500">
      {profile?.avatar_url
        ? <Image src={profile.avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" />
        : initials}
    </div>
  )
}

export default function ChannelView({
  channelId,
  channelName,
  communityId,
  communitySlug,
  currentUserId,
  isMod,
  initialMessages,
  initialProfiles,
}: {
  channelId: string
  channelName: string
  communityId: string
  communitySlug: string
  currentUserId: string
  isMod: boolean
  initialMessages: Message[]
  initialProfiles: Record<string, Profile>
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [profiles, setProfiles] = useState<Record<string, Profile>>(initialProfiles)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const row = payload.new as { id: string; content: string; created_at: string; edited_at: string | null; author_id: string }

          // fetch author profile if not cached
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

          setMessages(ms => {
            // replace matching optimistic message from same author with confirmed row
            const optimisticIdx = ms.findIndex(m =>
              m.id.startsWith('optimistic-') &&
              m.author_id === row.author_id &&
              m.content === row.content
            )
            if (optimisticIdx !== -1) {
              const next = [...ms]
              next[optimisticIdx] = { ...row, profiles: profile }
              return next
            }
            // skip duplicates
            if (ms.some(m => m.id === row.id)) return ms
            return [...ms, { ...row, profiles: profile }]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || sending) return

    setSending(true)
    setInput('')

    // optimistic update — show message immediately
    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      content,
      created_at: new Date().toISOString(),
      edited_at: null,
      author_id: currentUserId,
      profiles: profiles[currentUserId] ?? null,
    }
    setMessages(ms => [...ms, optimistic])

    const { error } = await supabase
      .from('messages')
      .insert({ channel_id: channelId, author_id: currentUserId, content })

    if (error) {
      setInput(content)
      setMessages(ms => ms.filter(m => m.id !== optimisticId))
    }
    setSending(false)
  }

  async function handleDeleteMessage(messageId: string) {
    if (!window.confirm('Delete this message?')) return
    setMessages(ms => ms.filter(m => m.id !== messageId))
    await deleteMessage(messageId, channelId, communityId)
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // group messages by date
  const grouped: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const date = formatDate(msg.created_at)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) {
      last.messages.push(msg)
    } else {
      grouped.push({ date, messages: [msg] })
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem - 3rem)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-stone-200 flex-shrink-0">
        <Link href={`/communities/${communitySlug}`} className="text-stone-400 hover:text-stone-700 text-sm">
          ←
        </Link>
        <h1 className="font-semibold text-stone-900"># {channelName}</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-stone-400 text-sm py-8">No messages yet. Say hello!</p>
        )}

        {grouped.map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400">{date}</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            <div className="space-y-3">
              {dayMsgs.map((msg, i) => {
                const prev = dayMsgs[i - 1]
                const sameAuthor = prev?.author_id === msg.author_id
                const profile = msg.profiles ?? profiles[msg.author_id] ?? null

                const canDelete = msg.author_id === currentUserId || isMod
                return (
                  <div key={msg.id} className={`group flex gap-3 ${sameAuthor ? 'mt-0.5' : 'mt-3'}`}>
                    {sameAuthor ? (
                      <div className="w-8 flex-shrink-0" />
                    ) : (
                      <Link href={`/profile/${profile?.username}`}>
                        <Avatar profile={profile} />
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      {!sameAuthor && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <Link
                            href={`/profile/${profile?.username}`}
                            className="text-sm font-semibold text-stone-800 hover:text-orange-600"
                          >
                            {profile?.display_name ?? profile?.username ?? 'Unknown'}
                          </Link>
                          <span className="text-xs text-stone-400">{formatTime(msg.created_at)}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <p className="text-sm text-stone-700 break-words whitespace-pre-wrap flex-1">{msg.content}</p>
                        {canDelete && !msg.id.startsWith('optimistic-') && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 text-xs text-stone-300 hover:text-red-500 transition-opacity shrink-0 mt-0.5"
                            title="Delete message"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-stone-200 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message #${channelName}`}
          maxLength={2000}
          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
