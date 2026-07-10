'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { deleteMessage, restoreMessage, editMessage, revertMessage } from '@/app/actions/messages'
import { processMentions } from '@/app/actions/mentions'
import { notifyReaction } from '@/app/actions/reactions'
import { notifyReply } from '@/app/actions/replies'
import RichContent from '@/components/RichContent'
import ImageLightbox from '@/components/ImageLightbox'

type Profile = { username: string; display_name: string | null; avatar_url: string | null }
type Reaction = { message_id: string; user_id: string; emoji: string }

const REACTION_CHOICES = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🙏', '🔥']
type Message = {
  id: string
  content: string
  image_url: string | null
  created_at: string
  edited_at: string | null
  previous_content: string | null
  reply_to_id: string | null
  author_id: string
  deleted_at: string | null
  deleted_by: string | null
  profiles: Profile | null
}

function Avatar({ profile }: { profile: Profile | null }) {
  const initials = ((profile?.display_name ?? profile?.username) || '?')[0].toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-semibold text-stone-500 photo-pop">
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
  initialReactions,
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
  initialReactions: Reaction[]
  highlightMessageId?: string
  mentionMessageId?: string
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [profiles, setProfiles] = useState<Record<string, Profile>>(initialProfiles)
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editInput, setEditInput] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightMessageId ?? null)
  const [mentionedId, setMentionedId] = useState<string | null>(mentionMessageId ?? null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
          const row = payload.new as { id: string; content: string; image_url: string | null; created_at: string; edited_at: string | null; previous_content: string | null; reply_to_id: string | null; author_id: string; deleted_at: string | null; deleted_by: string | null }

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
          const row = payload.new as { id: string; content: string; edited_at: string | null; previous_content: string | null; deleted_at: string | null; deleted_by: string | null }
          setMessages(ms => {
            // non-mods: a deletion removes the message entirely (restore re-adds on next load)
            if (row.deleted_at && !isMod) return ms.filter(m => m.id !== row.id)
            // otherwise sync content/edit/delete state in place (handles edits, undo, deletes for mods, restores)
            return ms.map(m => m.id === row.id
              ? { ...m, content: row.content, edited_at: row.edited_at, previous_content: row.previous_content, deleted_at: row.deleted_at, deleted_by: row.deleted_by }
              : m)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  // realtime subscription for reactions (filtered by channel_id; DELETE carries the full
  // row thanks to REPLICA IDENTITY FULL on the table)
  useEffect(() => {
    const channel = supabase
      .channel(`reactions:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const r = payload.new as Reaction
          setReactions(rs =>
            rs.some(x => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)
              ? rs
              : [...rs, { message_id: r.message_id, user_id: r.user_id, emoji: r.emoji }]
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const r = payload.old as Reaction
          setReactions(rs => rs.filter(x => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji)))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelId])

  async function toggleReaction(messageId: string, emoji: string) {
    setPickerFor(null)
    const mine = reactions.some(r => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji)
    if (mine) {
      setReactions(rs => rs.filter(r => !(r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji)))
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
        .eq('emoji', emoji)
      if (error) setReactions(rs => [...rs, { message_id: messageId, user_id: currentUserId, emoji }]) // roll back
    } else {
      setReactions(rs => [...rs, { message_id: messageId, user_id: currentUserId, emoji }])
      const { error } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, channel_id: channelId, user_id: currentUserId, emoji })
      if (error) {
        setReactions(rs => rs.filter(r => !(r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji))) // roll back
      } else {
        void notifyReaction(messageId, channelId, communityId) // fire-and-forget author notification
      }
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `channel-images/${channelId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
      setPendingImageUrl(publicUrl)
    }
    setUploadingImage(false)
    e.target.value = ''
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if ((!content && !pendingImageUrl) || sending) return

    setSending(true)
    setInput('')
    const imageUrl = pendingImageUrl
    setPendingImageUrl(null)
    const replyTo = replyingTo
    setReplyingTo(null)

    // optimistic update — show message immediately
    const optimisticId = `optimistic-${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      content,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      edited_at: null,
      previous_content: null,
      reply_to_id: replyTo?.id ?? null,
      author_id: currentUserId,
      deleted_at: null,
      deleted_by: null,
      profiles: profiles[currentUserId] ?? null,
    }
    setMessages(ms => [...ms, optimistic])

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ channel_id: channelId, author_id: currentUserId, content, image_url: imageUrl, reply_to_id: replyTo?.id ?? null })
      .select('id')
      .single()

    if (error) {
      setInput(content)
      setPendingImageUrl(imageUrl)
      if (replyTo) setReplyingTo(replyTo)
      setMessages(ms => ms.filter(m => m.id !== optimisticId))
    } else if (inserted) {
      if (/@\w+/.test(content)) processMentions(content, inserted.id, channelId, communityId)
      if (replyTo && replyTo.author_id !== currentUserId) void notifyReply(inserted.id, replyTo.id, channelId, communityId)
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

  function startEdit(msg: Message) {
    setEditingId(msg.id)
    setEditInput(msg.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditInput('')
  }

  async function handleEditSubmit(messageId: string) {
    const original = messages.find(m => m.id === messageId)
    const next = editInput.trim()
    if (!original || (!next && !original.image_url)) return
    if (next === original.content) { cancelEdit(); return }

    // optimistic — stash previous_content so "Undo edit" appears immediately
    setMessages(ms => ms.map(m => m.id === messageId ? { ...m, content: next, edited_at: new Date().toISOString(), previous_content: original.content } : m))
    cancelEdit()

    const result = await editMessage(messageId, channelId, communityId, next)
    if (result.error) {
      // roll back to the original content
      setMessages(ms => ms.map(m => m.id === messageId ? { ...m, content: original.content, edited_at: original.edited_at, previous_content: original.previous_content } : m))
    }
  }

  async function handleRevert(messageId: string) {
    const original = messages.find(m => m.id === messageId)
    if (!original || original.previous_content == null) return

    // optimistic — restore prior text, clear the stash (single-level undo)
    setMessages(ms => ms.map(m => m.id === messageId
      ? { ...m, content: original.previous_content as string, edited_at: new Date().toISOString(), previous_content: null }
      : m))

    const result = await revertMessage(messageId, channelId, communityId)
    if (result.error) {
      setMessages(ms => ms.map(m => m.id === messageId
        ? { ...m, content: original.content, edited_at: original.edited_at, previous_content: original.previous_content }
        : m))
    }
  }

  function startReply(msg: Message) {
    setReplyingTo(msg)
    inputRef.current?.focus()
  }

  function scrollToMessage(id: string) {
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setMentionedId(id)
      setTimeout(() => setMentionedId(m => (m === id ? null : m)), 2000)
    }
  }

  async function handleRestoreMessage(messageId: string) {
    setMessages(ms => ms.map(m => m.id === messageId ? { ...m, deleted_at: null, deleted_by: null } : m))
    const result = await restoreMessage(messageId, channelId, communityId)
    if (result.error) {
      // roll back optimistic update
      setMessages(ms => ms.map(m => m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), deleted_by: currentUserId } : m))
    }
  }

  // Mention picker: filter cached profiles by query
  const mentionSuggestions = mentionQuery !== null
    ? Object.values(profiles)
        .filter(p => p.username !== (profiles[currentUserId]?.username))
        .filter(p =>
          p.username.toLowerCase().startsWith(mentionQuery.toLowerCase()) ||
          (p.display_name?.toLowerCase().startsWith(mentionQuery.toLowerCase()))
        )
        .slice(0, 5)
    : []

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInput(val)
    // detect @mention being typed
    const cursor = e.target.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1])
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  function completeMention(username: string) {
    const cursor = inputRef.current?.selectionStart ?? input.length
    const textBefore = input.slice(0, cursor)
    const textAfter = input.slice(cursor)
    const replaced = textBefore.replace(/@(\w*)$/, `@${username} `)
    setInput(replaced + textAfter)
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && replyingTo && mentionQuery === null) { setReplyingTo(null); return }
    if (mentionQuery === null || mentionSuggestions.length === 0) return
    if (e.key === 'Tab' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.key === 'Tab') {
        completeMention(mentionSuggestions[mentionIndex]?.username ?? mentionSuggestions[0].username)
      } else {
        setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && mentionSuggestions.length > 0) {
      e.preventDefault()
      completeMention(mentionSuggestions[mentionIndex]?.username ?? mentionSuggestions[0].username)
    } else if (e.key === 'Escape') {
      setMentionQuery(null)
    }
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Group a message's reactions into ordered { emoji, count, mine } pills.
  function reactionPills(messageId: string): { emoji: string; count: number; mine: boolean }[] {
    const order: string[] = []
    const byEmoji: Record<string, { count: number; mine: boolean }> = {}
    for (const r of reactions) {
      if (r.message_id !== messageId) continue
      if (!byEmoji[r.emoji]) { byEmoji[r.emoji] = { count: 0, mine: false }; order.push(r.emoji) }
      byEmoji[r.emoji].count++
      if (r.user_id === currentUserId) byEmoji[r.emoji].mine = true
    }
    return order.map(emoji => ({ emoji, ...byEmoji[emoji] }))
  }

  // lookup for rendering reply references (parent must be among the loaded messages)
  const messageById = new Map(messages.map(m => [m.id, m]))
  function replyPreviewName(m: Message) {
    const p = m.profiles ?? profiles[m.author_id] ?? null
    return p?.display_name ?? p?.username ?? 'Unknown'
  }
  function replySnippet(m: Message) {
    if (m.deleted_at) return 'deleted message'
    const text = m.content?.replace(/\s+/g, ' ').trim()
    if (text) return text.length > 60 ? `${text.slice(0, 60)}…` : text
    return m.image_url ? '📷 image' : ''
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
    <>
    {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    {pickerFor && <div className="fixed inset-0 z-20" onClick={() => setPickerFor(null)} />}
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
                const canEdit = msg.author_id === currentUserId && !msg.deleted_at && !msg.id.startsWith('optimistic-')
                const canReply = !msg.deleted_at && !msg.id.startsWith('optimistic-')
                const replyIcon = (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 17 4 12 9 7" />
                    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                  </svg>
                )
                const replyButton = canReply ? (
                  <button
                    onClick={() => startReply(msg)}
                    className="hidden md:flex opacity-0 group-hover:opacity-100 hover:opacity-100 active:opacity-100 text-stone-400 hover:text-orange-500 active:text-orange-500 transition-opacity touch-manipulation flex-shrink-0 items-center justify-center"
                    title="Reply" aria-label="Reply"
                  >
                    {replyIcon}
                  </button>
                ) : null
                const mobileReplyButton = canReply ? (
                  <button
                    onClick={() => startReply(msg)}
                    className="md:hidden p-1.5 text-stone-300 active:text-orange-500 touch-manipulation flex-shrink-0"
                    title="Reply" aria-label="Reply"
                  >
                    {replyIcon}
                  </button>
                ) : null
                const pencilIcon = (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                )
                const editButton = canEdit ? (
                  <button
                    onClick={() => startEdit(msg)}
                    className="hidden md:flex opacity-0 group-hover:opacity-100 hover:opacity-100 active:opacity-100 text-stone-400 hover:text-orange-500 active:text-orange-500 transition-opacity touch-manipulation flex-shrink-0 items-center justify-center"
                    title="Edit message"
                    aria-label="Edit message"
                  >
                    {pencilIcon}
                  </button>
                ) : null
                const mobileEditButton = canEdit ? (
                  <button
                    onClick={() => startEdit(msg)}
                    className="md:hidden p-1.5 text-stone-300 active:text-orange-500 touch-manipulation flex-shrink-0"
                    title="Edit message"
                    aria-label="Edit message"
                  >
                    {pencilIcon}
                  </button>
                ) : null
                const trashIcon = (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                )
                // desktop: hover-reveal in avatar slot; mobile: always-visible on right side of message
                const trashButton = canDelete && !msg.deleted_at && !msg.id.startsWith('optimistic-') ? (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="hidden md:flex opacity-0 group-hover:opacity-100 hover:opacity-100 active:opacity-100 text-stone-400 hover:text-red-500 active:text-red-500 transition-opacity touch-manipulation flex-shrink-0 items-center justify-center"
                    title="Delete message"
                    aria-label="Delete message"
                  >
                    {trashIcon}
                  </button>
                ) : null
                const mobileTrashButton = canDelete && !msg.deleted_at && !msg.id.startsWith('optimistic-') ? (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="md:hidden p-1.5 text-stone-300 active:text-red-500 touch-manipulation flex-shrink-0"
                    title="Delete message"
                    aria-label="Delete message"
                  >
                    {trashIcon}
                  </button>
                ) : null

                const isHighlighted = highlightedId === msg.id
                const isMentioned = mentionedId === msg.id
                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`group flex gap-3 items-start transition-colors duration-300 rounded-sm px-1 -mx-1 ${sameAuthor ? 'mt-0.5' : 'mt-3'} ${isHighlighted ? 'bg-blue-50 outline outline-1 outline-blue-200 animate-pulse' : ''} ${isMentioned ? 'bg-purple-50 outline outline-1 outline-purple-200 animate-pulse' : ''}`}>
                    {sameAuthor ? (
                      (trashButton || editButton || replyButton)
                        ? <div className="w-8 flex-shrink-0 flex flex-col items-center justify-center gap-0.5">{replyButton}{editButton}{trashButton}</div>
                        : <div className="w-8 flex-shrink-0" />
                    ) : (
                      <Link href={`/profile/${profile?.username}`}>
                        <Avatar profile={profile} />
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      {msg.reply_to_id && (() => {
                        const parent = messageById.get(msg.reply_to_id)
                        return (
                          <button
                            onClick={() => parent && scrollToMessage(parent.id)}
                            className="flex items-center gap-1 max-w-full text-xs text-stone-400 hover:text-stone-600 mb-0.5 truncate"
                            title="Go to the message this replies to"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                              <polyline points="9 17 4 12 9 7" />
                              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                            </svg>
                            {parent ? (
                              <span className="truncate">
                                <span className="font-medium">{replyPreviewName(parent)}</span>
                                {replySnippet(parent) && <span className="text-stone-400"> {replySnippet(parent)}</span>}
                              </span>
                            ) : (
                              <span className="italic">original message</span>
                            )}
                          </button>
                        )
                      })()}
                      {!sameAuthor && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <Link
                            href={`/profile/${profile?.username}`}
                            className="text-sm font-semibold text-stone-800 hover:text-orange-600"
                          >
                            {profile?.display_name ?? profile?.username ?? 'Unknown'}
                          </Link>
                          <span className="text-xs text-stone-400">{formatTime(msg.created_at)}</span>
                          {replyButton}
                          {editButton}
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
                      ) : editingId === msg.id ? (
                        <form
                          onSubmit={e => { e.preventDefault(); handleEditSubmit(msg.id) }}
                          className="mt-0.5"
                        >
                          <input
                            type="text"
                            value={editInput}
                            onChange={e => setEditInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                            autoFocus
                            maxLength={2000}
                            className="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <button type="submit" className="text-orange-600 hover:text-orange-700 font-medium">Save</button>
                            <button type="button" onClick={cancelEdit} className="text-stone-400 hover:text-stone-600">Cancel</button>
                            <span className="text-stone-400">Enter to save · Esc to cancel</span>
                          </div>
                        </form>
                      ) : (
                        <>
                          {msg.content && (
                            <span>
                              <RichContent content={msg.content} />
                              {msg.edited_at && <span className="text-[11px] text-stone-400 ml-1">(edited)</span>}
                              {msg.author_id === currentUserId && msg.previous_content != null && (
                                <button
                                  onClick={() => handleRevert(msg.id)}
                                  className="text-[11px] text-stone-400 hover:text-orange-600 ml-1.5"
                                  title="Undo your last edit"
                                >
                                  ↩ Undo edit
                                </button>
                              )}
                            </span>
                          )}
                          {msg.image_url && (
                            <button type="button" onClick={() => setLightboxSrc(msg.image_url!)} className="inline-block mt-1">
                              <img
                                src={msg.image_url}
                                alt="attachment"
                                className="rounded-lg border border-stone-200 max-h-72 max-w-xs object-contain photo-pop"
                              />
                            </button>
                          )}
                          {!msg.id.startsWith('optimistic-') && (() => {
                            const pills = reactionPills(msg.id)
                            return (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {pills.map(p => (
                                  <button
                                    key={p.emoji}
                                    onClick={() => toggleReaction(msg.id, p.emoji)}
                                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${p.mine ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'}`}
                                    title={p.mine ? 'Remove your reaction' : 'React'}
                                  >
                                    <span>{p.emoji}</span>
                                    <span className="tabular-nums">{p.count}</span>
                                  </button>
                                ))}
                                <div className="relative">
                                  <button
                                    onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)}
                                    className="flex items-center rounded-full border border-stone-200 bg-white px-1.5 py-1 text-stone-400 hover:text-orange-500 hover:border-orange-200 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                                    title="Add reaction"
                                    aria-label="Add reaction"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10" />
                                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                      <line x1="9" y1="9" x2="9.01" y2="9" />
                                      <line x1="15" y1="9" x2="15.01" y2="9" />
                                    </svg>
                                  </button>
                                  {pickerFor === msg.id && (
                                    <div className="absolute z-30 bottom-full mb-1 left-0 flex gap-0.5 rounded-lg border border-stone-200 bg-white p-1 shadow-md">
                                      {REACTION_CHOICES.map(emoji => (
                                        <button
                                          key={emoji}
                                          onClick={() => toggleReaction(msg.id, emoji)}
                                          className="rounded px-1 py-0.5 text-base leading-none hover:bg-stone-100"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                        </>
                      )}
                    </div>
                    {(mobileReplyButton || mobileEditButton || mobileTrashButton) && (
                      <div className="md:hidden flex flex-col items-center flex-shrink-0">
                        {mobileReplyButton}
                        {mobileEditButton}
                        {mobileTrashButton}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Mention picker */}
      {mentionSuggestions.length > 0 && (
        <div className="mb-1 border border-stone-200 rounded-lg overflow-hidden bg-white shadow-sm">
          {mentionSuggestions.map((p, i) => (
            <button
              key={p.username}
              type="button"
              onMouseDown={e => { e.preventDefault(); completeMention(p.username) }}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${i === mentionIndex ? 'bg-orange-50 text-orange-700' : 'text-stone-700 hover:bg-stone-50'}`}
            >
              <span className="font-medium">@{p.username}</span>
              {p.display_name && <span className="text-stone-400 text-xs">{p.display_name}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Image preview */}
      {pendingImageUrl && (
        <div className="pt-2 flex-shrink-0">
          <div className="relative inline-block">
            <img src={pendingImageUrl} alt="preview" className="h-16 w-auto rounded-lg border border-stone-200 object-cover" />
            <button
              type="button"
              onClick={() => setPendingImageUrl(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500 transition-colors leading-none"
            >×</button>
          </div>
        </div>
      )}

      {/* Reply bar */}
      {replyingTo && (
        <div className="flex items-center gap-2 pt-2 flex-shrink-0 text-xs text-stone-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-stone-400">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
          <span className="truncate">
            Replying to <span className="font-medium text-stone-700">{replyPreviewName(replyingTo)}</span>
            {replySnippet(replyingTo) && <span className="text-stone-400"> — {replySnippet(replyingTo)}</span>}
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="ml-auto text-stone-400 hover:text-red-500 flex-shrink-0"
            title="Cancel reply" aria-label="Cancel reply"
          >✕</button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-stone-200 flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          title="Attach image"
          className="p-2 text-stone-400 hover:text-orange-500 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {uploadingImage ? (
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder={`Message #${channelName}`}
          maxLength={2000}
          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={(!input.trim() && !pendingImageUrl) || sending}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Send
        </button>
      </form>
    </div>
    </>
  )
}
