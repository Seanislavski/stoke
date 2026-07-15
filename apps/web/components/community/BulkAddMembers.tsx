'use client'

import { useState, useTransition } from 'react'
import { bulkAddMembers, type BulkResult } from '@/app/actions/bulk-members'

type Row = { username: string; email: string; password: string }

const BLANK: Row = { username: '', email: '', password: '' }
const START_ROWS = 6

function emptyRows(n: number): Row[] {
  return Array.from({ length: n }, () => ({ ...BLANK }))
}

export default function BulkAddMembers({
  communityId,
  slug,
  communityName,
}: {
  communityId: string
  slug: string
  communityName: string
}) {
  const [rows, setRows] = useState<Row[]>(() => emptyRows(START_ROWS))
  const [sharedPassword, setSharedPassword] = useState('')
  const [results, setResults] = useState<BulkResult[] | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const resultByEmail = new Map((results ?? []).map((r) => [r.email.toLowerCase(), r]))

  function setCell(rowIdx: number, key: keyof Row, value: string) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r))
      // Auto-grow: typing in the last row adds a fresh blank row.
      if (rowIdx === next.length - 1 && value.trim() !== '') next.push({ ...BLANK })
      return next
    })
  }

  function removeRow(idx: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length ? next : emptyRows(1)
    })
  }

  function addRows(n = 3) {
    setRows((prev) => [...prev, ...emptyRows(n)])
  }

  function applySharedPassword() {
    if (!sharedPassword) return
    setRows((prev) => prev.map((r) => (r.email.trim() || r.username.trim() ? { ...r, password: sharedPassword } : r)))
  }

  // Paste a block from Excel/Sheets: tab-separated columns, newline rows.
  function handlePaste(e: React.ClipboardEvent, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData('text/plain')
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return // let single-cell paste work normally
    e.preventDefault()
    const cols: (keyof Row)[] = ['username', 'email', 'password']
    const lines = text.replace(/\r/g, '').split('\n').filter((l, i, arr) => l !== '' || i < arr.length - 1)
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }))
      lines.forEach((line, li) => {
        const cells = line.split('\t')
        const target = rowIdx + li
        while (next.length <= target) next.push({ ...BLANK })
        cells.forEach((cell, ci) => {
          const key = cols[colIdx + ci]
          if (key) next[target][key] = cell.trim()
        })
      })
      // keep a trailing blank row
      const last = next[next.length - 1]
      if (last.username || last.email || last.password) next.push({ ...BLANK })
      return next
    })
  }

  function submit() {
    setError('')
    setResults(null)
    const filled = rows.filter((r) => r.email.trim() || r.username.trim())
    if (filled.length === 0) {
      setError('Add at least one person.')
      return
    }
    // Fill any blank passwords from the shared password before sending.
    const payload = filled.map((r) => ({
      username: r.username.trim(),
      email: r.email.trim(),
      password: (r.password || sharedPassword).trim(),
    }))
    startTransition(async () => {
      const res = await bulkAddMembers(communityId, slug, payload)
      if (res.error) {
        setError(res.error)
        return
      }
      setResults(res.results ?? [])
    })
  }

  const summary = results
    ? {
        created: results.filter((r) => r.status === 'created').length,
        added: results.filter((r) => r.status === 'added').length,
        already: results.filter((r) => r.status === 'already_member').length,
        errors: results.filter((r) => r.status === 'error').length,
      }
    : null

  return (
    <div className="space-y-5">
      {/* Shared password helper */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <label className="block text-sm font-medium text-stone-700 mb-1">Shared temporary password</label>
        <p className="text-xs text-stone-500 mb-2">
          Fill this once and it applies to everyone. Tell members to change it under Settings after they log in.
          You can also override any individual row.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={sharedPassword}
            onChange={(e) => setSharedPassword(e.target.value)}
            placeholder="e.g. Grace2026!"
            className="flex-1 min-w-[180px] rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
          />
          <button
            type="button"
            onClick={applySharedPassword}
            className="rounded-md bg-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-300"
          >
            Apply to all rows
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-2 py-2">Username</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Password</th>
              <th className="px-2 py-2">Status</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const res = row.email.trim() ? resultByEmail.get(row.email.trim().toLowerCase()) : undefined
              return (
                <tr key={i} className="border-t border-stone-100">
                  <td className="px-2 py-1 text-center text-xs text-stone-400">{i + 1}</td>
                  <td className="px-1 py-1">
                    <input
                      value={row.username}
                      onChange={(e) => setCell(i, 'username', e.target.value)}
                      onPaste={(e) => handlePaste(e, i, 0)}
                      placeholder="firstname"
                      className="w-full rounded border border-transparent px-2 py-1.5 text-stone-900 focus:border-stone-300 focus:bg-white hover:bg-stone-50"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="email"
                      value={row.email}
                      onChange={(e) => setCell(i, 'email', e.target.value)}
                      onPaste={(e) => handlePaste(e, i, 1)}
                      placeholder="name@email.com"
                      className="w-full rounded border border-transparent px-2 py-1.5 text-stone-900 focus:border-stone-300 focus:bg-white hover:bg-stone-50"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={row.password}
                      onChange={(e) => setCell(i, 'password', e.target.value)}
                      onPaste={(e) => handlePaste(e, i, 2)}
                      placeholder={sharedPassword ? '(shared)' : 'password'}
                      className="w-full rounded border border-transparent px-2 py-1.5 text-stone-900 focus:border-stone-300 focus:bg-white hover:bg-stone-50"
                    />
                  </td>
                  <td className="px-2 py-1 text-xs">
                    {res ? (
                      <span
                        className={
                          res.status === 'error'
                            ? 'text-red-600'
                            : res.status === 'already_member'
                              ? 'text-stone-500'
                              : 'text-green-600'
                        }
                      >
                        {res.status === 'created' && '✓ Created'}
                        {res.status === 'added' && '✓ Added'}
                        {res.status === 'already_member' && '• Member'}
                        {res.status === 'error' && `✗ ${res.message ?? 'Error'}`}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-stone-300 hover:text-red-500"
                      title="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => addRows(3)}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          + Add rows
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {pending ? 'Adding…' : `Add ${communityName} members`}
        </button>
        <p className="text-xs text-stone-400">Tip: paste columns straight from a spreadsheet.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
          <p className="font-medium text-stone-800">Done.</p>
          <ul className="mt-1 space-y-0.5 text-stone-600">
            {summary.created > 0 && <li>✓ {summary.created} new account{summary.created === 1 ? '' : 's'} created and joined</li>}
            {summary.added > 0 && <li>✓ {summary.added} existing account{summary.added === 1 ? '' : 's'} added</li>}
            {summary.already > 0 && <li>• {summary.already} already a member</li>}
            {summary.errors > 0 && <li className="text-red-600">✗ {summary.errors} row{summary.errors === 1 ? '' : 's'} had errors (see the Status column)</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
