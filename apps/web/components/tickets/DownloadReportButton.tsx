'use client'

import { useState } from 'react'
import { getTicketReportData } from '@/app/actions/tickets'

type Period = 7 | 30 | 90
type Community = { id: string; name: string }

type Props = {
  communities?: Community[]   // if provided, show community dropdown
  defaultCommunityId?: string // pre-select a specific community
}

function fmtHours(h: number | null): string {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${(h / 24).toFixed(1)}d`
}

export default function DownloadReportButton({ communities, defaultCommunityId }: Props) {
  const [period, setPeriod] = useState<Period>(30)
  const [communityId, setCommunityId] = useState<string>(defaultCommunityId ?? '')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const data = await getTicketReportData(period, communityId || null)
      const CATEGORY_LABELS = data.categoryLabels

      // Dynamic import so jspdf doesn't bloat the server bundle
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const margin = 16

      // Header
      doc.setFontSize(18)
      doc.setTextColor(28, 25, 23)
      doc.text('Support Ticket Report', margin, 22)

      doc.setFontSize(10)
      doc.setTextColor(120, 113, 108)
      const scopeLabel = data.communityName ? `Community: ${data.communityName}` : 'Platform — all tickets'
      doc.text(`${scopeLabel}  ·  Last ${period} days`, margin, 30)
      doc.text(`Generated ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`, margin, 36)

      // Summary boxes
      const summaryY = 44
      const boxW = (W - margin * 2 - 9) / 4
      const boxes = [
        { label: 'Total tickets', value: String(data.total) },
        { label: 'Resolved / closed', value: String(data.resolved) },
        { label: 'Avg resolution time', value: fmtHours(data.avgResolutionHours) },
        { label: 'Currently open', value: String(data.open) },
      ]
      boxes.forEach((box, i) => {
        const x = margin + i * (boxW + 3)
        doc.setFillColor(250, 250, 249)
        doc.setDrawColor(214, 211, 208)
        doc.roundedRect(x, summaryY, boxW, 18, 2, 2, 'FD')
        doc.setFontSize(14)
        doc.setTextColor(28, 25, 23)
        doc.text(box.value, x + boxW / 2, summaryY + 9, { align: 'center' })
        doc.setFontSize(7)
        doc.setTextColor(120, 113, 108)
        doc.text(box.label, x + boxW / 2, summaryY + 14, { align: 'center' })
      })

      // Median row
      doc.setFontSize(9)
      doc.setTextColor(120, 113, 108)
      doc.text(`Median resolution time: ${fmtHours(data.medianResolutionHours)}  ·  Based on ${data.resolved} resolved/closed ticket${data.resolved !== 1 ? 's' : ''} in period`, margin, summaryY + 24)

      // Category breakdown table
      autoTable(doc, {
        startY: summaryY + 30,
        head: [['Category', 'Tickets', 'Avg resolution time']],
        body: data.byCategory.map(row => [
          CATEGORY_LABELS[row.category] ?? row.category,
          row.count,
          fmtHours(row.avgHours),
        ]),
        headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [28, 25, 23] },
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
        margin: { left: margin, right: margin },
        theme: 'striped',
        didDrawPage: () => {},
      })

      // Oldest open tickets
      if (data.oldestOpen.length > 0) {
        const afterTable = (doc as InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
        doc.setFontSize(11)
        doc.setTextColor(28, 25, 23)
        doc.text('Oldest open tickets', margin, afterTable)

        autoTable(doc, {
          startY: afterTable + 4,
          head: [['Subject', 'Category', 'Status', 'Age']],
          body: data.oldestOpen.map(t => [
            t.title.length > 55 ? t.title.slice(0, 52) + '…' : t.title,
            CATEGORY_LABELS[t.category] ?? t.category,
            t.status.replace('_', ' '),
            fmtHours(t.ageHours),
          ]),
          headStyles: { fillColor: [87, 83, 78], textColor: 255, fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: [28, 25, 23] },
          columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' } },
          margin: { left: margin, right: margin },
          theme: 'striped',
        })
      }

      const scopeSlug = data.communityName
        ? data.communityName.toLowerCase().replace(/\s+/g, '-')
        : 'platform'
      doc.save(`stoke-support-report-${scopeSlug}-${period}d.pdf`)
      setDone(true)
      setTimeout(() => setDone(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {communities && communities.length > 1 && (
        <select
          value={communityId}
          onChange={e => setCommunityId(e.target.value)}
          className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none"
        >
          {communities.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      <select
        value={period}
        onChange={e => setPeriod(Number(e.target.value) as Period)}
        className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none"
      >
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </select>
      <button
        onClick={handleDownload}
        disabled={loading || (!!communities && communities.length > 1 && !communityId)}
        className={`text-xs px-3 py-1.5 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${done ? 'bg-green-600' : 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700'}`}
      >
        {loading && (
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        )}
        {loading ? 'Building report…' : done ? '✓ Downloaded' : 'Download report'}
      </button>
    </div>
  )
}
