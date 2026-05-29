'use client'

import LinkPreview from '@/components/LinkPreview'
import { extractUrls, normalizeUrl } from '@/lib/embeds'

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/g

export default function RichContent({
  content,
  embeds = true,
  className = 'text-sm text-stone-700 break-words whitespace-pre-wrap',
  linkClassName = 'text-orange-600 hover:underline break-all',
}: {
  content: string
  embeds?: boolean
  className?: string
  linkClassName?: string
}) {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const re = new RegExp(URL_RE.source, 'g')

  while ((match = re.exec(content)) !== null) {
    const raw = match[0].replace(/[.,;:!?)\]'"]+$/, '')
    const href = normalizeUrl(raw)
    if (match.index > last) parts.push(content.slice(last, match.index))
    parts.push(
      <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {raw}
      </a>
    )
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(content.slice(last))

  const urls = embeds ? extractUrls(content) : []

  return (
    <div>
      <p className={className}>{parts}</p>
      {urls.map(url => <LinkPreview key={url} url={url} />)}
    </div>
  )
}
