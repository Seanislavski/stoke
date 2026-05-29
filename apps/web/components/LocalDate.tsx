'use client'

export default function LocalDate({ ts, dateOnly = false }: { ts: string; dateOnly?: boolean }) {
  const options: Intl.DateTimeFormatOptions = dateOnly
    ? { month: 'numeric', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  return <>{new Date(ts).toLocaleDateString('en-US', options)}</>
}
