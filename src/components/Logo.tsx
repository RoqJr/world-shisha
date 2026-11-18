/** Logo: o W forma o corpo do rosh e o S sobe como fumaça. Usa a cor do texto. */
export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="40 30 432 440" width={size} height={size} className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M292 62c-26-16-66-6-62 20 4 24 58 18 58 46 0 28-42 34-64 16" strokeWidth="22" />
        <path d="M124 214h264" strokeWidth="30" />
        <path d="M150 214l52 150 54-112 54 112 52-150" strokeWidth="30" />
        <path d="M202 382h108" strokeWidth="22" />
        <path d="M256 382v52M220 446h72" strokeWidth="22" />
      </g>
    </svg>
  )
}
