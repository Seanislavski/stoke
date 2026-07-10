'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/mentions'

type Notification = {
  id: string
  created_at: string
  type: string
  message_id: string | null
  read_at: string | null
  channel_id: string | null
  actor: { username: string; display_name: string | null } | null
  community: { name: string; slug: string } | null
  channel: { name: string } | null
}

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={hasUnread ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export default function NotificationsBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.read_at).length

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('id, created_at, type, message_id, read_at, channel_id, actor:actor_id(username, display_name), community:community_id(name, slug), channel:channel_id(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (data) {
        setNotifications(data.map(n => ({
          ...n,
          actor: Array.isArray(n.actor) ? n.actor[0] ?? null : n.actor,
          community: Array.isArray(n.community) ? n.community[0] ?? null : n.community,
          channel: Array.isArray(n.channel) ? n.channel[0] ?? null : n.channel,
        })))
      }
    }

    load()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleNotificationClick(n: Notification) {
    if (!n.read_at) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
      await markNotificationRead(n.id)
    }
    setOpen(false)
    if (n.type === 'qotw' && n.community && n.message_id) {
      router.push(`/communities/${n.community.slug}/questions/${n.message_id}`)
    } else if (n.community && n.channel_id && n.message_id) {
      router.push(`/communities/${n.community.slug}/channels/${n.channel_id}?mention=${n.message_id}`)
    }
  }

  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    await markAllNotificationsRead()
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1 rounded-lg transition-colors text-stone-500 hover:text-stone-700"
        style={unreadCount > 0 ? { filter: 'drop-shadow(0 0 6px rgba(147, 51, 234, 0.55))' } : undefined}
        aria-label="Notifications"
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-stone-200 shadow-lg z-30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
            <span className="text-sm font-semibold text-stone-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-stone-400 hover:text-stone-700">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-stone-50 max-h-96 overflow-y-auto">
              {notifications.map(n => {
                const actor = n.actor
                const isUnread = !n.read_at
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors ${isUnread ? 'bg-purple-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />}
                      <div className={`flex-1 min-w-0 ${!isUnread ? 'ml-3.5' : ''}`}>
                        {n.type === 'qotw' ? (
                          <p className="text-sm text-stone-800">
                            ⭐ <span className="font-medium">Your question was chosen as Question of the Week!</span>
                          </p>
                        ) : (
                          <p className="text-sm text-stone-800">
                            <span className="font-medium">{actor?.display_name ?? actor?.username ?? 'Someone'}</span>
                            {n.type === 'reaction' ? ' reacted to your message in ' : n.type === 'reply' ? ' replied to you in ' : ' mentioned you in '}
                            <span className="font-medium">#{n.channel?.name ?? 'a channel'}</span>
                          </p>
                        )}
                        {n.community && (
                          <p className="text-xs text-stone-400 mt-0.5">{n.community.name}</p>
                        )}
                        <p className="text-xs text-stone-400 mt-0.5">{formatTime(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
