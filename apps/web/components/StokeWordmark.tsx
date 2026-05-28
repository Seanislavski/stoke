import { fraunces } from '@/lib/fonts'

function CampfireIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 44 48"
      width={size}
      height={size * (48 / 44)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left flame tongue — shorter, leans left */}
      <path
        d="M15 34C12 28 10 21 13 13C14 19 15 25 15 34Z"
        fill="#fb923c"
      />
      {/* Right flame tongue — medium, leans right */}
      <path
        d="M29 34C29 25 30 19 31 13C34 21 32 28 29 34Z"
        fill="#fb923c"
      />
      {/* Center flame — tallest, main body */}
      <path
        d="M22 34C17 24 16 15 22 3C28 15 27 24 22 34Z"
        fill="#f97316"
      />
      {/* Inner amber glow */}
      <path
        d="M22 28C20 22 20 16 22 9C24 16 24 22 22 28Z"
        fill="#fcd34d"
      />
      {/* Log 1 — angled lower-left to upper-right */}
      <rect
        x="5" y="34" width="26" height="9" rx="4.5"
        fill="#92400e"
        transform="rotate(-22 18 38.5)"
      />
      {/* Log end cap (left) */}
      <ellipse cx="7" cy="36" rx="4" ry="4.5" fill="#78350f" transform="rotate(-22 7 36)" />
      {/* Log 2 — angled lower-right to upper-left */}
      <rect
        x="13" y="34" width="26" height="9" rx="4.5"
        fill="#a16207"
        transform="rotate(22 26 38.5)"
      />
      {/* Log end cap (right) */}
      <ellipse cx="37" cy="36" rx="4" ry="4.5" fill="#854d0e" transform="rotate(22 37 36)" />
      {/* Ember glow at base */}
      <ellipse cx="22" cy="41" rx="10" ry="4" fill="#b45309" opacity="0.6" />
    </svg>
  )
}

export default function StokeWordmark({
  iconSize = 40,
  showText = true,
}: {
  iconSize?: number
  showText?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <CampfireIcon size={iconSize} />
      {showText && (
        <span
          className={`${fraunces.className} text-stone-900 leading-none`}
          style={{ fontSize: iconSize * 0.72, letterSpacing: '-0.02em' }}
        >
          Stoke
        </span>
      )}
    </div>
  )
}
