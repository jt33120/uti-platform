import { useId } from 'react'

/* UTI loader — "orbital scan".
   Two counter-rotating arcs in the brand indigo ramp around a breathing
   core, over a hairline track: the outer arc sweeps with a non-linear ease
   so it reads as a radar pass rather than a generic spinner. Pure SVG +
   CSS transforms (GPU-friendly), theme-aware via the design tokens, and
   static under prefers-reduced-motion. */
export default function UTILoader({ size = 44, label, className = '' }) {
  // useId() emits ":r0:" — strip the colons so url(#…) stays a valid ref
  const gradId = `uti-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const svg = (
    <svg
      width={size} height={size} viewBox="0 0 48 48" fill="none"
      role="status" aria-label={label || 'Chargement'} className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4338ca" />
          <stop offset="60%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
      </defs>
      {/* hairline track */}
      <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="3" />
      {/* main sweep — gradient tail, comet head from the round cap */}
      <circle
        className="uti-loader-arc" cx="24" cy="24" r="20"
        stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round"
        strokeDasharray="78 47.66"
      />
      {/* inner counter-sweep — quieter, half tone */}
      <circle
        className="uti-loader-arc-rev" cx="24" cy="24" r="12.5"
        stroke="var(--accent)" strokeOpacity="0.45" strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray="26 52.54"
      />
      {/* breathing core */}
      <circle className="uti-loader-core" cx="24" cy="24" r="3.2" fill="var(--accent)" />
    </svg>
  )

  if (!label) return svg
  return (
    <div className="flex flex-col items-center gap-2.5">
      {svg}
      <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{label}</div>
    </div>
  )
}

/* Drop-in placeholder for a ChartCard while its data loads —
   same footprint as the chart it replaces, so nothing jumps. */
export function ChartLoader({ height = 188, label = 'Chargement des données…' }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <UTILoader size={40} label={label} />
    </div>
  )
}
