// READ-ONLY. Exports a community's published Q&A library to plain files that
// outlive the platform: markdown a human can read in any text editor, plus one
// JSON file that keeps full structure for re-import.
//
// Run from repo root:
//   node scripts/export-library.mjs                        # Body Doubling -> library-export/
//   node scripts/export-library.mjs --slug some-community
//   node scripts/export-library.mjs --out D:/backups/stoke
//   node scripts/export-library.mjs --photos               # also download images
//
// WHY THIS EXISTS: the library currently lives in one Supabase project behind
// one Railway deploy under one account. That is resilient against people
// forgetting things; it is not resilient against the infrastructure going away.
// The output of this script needs nothing from Stoke, Supabase or Railway to
// still be readable in ten years.
//
// PRIVACY: published content only. Attribution is by username (or the stored
// Discord attribution string). No emails, no user IDs, no pending or rejected
// content, no member lists.
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const raw = readFileSync(join(ROOT, 'apps', 'web', '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    env[m[1]] = val
  }
  return env
}

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name)
  return i === -1 ? fallback : process.argv[i + 1]
}
const WANT_PHOTOS = process.argv.includes('--photos')
const SLUG = arg('slug', 'bodydoublingcom')
const OUT = arg('out', join(ROOT, 'library-export'))

const env = loadEnv()
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- helpers ---------------------------------------------------------------

// Filenames must survive Windows, macOS and Linux, and stay recognisable.
function slugify(s, max = 60) {
  return (
    (s || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max) || 'untitled'
  )
}
const day = (ts) => (ts || '').slice(0, 10)

// --- fetch -----------------------------------------------------------------

const { data: community, error: cErr } = await admin
  .from('communities')
  .select('id, name, slug, description, created_at')
  .eq('slug', SLUG)
  .single()
if (cErr || !community) throw new Error(`No community with slug "${SLUG}": ${cErr?.message ?? 'not found'}`)
const CID = community.id

const [{ data: cats }, { data: questions }, { data: answers }, { data: bank }] = await Promise.all([
  admin.from('kb_categories').select('id, name, description, position').eq('community_id', CID).order('position'),
  admin
    .from('kb_questions')
    .select('id, title, body, category_id, asker_id, published_at, created_at, is_public, photos')
    .eq('community_id', CID)
    .eq('status', 'published'),
  admin
    .from('kb_answers')
    .select('id, question_id, body, url, author_id, is_accepted, attribution, published_at, created_at, photos')
    .eq('community_id', CID)
    .eq('status', 'published'),
  admin.from('qotw_items').select('question_id, number').eq('community_id', CID).not('number', 'is', null),
])

// Attribution map. profiles.id is the PK the kb_* tables reference (NOT user_id).
const authorIds = [...new Set([...questions.map((q) => q.asker_id), ...answers.map((a) => a.author_id)].filter(Boolean))]
const nameById = {}
for (let i = 0; i < authorIds.length; i += 200) {
  const { data } = await admin.from('profiles').select('id, username, display_name').in('id', authorIds.slice(i, i + 200))
  for (const p of data ?? []) nameById[p.id] = p.display_name || p.username || '(unknown)'
}
// Deliberately not exported: emails, user ids, anything identifying beyond the
// name the member already shows publicly on their profile.
const who = (id, attribution) => attribution || nameById[id] || '(unknown)'

const qotwByQuestion = Object.fromEntries((bank ?? []).map((b) => [b.question_id, b.number]))
const catById = Object.fromEntries((cats ?? []).map((c) => [c.id, c]))
const catName = (id) => catById[id]?.name ?? '(uncategorised)'

const answersFor = (qid) =>
  answers
    .filter((a) => a.question_id === qid)
    .sort((a, b) => Number(b.is_accepted) - Number(a.is_accepted) || (a.created_at || '').localeCompare(b.created_at || ''))

const ordered = [...questions].sort(
  (a, b) =>
    catName(a.category_id).localeCompare(catName(b.category_id)) ||
    (a.published_at || a.created_at || '').localeCompare(b.published_at || b.created_at || ''),
)

// --- write -----------------------------------------------------------------

mkdirSync(join(OUT, 'questions'), { recursive: true })
const exportedAt = new Date().toISOString()
const fileFor = {}
ordered.forEach((q, i) => {
  const n = qotwByQuestion[q.id]
  fileFor[q.id] = `${String(i + 1).padStart(3, '0')}-${n ? `qotw-${n}-` : ''}${slugify(q.title)}.md`
})

const photoJobs = []
function photoLines(photos, label) {
  if (!photos?.length) return []
  return photos.map((url, i) => {
    if (!WANT_PHOTOS) return `![${label} image ${i + 1}](${url})`
    const name = `${label}-${i + 1}${(url.match(/\.(png|jpe?g|gif|webp)/i) || ['.jpg'])[0]}`
    photoJobs.push({ url, name })
    return `![${label} image ${i + 1}](../photos/${name})`
  })
}

