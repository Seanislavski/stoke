import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Stoke Community'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function Flame({ size: s = 80 }: { size?: number }) {
  const h = Math.round(s * (200 / 150))
  return (
    <svg viewBox="325 125 150 200" width={s} height={h} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="og-flameBase" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ad3a18" />
          <stop offset="100%" stopColor="#d95d26" />
        </linearGradient>
        <linearGradient id="og-flameCore" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#e67e22" />
          <stop offset="50%" stopColor="#f39c12" />
          <stop offset="100%" stopColor="#f1c40f" />
        </linearGradient>
        <linearGradient id="og-flameTop" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#f1c40f" />
          <stop offset="100%" stopColor="#fff0aa" />
        </linearGradient>
      </defs>
      <g transform="translate(0, 10)">
        <path d="M 330,270 C 330,310 470,310 470,270 C 470,240 440,230 400,230 C 360,230 330,240 330,270 Z" fill="url(#og-flameBase)" />
        <path d="M 350,260 C 350,295 450,295 450,260 C 450,210 415,180 415,150 C 415,190 385,200 350,260 Z" fill="url(#og-flameCore)" />
        <path d="M 375,250 C 375,275 425,275 425,250 C 425,210 400,190 400,165 C 400,195 375,210 375,250 Z" fill="url(#og-flameTop)" />
        <path d="M 396,140 C 396,145 404,145 404,140 C 404,130 400,125 400,120 C 400,125 396,130 396,140 Z" fill="#f1c40f" />
        <path d="M 416,160 C 416,163 422,163 422,160 C 422,153 419,150 419,146 C 419,150 416,153 416,160 Z" fill="#f39c12" />
      </g>
    </svg>
  )
}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <Flame size={80} />
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
