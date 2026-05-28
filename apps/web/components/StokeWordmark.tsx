function FlameIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="325 125 150 200"
      width={size}
      height={Math.round(size * (200 / 150))}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="flameBase" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ad3a18" />
          <stop offset="100%" stopColor="#d95d26" />
        </linearGradient>
        <linearGradient id="flameCore" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#e67e22" />
          <stop offset="50%" stopColor="#f39c12" />
          <stop offset="100%" stopColor="#f1c40f" />
        </linearGradient>
        <linearGradient id="flameTop" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#f1c40f" />
          <stop offset="100%" stopColor="#fff0aa" />
        </linearGradient>
      </defs>
      <g transform="translate(0, 10)">
        {/* Wide rounded base */}
        <path d="M 330,270 C 330,310 470,310 470,270 C 470,240 440,230 400,230 C 360,230 330,240 330,270 Z" fill="url(#flameBase)" />
        {/* Main flame body */}
        <path d="M 350,260 C 350,295 450,295 450,260 C 450,210 415,180 415,150 C 415,190 385,200 350,260 Z" fill="url(#flameCore)" />
        {/* Bright inner core */}
        <path d="M 375,250 C 375,275 425,275 425,250 C 425,210 400,190 400,165 C 400,195 375,210 375,250 Z" fill="url(#flameTop)" />
        {/* Spark droplets */}
        <path d="M 396,140 C 396,145 404,145 404,140 C 404,130 400,125 400,120 C 400,125 396,130 396,140 Z" fill="#f1c40f" />
        <path d="M 416,160 C 416,163 422,163 422,160 C 422,153 419,150 419,146 C 419,150 416,153 416,160 Z" fill="#f39c12" />
      </g>
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
