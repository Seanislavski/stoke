import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const alt = 'Stoke Community'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const supabase = createAdminClient()
  const { data: community } = await supabase
    .from('communities')
    .select('name, description')
    .eq('slug', slug)
    .single()

  const name = community?.name ?? 'Community'
  const description = community?.description ?? 'A reciprocal community on Stoke.'

  const truncatedDescription =
    description.length > 80 ? description.slice(0, 80).trimEnd() + '…' : description

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#1c1917',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          position: 'relative',
        }}
      >
        {/* Orange bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '6px',
            background: '#f97316',
          }}
        />

        {/* Top: Stoke branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="32" height="36" viewBox="0 0 32 36" fill="none">
            <path
              d="M16 2C13.5 6 9 10.5 8 16.5C7 21.5 9 27 12.5 30C11 26.5 11.5 22.5 13.5 20C13 23 14 26 16 28C18 26 19 23 18.5 20C20.5 22.5 21 26.5 19.5 30C23 27 25 21.5 24 16.5C23 10.5 18.5 6 16 2Z"
              fill="#f97316"
            />
            <path
              d="M16 16C14.8 18 14 20 14 22C14 24.2 14.9 26 16 26C17.1 26 18 24.2 18 22C18 20 17.2 18 16 16Z"
              fill="#fed7aa"
            />
          </svg>
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: '28px',
              fontWeight: '700',
              color: '#78716c',
              letterSpacing: '-0.5px',
            }}
          >
            Stoke Community
          </span>
        </div>

        {/* Middle: Community name + description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h1
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: name.length > 24 ? '60px' : '72px',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0',
              letterSpacing: '-2px',
              lineHeight: '1.1',
            }}
          >
            {name}
          </h1>
          {truncatedDescription && (
            <p
              style={{
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                fontSize: '24px',
                color: '#a8a29e',
                margin: '0',
                lineHeight: '1.4',
              }}
            >
              {truncatedDescription}
            </p>
          )}
        </div>

        {/* Bottom: orange label */}
        <p
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: '20px',
            color: '#f97316',
            margin: '0',
          }}
        >
          stoke.community
        </p>
      </div>
    ),
    { ...size }
  )
}
