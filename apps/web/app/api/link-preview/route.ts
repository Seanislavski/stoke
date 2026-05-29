import { NextRequest, NextResponse } from 'next/server'

function getMeta(html: string, prop: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i'
  )
  const m = html.match(pattern)
  return m ? (m[1] ?? m[2] ?? null) : null
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StokeBot/1.0; +https://stoke.community)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) {
      return NextResponse.json({ error: 'Not HTML' }, { status: 422 })
    }

    // Read only the first 50KB to avoid huge pages
    const reader = res.body?.getReader()
    if (!reader) return NextResponse.json({ error: 'No body' }, { status: 422 })
    let html = ''
    while (html.length < 50000) {
      const { done, value } = await reader.read()
      if (done) break
      html += new TextDecoder().decode(value)
    }
    reader.cancel()

    const title =
      getMeta(html, 'og:title') ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      null
    const description = getMeta(html, 'og:description') || getMeta(html, 'description') || null
    let image = getMeta(html, 'og:image') || null

    // Resolve relative image URL
    if (image && !image.startsWith('http')) {
      try { image = new URL(image, url).toString() } catch { image = null }
    }

    const domain = new URL(url).hostname.replace(/^www\./, '')

    return NextResponse.json(
      { title, description, image, url, domain },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
    )
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }
}
