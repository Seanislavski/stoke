'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type BoardQuestion = {
  id: string
  title: string
  body: string | null
  category_id: string | null
  asker_name: string | null
  asker_username: string | null
  created_at: string
  answer_count: number
  has_accepted: boolean
}

type Category = { id: string; name: string }

type Props = {
  slug: string
  questions: BoardQuestion[]
  categories: Category[]
}

export default function KnowledgeBoard({ slug, questions, categories }: Props) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all')

  const categoryName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of categories) map[c.id] = c.name
    return map
  }, [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return questions.filter(item => {
      if (activeCategory !== 'all' && item.category_id !== activeCategory) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        (item.body ?? '').toLowerCase().includes(q)
      )
    })
  }, [questions, query, activeCategory])

  return (
    <div className="space-y-4">
      {/* Search — the whole point of a knowledge base is retrieval */}
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search questions…"
        className="w-full px-4 py-2.5 border border-stone-300 rounded-lg text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('all')}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                activeCategory === c.id ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Question list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-stone-400 text-sm">
          {query || activeCategory !== 'all' ? 'No questions match your search.' : 'No questions yet. Ask the first one!'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <Link
                key={item.id}
                href={`/communities/${slug}/questions/${item.id}`}
                className="block bg-white border border-stone-200 rounded-xl p-4 hover:border-orange-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-stone-900">{item.title}</h3>
                  {item.has_accepted && (
                    <span className="shrink-0 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">✓ Answered</span>
                  )}
                </div>
                {item.body && <p className="text-stone-500 text-sm mt-1 line-clamp-2">{item.body}</p>}
                <div className="flex items-center gap-2 flex-wrap text-xs text-stone-400 mt-2">
                  {item.category_id && categoryName[item.category_id] && (
                    <span className="bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{categoryName[item.category_id]}</span>
                  )}
                  {item.asker_username && <span>{item.asker_name ?? item.asker_username}</span>}
                  <span>{date}</span>
                  <span>· {item.answer_count} {item.answer_count === 1 ? 'answer' : 'answers'}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
