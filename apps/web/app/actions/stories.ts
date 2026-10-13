'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAction } from '@/lib/audit'
import { sendEmail, storySubmittedHtml, storyApprovedHtml } from '@/lib/email'

// Stories: members share their own experiences. A new story waits for a mod;
// replies appear immediately. Anonymous stories hide the author from members
// but never from mods. "Me too" counts are shown to the author only.
// All three tables are service-role only, so every rule lives here.

async function caller(communityId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isMember: false, isMod: false }

  const admin = createAdminClient()
  const [{ data: membership }, { data: community }, { data: platformRole }] = await Promise.all([
    admin.from('community_members').select('role, status').eq('community_id', communityId).eq('user_id', user.id).maybeSingle(),
    admin.from('communities').select('owner_id').eq('id', communityId).single(),
    admin.from('platform_roles').select('role').eq('user_id', user.id).in('role', ['owner', 'platform_moderator']).maybeSingle(),
  ])
  const isActive = membership?.status === 'active'
  const isMod = !!platformRole || user.id === community?.owner_id ||
    (isActive && ['organizer', 'moderator'].includes(membership?.role ?? ''))
  return { user, isMember: isActive || isMod, isMod }
}

async function modEmails(communityId: string) {
  const admin = createAdminClient()
  const [{ data: community }, { data: mods }] = await Promise.all([
    admin.from('communities').select('owner_id, name').eq('id', communityId).single(),
    admin.from('community_members').select('user_id').eq('community_id', communityId).eq('status', 'active').in('role', ['organizer', 'moderator']),
  ])
  if (!community) return { name: null, emails: [] as string[] }
  const ids = new Set<string>([community.owner_id, ...(mods ?? []).map(m => m.user_id)])
  const emails: string[] = []
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user?.email) emails.push(data.user.email)
  }
  return { name: community.name as string, emails }
}

function revalidate(slug: string, storyId?: string) {
  revalidatePath(`/communities/${slug}`)
  revalidatePath(`/communities/${slug}/moderation`)
  if (storyId) revalidatePath(`/communities/${slug}/stories/${storyId}`)
}

// ─── stories ──────────────────────────────────────────────────────────────────

export async function submitStory(communityId: string, slug: string, formData: FormData) {
  const { user, isMember, isMod } = await caller(communityId)
  if (!user) return { error: 'Not logged in' }
  if (!isMember) return { error: 'Only members can share a story here' }

  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const body = (formData.get('body') as string | null)?.trim() ?? ''
  if (!title) return { error: 'Please give your story a title' }
  if (!body) return { error: 'Please write your story' }
  if (title.length > 200) return { error: 'The title is too long (200 characters max)' }
  if (body.length > 20000) return { error: 'The story is too long (20,000 characters max)' }

  const isAnonymous = formData.get('anonymous') === 'on'
  const autoPublish = isMod
  const now = new Date().toISOString()

  const admin = createAdminClient()
  const { data: inserted, error } = await admin.from('stories').insert({
    community_id: communityId,
    author_id: user.id,
    title,
    body,
    is_anonymous: isAnonymous,
    status: autoPublish ? 'published' : 'pending',
    approved_by: autoPublish ? user.id : null,
    published_at: autoPublish ? now : null,
  }).select('id').single()
  if (error) return { error: error.message }

  logAction({ actorId: user.id, communityId, action: autoPublish ? 'story.created' : 'story.submitted', targetId: inserted.id, targetType: 'story' })

  if (!autoPublish) {
    void (async () => {
      const { name, emails } = await modEmails(communityId)
      if (!name) return
      for (const to of emails) await sendEmail(to, `A new story is awaiting review in ${name}`, storySubmittedHtml(name, title))
    })()
  }

  revalidate(slug)
  return { status: autoPublish ? 'published' : 'pending', id: inserted.id }
}

export async function approveStory(storyId: string, communityId: string, slug: string) {
  const { user, isMod } = await caller(communityId)
  if (!user || !isMod) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { data: story } = await admin.from('stories')
    .select('author_id, title, status').eq('id', storyId).eq('community_id', communityId).maybeSingle()
  if (!story) return { error: 'Story not found' }

  const { error } = await admin.from('stories')
    .update({ status: 'published', approved_by: user.id, published_at: new Date().toISOString() })
    .eq('id', storyId)
  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: 'story.approved', targetId: storyId, targetType: 'story' })

  if (story.author_id !== user.id) {
    void (async () => {
      const [{ data: u }, { data: c }] = await Promise.all([
        admin.auth.admin.getUserById(story.author_id),
        admin.from('communities').select('name, slug').eq('id', communityId).single(),
      ])
      const to = u.user?.email
      if (to && c) await sendEmail(to, `Your story was published in ${c.name}`, storyApprovedHtml(c.name, c.slug, storyId, story.title))
    })()
  }

  revalidate(slug, storyId)
  return {}
}

