import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import api from '../lib/api'
import { Loader2, Compass, Maximize2, AlertCircle } from 'lucide-react'

// One hue, three tones — node type reads by depth of indigo, not by a
// different colour each. Cohesive with the rest of the project.
const COLORS = { partner: '#312e81', consultant: '#6366f1', client: '#a5b4fc' }
const TIER = {
  list_1: { color: '#4338ca', label: 'Liste 1' },
  list_2: { color: '#a5b4fc', label: 'Liste 2' },
  suspended: { color: '#dc2626', label: 'Suspendu' }, // red kept: it's a real warning state
}
const NODE_LEGEND = [
  { key: 'partner', label: 'Partenaires' },
  { key: 'consultant', label: 'Consultants' },
  { key: 'client', label: 'Clients' },
]

const cssVar = (name, fb) => {
  if (typeof window === 'undefined') return fb
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb
}
const idOf = (x) => (typeof x === 'object' ? x.id : x)

export default function GraphPage() {
  const wrapRef = useRef(null)
  const fgRef = useRef(null)
  const [size, setSize] = useState({ w: 800, h: 560 })
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [show, setShow] = useState({ consultant: true, client: true })
  const [hover, setHover] = useState(null)

  const theme = useMemo(() => ({
    text: cssVar('--text', '#0a0a0a'),
    surface: cssVar('--surface', '#ffffff'),
  }), [])

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const [p, c, cl, a] = await Promise.all([
          api.get('/partners'), api.get('/consultants'), api.get('/clients'), api.get('/partners/access'),
        ])
        setRaw({ partners: p.data, consultants: c.data, clients: cl.data, access: a.data })
      } catch (e) {
        setError(e.response?.data?.detail || 'Erreur de chargement des données')
      } finally { setLoading(false) }
    })()
  }, [])

  const graph = useMemo(() => {
    if (!raw) return { nodes: [], links: [], adj: {} }
    const nodes = [], links = [], deg = {}
    const partnerIds = new Set(raw.partners.map(p => p.id))
    const bump = (id) => { deg[id] = (deg[id] || 0) + 1 }

    raw.partners.forEach(p => nodes.push({ id: `p:${p.id}`, name: p.name || p.email, sub: 'Partenaire', type: 'partner' }))
    if (show.client) raw.clients.forEach(c => nodes.push({ id: `cl:${c.id}`, name: c.name, sub: c.sector || 'Client', type: 'client' }))
    if (show.consultant) raw.consultants.forEach(c => {
      nodes.push({ id: `c:${c.id}`, name: c.name, sub: c.tjm ? `${c.tjm}€/j` : 'Consultant', type: 'consultant' })
      if (partnerIds.has(c.created_by)) {
        links.push({ source: `c:${c.id}`, target: `p:${c.created_by}`, kind: 'vivier', color: 'rgba(120,120,120,0.22)' })
        bump(`c:${c.id}`); bump(`p:${c.created_by}`)
      }
    })
    if (show.client) raw.access.forEach(r => {
      const t = TIER[r.tier]; if (!t) return
      links.push({ source: `p:${r.partner_id}`, target: `cl:${r.client_id}`, kind: r.tier, color: t.color + 'aa' })
      bump(`p:${r.partner_id}`); bump(`cl:${r.client_id}`)
    })

    nodes.forEach(n => {
      n.size = (n.type === 'partner' ? 5 : 3.5) + Math.min(deg[n.id] || 0, 8) * 0.8
      n.color = COLORS[n.type]
    })
    const adj = {}
    links.forEach(l => {
      const s = idOf(l.source), t = idOf(l.target)
      ;(adj[s] = adj[s] || new Set()).add(t)
      ;(adj[t] = adj[t] || new Set()).add(s)
    })
    return { nodes, links, adj }
  }, [raw, show])

  const highlight = useMemo(() => {
    if (!hover) return null
    const set = new Set([hover]);
    (graph.adj[hover] || []).forEach(n => set.add(n))
    return set
  }, [hover, graph])

  const nodeCanvas = useCallback((node, ctx, scale) => {
    const dim = highlight && !highlight.has(node.id)
    const r = node.size
    ctx.globalAlpha = dim ? 0.15 : 1
    ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = node.color; ctx.fill()
    ctx.lineWidth = 1.4 / scale; ctx.strokeStyle = theme.surface; ctx.stroke()
    if (scale > 1.15 || node.size > 6 || (highlight && highlight.has(node.id))) {
      const fs = Math.max(11 / scale, 2.5)
      ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = theme.text
      ctx.fillText(node.name, node.x, node.y + r + 1.5)
    }
    ctx.globalAlpha = 1
  }, [highlight, theme])

  const nodePointer = useCallback((node, color, ctx) => {
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(node.x, node.y, node.size + 2, 0, 2 * Math.PI); ctx.fill()
  }, [])

  const linkColor = useCallback((l) => {
    if (highlight && !(highlight.has(idOf(l.source)) && highlight.has(idOf(l.target)))) return 'rgba(150,150,150,0.07)'
    return l.color
  }, [highlight])

  const fit = () => fgRef.current?.zoomToFit(500, 55)

  const Toggle = ({ k, label }) => (
    <button
      onClick={() => setShow(s => ({ ...s, [k]: !s[k] }))}
      className="badge transition-colors"
      style={{
        background: show[k] ? COLORS[k] + '1f' : 'var(--surface-2)',
        color: show[k] ? COLORS[k] : 'var(--text-faint)',
        border: `1px solid ${show[k] ? COLORS[k] + '44' : 'var(--border)'}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: show[k] ? COLORS[k] : 'var(--text-faint)' }} />
      {label}
    </button>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Compass size={19} strokeWidth={2} style={{ color: 'var(--accent-text)' }} />
            Graphe de connexions
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Vue réseau des relations partenaires ↔ consultants ↔ clients. Survolez un nœud pour isoler ses liens.
          </p>
        </div>
      </div>

      {error ? (
        <div className="card p-6 flex items-start gap-3" style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}>
          <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
        </div>
      ) : (
        <div ref={wrapRef} className="card overflow-hidden relative" style={{ height: 'calc(100vh - 210px)', minHeight: 460 }}>
          {loading || !raw ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : graph.nodes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: 'var(--text-faint)' }}>
              Pas encore de données à cartographier.
            </div>
          ) : (
            <>
              <ForceGraph2D
                ref={fgRef}
                width={size.w}
                height={size.h}
                graphData={graph}
                backgroundColor={theme.surface}
                nodeCanvasObject={nodeCanvas}
                nodeCanvasObjectMode={() => 'replace'}
                nodePointerAreaPaint={nodePointer}
                nodeLabel={(n) => `${n.name} · ${n.sub}`}
                linkColor={linkColor}
                linkWidth={() => 1}
                onNodeHover={(n) => setHover(n ? n.id : null)}
                onNodeClick={(n) => { fgRef.current.centerAt(n.x, n.y, 600); fgRef.current.zoom(2.4, 600) }}
                cooldownTicks={120}
                onEngineStop={fit}
                d3VelocityDecay={0.32}
              />

              {/* Legend */}
              <div className="absolute top-3 left-3 card p-3 space-y-2" style={{ maxWidth: 190 }}>
                <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-faint)' }}>Nœuds</div>
                {NODE_LEGEND.map(n => (
                  <div key={n.key} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[n.key] }} /> {n.label}
                  </div>
                ))}
                <div className="text-[10px] uppercase tracking-wide font-semibold pt-1" style={{ color: 'var(--text-faint)' }}>Accès</div>
                {Object.values(TIER).map(t => (
                  <div key={t.label} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-4 h-0.5 rounded" style={{ background: t.color }} /> {t.label}
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <Toggle k="consultant" label="Consultants" />
                <Toggle k="client" label="Clients" />
                <button onClick={fit} className="btn-ghost h-7 px-2" title="Recadrer">
                  <Maximize2 size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
