import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

/* ──────────────────────────────────────────────────────────────
   ONE palette for the whole project: a monochromatic indigo ramp.
   No rainbow. Colour here encodes *magnitude / rank*, not category —
   so it carries information instead of just decorating.
   Ordered dark → light; pair charts feed values sorted desc so the
   darkest tone is always the largest slice/bar.
   ────────────────────────────────────────────────────────────── */
export const BRAND = '#4f46e5'                          // single brand fill for series
export const NEUTRAL = '#d4d4d4'                         // "rest / closed / other"
export const PALETTE = [
  '#312e81', '#3730a3', '#4338ca', '#4f46e5',
  '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe',
]

/* Frameless block: a quiet label + the viz, on the page surface.
   No border, no shadow — separation comes from whitespace. */
export function ChartCard({ title, icon: Icon, right, children, className = '' }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>
          {Icon && <Icon size={13} strokeWidth={2} />}
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export function EmptyHint({ children = 'Pas encore de données', height = 160 }) {
  return (
    <div className="flex items-center justify-center text-[12px]" style={{ height, color: 'var(--text-faint)' }}>
      {children}
    </div>
  )
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card" style={{ padding: '7px 10px' }}>
      {label != null && label !== '' && (
        <div className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text)' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.payload?.fill }} />
          <span className="tabular font-semibold">{p.value}</span>
          <span style={{ color: 'var(--text-faint)' }}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

export function Donut({ data, height = 188, centerLabel = 'total' }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={76} paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<TooltipBox />} />
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}
      >
        <div className="text-[26px] font-semibold tabular leading-none" style={{ color: 'var(--text)' }}>{total}</div>
        <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-faint)' }}>{centerLabel}</div>
      </div>
    </div>
  )
}

export function Legend({ data }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: d.color || PALETTE[i % PALETTE.length] }} />
          {d.name} <span className="tabular font-semibold" style={{ color: 'var(--text)' }}>{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export function VBars({ data, height = 188 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={46}>
          {data.map((d, i) => <Cell key={i} fill={d.color || BRAND} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function HBars({ data, height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 14, left: 4, bottom: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={104} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={16}>
          {data.map((d, i) => <Cell key={i} fill={d.color || BRAND} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
