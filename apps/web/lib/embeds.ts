export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i.test(url)
}

export function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  return match?.[1] ?? null
}

export function extractUrls(text: string): string[] {
  const raw = text.match(/https?:\/\/[^\s<>"']+/g) ?? []
  const trimmed = raw.map(u => u.replace(/[.,;:!?)\]'"]+$/, ''))
  return [...new Set(trimmed)].filter(Boolean)
}
