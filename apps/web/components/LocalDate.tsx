'use client'

export default function LocalDate({ ts }: { ts: string }) {
  return (
    <>
      {new Date(ts).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}
    </>
  )
}