for (const q of ordered) {
  const n = qotwByQuestion[q.id]
  const as = answersFor(q.id)
  const L = []
  L.push(`# ${n ? `QotW-${n}: ` : ''}${q.title}`)
  L.push('')
  L.push(`*${catName(q.category_id)} · asked by ${who(q.asker_id)} · published ${day(q.published_at || q.created_at)}*`)
  L.push('')
  if (q.body) L.push(q.body, '')
  L.push(...photoLines(q.photos, `question-${slugify(q.title, 30)}`))
  if (q.photos?.length) L.push('')
  L.push(as.length ? `## ${as.length} answer${as.length === 1 ? '' : 's'}` : '## No answers yet')
  L.push('')
  for (const a of as) {
    L.push(`### ${a.is_accepted ? '✅ ' : ''}${who(a.author_id, a.attribution)}`)
    L.push('')
    if (a.body) L.push(a.body, '')
    if (a.url) L.push(`Link: ${a.url}`, '')
    L.push(...photoLines(a.photos, `answer-${a.id.slice(0, 8)}`))
    if (a.photos?.length) L.push('')
  }
  writeFileSync(join(OUT, 'questions', fileFor[q.id]), L.join('\n'), 'utf8')
}

// Index — the entry point for a human who finds this folder with no context.
const idx = []
idx.push(`# ${community.name} — Q&A library`)
idx.push('')
if (community.description) idx.push(community.description, '')
idx.push(
  `Exported from Stoke Community on ${exportedAt.slice(0, 10)}. ` +
    `${ordered.length} published questions, ${answers.length} published answers.`,
)
idx.push('')
idx.push(
  'These are plain markdown files. They need no software, no account and no ' +
    'internet connection to read — open them in any text editor. `library.json` ' +
    'holds the same content with its structure intact, for re-importing elsewhere.',
)
idx.push('')
for (const c of cats ?? []) {
  const inCat = ordered.filter((q) => q.category_id === c.id)
  if (!inCat.length) continue
  idx.push(`## ${c.name}`)
  if (c.description) idx.push('', `*${c.description}*`)
  idx.push('')
  for (const q of inCat) {
    const n = qotwByQuestion[q.id]
    idx.push(`- [${n ? `QotW-${n}: ` : ''}${q.title}](questions/${fileFor[q.id]}) — ${answersFor(q.id).length} answers`)
  }
  idx.push('')
}
const uncat = ordered.filter((q) => !catById[q.category_id])
if (uncat.length) {
  idx.push('## Uncategorised', '')
  for (const q of uncat) idx.push(`- [${q.title}](questions/${fileFor[q.id]}) — ${answersFor(q.id).length} answers`)
  idx.push('')
}
writeFileSync(join(OUT, 'index.md'), idx.join('\n'), 'utf8')

writeFileSync(
  join(OUT, 'library.json'),
  JSON.stringify(
    {
      exported_at: exportedAt,
      source: 'Stoke Community',
      community: { name: community.name, slug: community.slug, description: community.description },
      note: 'Published content only, attributed by display name or username. No emails or user IDs.',
      categories: (cats ?? []).map(({ id, ...c }) => ({ ...c, id })),
      questions: ordered.map((q) => ({
        id: q.id,
        qotw_number: qotwByQuestion[q.id] ?? null,
        title: q.title,
        body: q.body,
        category: catName(q.category_id),
        asked_by: who(q.asker_id),
        published_at: q.published_at,
        is_public: q.is_public,
        photos: q.photos ?? [],
        answers: answersFor(q.id).map((a) => ({
          body: a.body,
          url: a.url,
          answered_by: who(a.author_id, a.attribution),
          is_accepted: a.is_accepted,
          published_at: a.published_at,
          photos: a.photos ?? [],
        })),
      })),
    },
    null,
    2,
  ),
  'utf8',
)

if (WANT_PHOTOS && photoJobs.length) {
  mkdirSync(join(OUT, 'photos'), { recursive: true })
  let ok = 0
  for (const job of photoJobs) {
    try {
      const res = await fetch(job.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      writeFileSync(join(OUT, 'photos', job.name), Buffer.from(await res.arrayBuffer()))
      ok++
    } catch (e) {
      console.warn(`  ! photo failed (${job.name}): ${e.message}`)
    }
  }
  console.log(`photos: ${ok}/${photoJobs.length} downloaded`)
}

console.log(`\nExported "${community.name}" to ${OUT}`)
console.log(`  ${ordered.length} questions, ${answers.length} answers, ${(cats ?? []).length} categories`)
console.log(`  index.md · questions/ · library.json${WANT_PHOTOS ? ' · photos/' : ''}`)
if (!WANT_PHOTOS) console.log('  (image links still point at Supabase — rerun with --photos to pull them local)')
