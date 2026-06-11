import { useId } from 'react'

/* UTI loader — "Orbital scan" signature spinner.
   A luminous comet-arc sweeps the hairline track with a non-linear ease
   (a radar pass, not a spin), a thinner arc counter-rotates inside it at
   exactly 2× the period so the whole composition loops seamlessly, the
   core breathes in sync, and three faint dots on the track flash exactly
   as the comet head passes over them — the "found a match" beat.
   Pure SVG + CSS keyframes (transform/opacity only → GPU-composited),
   theme-aware via the design tokens, frozen to a static 270° arc under
   prefers-reduced-motion. Cycle tunable via --uti-dur (default 1.1s).
   Keyframes live in index.css. */
export default function UTILoader({ size = 44, label, className = '' }) {
  // useId() emits ":r0:" — strip the colons so url(#…) stays a valid ref.
  // One gradient per instance: with a shared id, the reference breaks as
  // soon as the instance carrying the <defs> unmounts or is hidden.
  const gradId = `uti-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const acc = 'var(--accent, #4f46e5)'
  const dur = 'var(--uti-dur, 1.1s)'

  const svg = (
    <svg
      className={`uti-spin ${className}`} width={size} height={size}
      viewBox="0 0 48 48" fill="none" role="status" aria-label={label || 'Chargement'}
    >
      {/* hairline track */}
      <circle cx="24" cy="24" r="20" stroke="var(--border, #e5e5e5)" strokeWidth="3" />
      {/* inner counter-sweep — slow opposing harmonic, half tone */}
      <g className="uti-inner">
        <circle
          cx="24" cy="24" r="13" stroke={acc} strokeWidth="1.5"
          strokeLinecap="round" strokeDasharray="13.6 68.1" opacity=".7"
        />
      </g>
      {/* comet sweep — the gradient rides the rotation (userSpaceOnUse inside
          the animated group), so the tail dissolves behind the bright head */}
      <g className="uti-comet">
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="44" y1="24" x2="24" y2="44">
            <stop offset="0" stopColor="#312e81" stopOpacity="0" />
            <stop offset=".3" stopColor="#3730a3" stopOpacity=".55" />
            <stop offset=".55" stopColor="#4f46e5" />
            <stop offset=".8" stopColor="#818cf8" />
            <stop offset="1" stopColor="#c7d2fe" />
          </linearGradient>
        </defs>
        <circle
          className="uti-arc" cx="24" cy="24" r="20" stroke={`url(#${gradId})`}
          strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 94.3"
        />
      </g>
      {/* echo dots — delays solved against the sweep's easing so each one
          lights at the instant the comet head crosses it */}
      <circle className="uti-echo" cx="4" cy="24" r="1.4" fill={acc} style={{ animationDelay: `calc(${dur} * -0.77)` }} />
      <circle className="uti-echo" cx="34" cy="6.68" r="1.4" fill={acc} style={{ animationDelay: `calc(${dur} * -0.62)` }} />
      <circle className="uti-echo" cx="34" cy="41.32" r="1.4" fill={acc} style={{ animationDelay: `calc(${dur} * -0.37)` }} />
      {/* breathing core — inhale/exhale locked to the sweep period */}
      <circle className="uti-core" cx="24" cy="24" r="2.6" fill={acc} />
    </svg>
  )

  if (!label) return svg
  return (
    <div className="inline-flex flex-col items-center" style={{ gap: 7 }}>
      {svg}
      <div className="text-[11px] font-medium text-center" style={{ color: 'var(--text-faint)' }}>{label}</div>
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
