// Community growth milestones — the single list of thresholds and their colours.
//
// Colours are shown on a community's OWN page only, never in the directory: on
// its own page a colour celebrates how far a community has come; side by side
// in a listing it would rank communities against each other, and make the small
// ones — the ones that most need members — look lesser. (Decided 09/21/2026.)
//
// ⚠️ The thresholds are duplicated in the backfill of
// supabase/migrations/20260921000000_community_milestones.sql. Adding one here
// does not backfill it; it is simply recorded the next time it is crossed.
//
// Class strings are written out in full so Tailwind's scanner keeps them.

export type Milestone = {
  threshold: number
  ring: string   // ring around the community avatar
  chip: string   // badge background + text
  bar: string    // progress bar fill
}

export const MILESTONES: Milestone[] = [
  { threshold: 10,    ring: 'ring-lime-400',    chip: 'bg-lime-100 text-lime-800',       bar: 'bg-lime-400' },
  { threshold: 25,    ring: 'ring-emerald-400', chip: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-400' },
  { threshold: 50,    ring: 'ring-teal-400',    chip: 'bg-teal-100 text-teal-800',       bar: 'bg-teal-400' },
  { threshold: 100,   ring: 'ring-sky-400',     chip: 'bg-sky-100 text-sky-800',         bar: 'bg-sky-400' },
  { threshold: 250,   ring: 'ring-blue-500',    chip: 'bg-blue-100 text-blue-800',       bar: 'bg-blue-500' },
  { threshold: 500,   ring: 'ring-violet-500',  chip: 'bg-violet-100 text-violet-800',   bar: 'bg-violet-500' },
  { threshold: 1000,  ring: 'ring-fuchsia-500', chip: 'bg-fuchsia-100 text-fuchsia-800', bar: 'bg-fuchsia-500' },
  { threshold: 2500,  ring: 'ring-rose-500',    chip: 'bg-rose-100 text-rose-800',       bar: 'bg-rose-500' },
  { threshold: 5000,  ring: 'ring-orange-500',  chip: 'bg-orange-100 text-orange-800',   bar: 'bg-orange-500' },
  { threshold: 10000, ring: 'ring-amber-400',   chip: 'bg-amber-100 text-amber-800',     bar: 'bg-amber-400' },
]

// How long the "we just reached N" banner stays up.
export const CELEBRATION_DAYS = 7

export type MilestoneRow = { threshold: number; reached_at: string; backfilled: boolean }

export function milestoneFor(threshold: number): Milestone | undefined {
  return MILESTONES.find(m => m.threshold === threshold)
}

// The first milestone above `count`, or null past the last one.
export function nextMilestone(count: number): Milestone | null {
  return MILESTONES.find(m => m.threshold > count) ?? null
}

export function formatThreshold(n: number): string {
  return n.toLocaleString('en-US')
}