export async function rejectStory(storyId: string, communityId: string, slug: string) {
  const { user, isMod } = await caller(communityId)
  if (!user || !isMod) return { error: 'Not authorized' }

  const admin = createAdminClient()
  const { error } = await admin.from('stories')
    .update({ status: 'rejected' }).eq('id', storyId).eq('community_id', communityId)
  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: 'story.rejected', targetId: storyId, targetType: 'story' })

  revalidate(slug, storyId)
  return {}
}

/** The author can always delete their own story; mods can delete any. */
export async function deleteStory(storyId: string, communityId: string, slug: string): Promise<{ error?: string }> {
  const { user, isMod } = await caller(communityId)
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: story } = await admin.from('stories')
    .select('author_id').eq('id', storyId).eq('community_id', communityId).maybeSingle()
  if (!story) return { error: 'Story not found' }
  if (story.author_id !== user.id && !isMod) return { error: 'Not authorized' }

  // Replies and me-toos go with it (on delete cascade).
  const { error } = await admin.from('stories').delete().eq('id', storyId)
  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: 'story.deleted', targetId: storyId, targetType: 'story' })

  revalidate(slug)
  return {}
}

// ─── replies ──────────────────────────────────────────────────────────────────

export async function submitStoryReply(storyId: string, communityId: string, slug: string, formData: FormData) {
  const { user, isMember } = await caller(communityId)
  if (!user) return { error: 'Not logged in' }
  if (!isMember) return { error: 'Only members can reply' }

  const body = (formData.get('body') as string | null)?.trim() ?? ''
  if (!body) return { error: 'Please write a reply' }
  if (body.length > 4000) return { error: 'The reply is too long (4,000 characters max)' }

  const admin = createAdminClient()
  const { data: story } = await admin.from('stories')
    .select('author_id, status').eq('id', storyId).eq('community_id', communityId).maybeSingle()
  if (!story || story.status !== 'published') return { error: 'This story is not open for replies' }

  const { data: inserted, error } = await admin.from('story_replies').insert({
    story_id: storyId,
    community_id: communityId,
    author_id: user.id,
    body,
  }).select('id').single()
  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: 'story_reply.created', targetId: inserted.id, targetType: 'story_reply', metadata: { story_id: storyId } })

  // Let the author know someone answered them (not when they reply to themselves).
  // ⚠️ Must be awaited: an un-awaited Supabase query builder never runs.
  if (story.author_id !== user.id) {
    await admin.from('notifications').insert({
      user_id: story.author_id,
      type: 'story_reply',
      actor_id: user.id,
      community_id: communityId,
      message_id: storyId,
    })
  }

  revalidate(slug, storyId)
  return { id: inserted.id }
}

/** The reply's author or a mod can delete a reply. */
export async function deleteStoryReply(replyId: string, communityId: string, slug: string): Promise<{ error?: string }> {
  const { user, isMod } = await caller(communityId)
  if (!user) return { error: 'Not logged in' }

  const admin = createAdminClient()
  const { data: reply } = await admin.from('story_replies')
    .select('author_id, story_id').eq('id', replyId).eq('community_id', communityId).maybeSingle()
  if (!reply) return { error: 'Reply not found' }
  if (reply.author_id !== user.id && !isMod) return { error: 'Not authorized' }

  const { error } = await admin.from('story_replies').delete().eq('id', replyId)
  if (error) return { error: error.message }
  logAction({ actorId: user.id, communityId, action: 'story_reply.deleted', targetId: replyId, targetType: 'story_reply', metadata: { story_id: reply.story_id } })

  revalidate(slug, reply.story_id)
  return {}
}

// ─── me too ───────────────────────────────────────────────────────────────────

/** Toggle "me too". Returns whether the caller now has it on. */
export async function toggleMeToo(storyId: string, communityId: string, slug: string): Promise<{ error?: string; on?: boolean }> {
  const { user, isMember } = await caller(communityId)
  if (!user) return { error: 'Not logged in' }
  if (!isMember) return { error: 'Only members can do that' }

  const admin = createAdminClient()
  const { data: story } = await admin.from('stories')
    .select('author_id, status').eq('id', storyId).eq('community_id', communityId).maybeSingle()
  if (!story || story.status !== 'published') return { error: 'Story not found' }
  if (story.author_id === user.id) return { error: 'This is your own story' }

  const { data: existing } = await admin.from('story_metoo')
    .select('story_id').eq('story_id', storyId).eq('user_id', user.id).maybeSingle()
  if (existing) {
    const { error } = await admin.from('story_metoo').delete().eq('story_id', storyId).eq('user_id', user.id)
    if (error) return { error: error.message }
    revalidate(slug, storyId)
    return { on: false }
  }
  const { error } = await admin.from('story_metoo').insert({ story_id: storyId, user_id: user.id })
  // A double tap racing itself hits the primary key; the end state is still "on".
  if (error && error.code !== '23505') return { error: error.message }
  revalidate(slug, storyId)
  return { on: true }
}
