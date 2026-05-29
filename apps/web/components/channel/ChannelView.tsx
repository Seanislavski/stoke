'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { deleteMessage, restoreMessage } from '@/app/actions/messages'
import { processMentions } from '@/app/actions/mentions'

type Profile = { username: string; display_name: string | null; avatar_url: string | null }
type Message = {
  id: string
  content: string
  created_at: string
  edited_at: string | null
  author_id: string
  deleted_at: string | null
  deleted_by: string | null
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
  highlightMessageId,
  mentionMessageId,
}: {
  channelId: string
  channelName: string
  communityId: string
  communitySlug: string
  currentUserId: string
  isMod: boolean
  initialMessages: Message[]
  initialProfiles: Record<string, Profile>
  highlightMessageId?: string
  mentionMessageId?: string
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [profiles, setProfiles] = useState<Record<string, Profile>>(initialProfiles)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightMessageId ?? null)
  const [mentionedId, setMentionedId] = useState<string | null>(mentionMessageId ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // scroll to bottom on new messages
  useEffect(() => {
    if (highlightedId || mentionedId) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // scroll to and pulse highlighted message from audit log link (blue)
  useEffect(() => {
    if (!highlightedId) return
    const el = document.getElementById(`msg-${highlightedId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setHighlightedId(null), 3000)
    return () => clearTimeout(timer)
  }, [])

  // scroll to and pulse mentioned message (purple)
  useEffect(() => {
    if (!mentionedId) return
    const el = document.getElementById(`msg-${mentionedId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => setMentionedId(null), 3000)
    return () => clearTimeout(timer)
  }, [])

  // realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const row = payload.new as { id: string; content: string; created_at: string; edited_at: string | null; author_id: string; deleted_at: string | null; deleted_by: string | null }

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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const row = payload.new as { id: string; deleted_at: string | null; deleted_by: string | null }
          setMessages(ms => {
            if (isMod) {
              // mods see deleted placeholder — update in place
              return ms.map(m => m.id === row.id ? { ...m, deleted_at: row.deleted_at, deleted_by: row.deleted_by } : m)
            } else {
              // non-mods: remove deleted messages, restore adds them back on next page load
              return row.deleted_at ? ms.filter(m => m.id !== row.id) : ms
            }
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
      deleted_at: null,
      deleted_by: null,
      profiles: profiles[currentUserId] ?? null,
    }
    setMessages(ms => [...ms, optimistic])

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ channel_id: channelId, author_id: currentUserId, content })
      .select('id')
      .single()

    if (error) {
      setInput(content)
      setMessages(ms => ms.filter(m => m.id !== optimisticId))
    } else if (inserted && /@\w+/.test(content)) {
      processMentions(content, inserted.id, channelId, communityId)
    }
    setSending(false)
  }

  async function handleDeleteMessage(messageId: string) {
    if (!window.confirm('Delete this message?')) return
    const now = new Date().toISOString()
    setMessages(ms => isMod
      ? ms.map(m => m.id === messageId ? { ...m, deleted_at: now, deleted_by: currentUserId } : m)
      : ms.filter(m => m.id !== messageId)
    )
    await deleteMessage(messageId, channelId, communityId)
  }

  async function handleRestoreMessage(messageId: string) {
    setMessages(ms => ms.map(m => m.id === messageId ? { ...m, deleted_at: null, deleted_by: null } : m))
    await restoreMessage(messageId, channelId, communityId)
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
                const trashButton = canDelete && !msg.deleted_at && !msg.id.startsWith('optimistic-') ? (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-30 md:opacity-0 md:group-hover:opacity-100 hover:opacity-100 active:opacity-100 text-stone-400 hover:text-red-500 active:text-red-500 transition-opacity touch-manipulation flex-shrink-0"
                    title="Delete message"
                    aria-label="Delete message"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                ) : null

                const isHighlighted = highlightedId === msg.id
                const isMentioned = mentionedId === msg.id
                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`group flex gap-3 items-start transition-colors duration-300 rounded-sm px-1 -mx-1 ${sameAuthor ? 'mt-0.5' : 'mt-3'} ${isHighlighted ? 'bg-blue-50 outline outline-1 outline-blue-200 animate-pulse' : ''} ${isMentioned ? 'bg-purple-50 outline outline-1 outline-purple-200 animate-pulse' : ''}`}>
                    {sameAuthor ? (
                      trashButton
                        ? <div className="w-8 flex-shrink-0 flex items-center justify-center">{trashButton}</div>
                        : <div className="w-8 flex-shrink-0" />
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
                          {trashButton}
                        </div>
                      )}
                      {msg.deleted_at ? (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-stone-400 italic">[Message deleted]</p>
                          {isMod && (
                            <button
                              onClick={() => handleRestoreMessage(msg.id)}
                              className="text-xs text-orange-500 hover:text-orange-700 transition-colors"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-700 break-words whitespace-pre-wrap">{msg.content}</p>
                      )}
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
