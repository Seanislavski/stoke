function FlameIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 38"
      width={size}
      height={Math.round(size * (38 / 32))}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer flame body — two organic peaks, wider base */}
      <path
        d="M11 5C13 1 15 7 16 11C17 7 19 0 21 3C24 7 26 15 25 22C24 28 22 31 20 34C19 37 13 37 12 34C10 31 8 28 7 22C6 15 8 7 11 5Z"
        fill="#f97316"
      />
      {/* Amber inner glow */}
      <path
        d="M16 14C14 18 13 22 13 26C13 30 14.5 33 16 33C17.5 33 19 30 19 26C19 22 18 18 16 14Z"
        fill="#fbbf24"
      />
      {/* Light core */}
      <path
        d="M16 21C15.2 23 15 25 15 27C15 29 15.5 31 16 31C16.5 31 17 29 17 27C17 25 16.8 23 16 21Z"
        fill="#fef9c3"
      />
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
      <FlameIcon size={iconSize} />
      {showText && (
        <span
          className="font-sans font-bold text-stone-900 leading-none"
          style={{ fontSize: iconSize * 0.72, letterSpacing: '-0.02em' }}
        >
          Stoke
        </span>
      )}
    </div>
  )
}
