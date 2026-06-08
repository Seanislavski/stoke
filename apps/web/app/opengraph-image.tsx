import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Stoke Community'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#1c1917',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
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

        {/* Flame + Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          {/* Flame SVG */}
          <svg width="56" height="56" viewBox="0 0 32 36" fill="none">
            <path
              d="M16 2C13.5 6 9 10.5 8 16.5C7 21.5 9 27 12.5 30C11 26.5 11.5 22.5 13.5 20C13 23 14 26 16 28C18 26 19 23 18.5 20C20.5 22.5 21 26.5 19.5 30C23 27 25 21.5 24 16.5C23 10.5 18.5 6 16 2Z"
              fill="#f97316"
            />
            <path
              d="M16 16C14.8 18 14 20 14 22C14 24.2 14.9 26 16 26C17.1 26 18 24.2 18 22C18 20 17.2 18 16 16Z"
              fill="#fed7aa"
            />
          </svg>
          {/* Wordmark */}
          <span
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: '72px',
              fontWeight: '700',
              color: '#ffffff',
              letterSpacing: '-2px',
            }}
          >
            Stoke
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: '28px',
            fontWeight: '400',
            color: '#f97316',
            margin: '0',
            letterSpacing: '-0.5px',
          }}
        >
          Build communities where everyone gives and receives.
        </p>

        {/* Domain */}
        <p
          style={{
            position: 'absolute',
            bottom: '28px',
            right: '48px',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: '18px',
            color: '#78716c',
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
