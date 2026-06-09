import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import {
  Users, FileText, Plus, ArrowRight, Building2, UserPlus, Sparkles,
  Briefcase, Layers, Zap, Award, BarChart3,
} from 'lucide-react'
import InviteModal from '../components/InviteModal'
import { ChartCard, EmptyHint, Donut, Legend, VBars, HBars, PALETTE } from '../components/charts'

const parseSkills = (s) => (s || '').split(/[,;/]+/).map(x => x.trim()).filter(Boolean)

function Kpi({ icon: Icon, label, value, sub, to, tint }) {
  const inner = (
    <div className="card p-4 h-full transition-colors hover:border-[var(--border-strong)]">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: tint.bg, color: tint.fg }}>
          <Icon size={17} strokeWidth={2} />
        </div>
        {to && <ArrowRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-faint)' }} />}
      </div>
      <div className="text-[26px] font-semibold tabular leading-none" style={{ color: 'var(--text)' }}>{value ?? '—'}</div>
      <div className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
        {label}{sub ? <span> · {sub}</span> : null}
      </div>
    </div>
  )
  return to ? <Link to={to} className="block">{inner}</Link> : inner
}

function QuickAction({ to, onClick, icon: Icon, title, desc, tint }) {
  const inner = (
    <div className="card p-3.5 flex items-center gap-3 transition-colors hover:bg-[var(--surface-2)] group cursor-pointer">
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: tint.bg, color: tint.fg }}>
        <Icon size={15} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{title}</div>
        <div className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>{desc}</div>
      </div>
      <ArrowRight size={14} strokeWidth={1.75} className="transition-colors" style={{ color: 'var(--text-faint)' }} />
    </div>
  )
  if (to) return <Link to={to}>{inner}</Link>
  return <button onClick={onClick} className="text-left w-full">{inner}</button>
}

const TINT = {
  indigo: { bg: 'rgba(99,102,241,0.12)', fg: '#4f46e5' },
  emerald: { bg: 'rgba(16,185,129,0.13)', fg: '#059669' },
  amber: { bg: 'rgba(245,158,11,0.15)', fg: '#d97706' },
  violet: { bg: 'rgba(168,85,247,0.13)', fg: '#9333ea' },
  sky: { bg: 'rgba(14,165,233,0.13)', fg: '#0284c7' },
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [consultants, setConsultants] = useState([])
  const [aos, setAos] = useState([])
  const [clients, setClients] = useState([])
  const [ai, setAi] = useState({ matchings: null, model: null, cost: null })
  const [submissions, setSubmissions] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const settle = (p) => p.then(r => ({ ok: true, data: r.data })).catch(() => ({ ok: false, data: null }))
    const run = async () => {
      const [c, a, cl, subs, m] = await Promise.all([
        settle(api.get('/consultants')),
        settle(api.get('/aos')),
        settle(api.get('/clients')),
        isAdmin ? Promise.resolve({ ok: false }) : settle(api.get('/submissions/mine')),
        isAdmin ? settle(api.get('/matching/stats')) : Promise.resolve({ ok: false }),
      ])
      if (c.ok) setConsultants(c.data)
      if (a.ok) setAos(a.data)
      if (cl.ok) setClients(cl.data)
      if (subs.ok) setSubmissions(subs.data.length)
      if (m.ok) setAi({ matchings: m.data.total_matchings, model: m.data.model_used, cost: m.data.total_cost_usd })
      setLoading(false)
    }
    run()
  }, [isAdmin])

  const d = useMemo(() => {
    const open = aos.filter(a => a.status === 'open').length
    const aoStatus = [
      { name: 'Ouverts', value: open, color: '#10b981' },
      { name: 'Fermés', value: aos.length - open, color: '#cbd5e1' },
    ].filter(x => x.value > 0)

    const typeMap = {}
    aos.forEach(a => { const t = a.ao_type || 'Non typé'; typeMap[t] = (typeMap[t] || 0) + 1 })
    const aoTypes = Object.entries(typeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    const secMap = {}
    clients.forEach(c => { const s = c.sector || 'Autre'; secMap[s] = (secMap[s] || 0) + 1 })
    const sectors = Object.entries(secMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    const b = [['0-2 ans', 0], ['3-5 ans', 0], ['6-9 ans', 0], ['10+ ans', 0]]
    consultants.forEach(c => {
      const y = c.experience_years || 0
      if (y <= 2) b[0][1]++; else if (y <= 5) b[1][1]++; else if (y <= 9) b[2][1]++; else b[3][1]++
    })
    const seniority = b.map(([name, value]) => ({ name, value }))

    const skillMap = {}
    consultants.forEach(c => parseSkills(c.skills).forEach(s => { skillMap[s] = (skillMap[s] || 0) + 1 }))
    aos.forEach(a => parseSkills(a.skills_required).forEach(s => { skillMap[s] = (skillMap[s] || 0) + 1 }))
    const topSkills = Object.entries(skillMap)
      .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 7).reverse()

    const tjms = consultants.map(c => c.tjm).filter(Boolean)
    const avgTjm = tjms.length ? Math.round(tjms.reduce((x, y) => x + y, 0) / tjms.length) : null

    return { open, aoStatus, aoTypes, sectors, seniority, topSkills, avgTjm }
  }, [aos, consultants, clients])

  const recentAOs = aos.slice(0, 5)

  return (
    <div>
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tightest" style={{ color: 'var(--text)' }}>
            Bonjour, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {isAdmin ? "Pilotez vos appels d'offres et le scoring IA en un coup d'œil." : 'Soumettez des consultants et suivez les appels d\'offres.'}
          </p>
        </div>
        {isAdmin && ai.matchings != null && (
          <div
            className="rounded-xl px-4 py-2.5 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.10))', border: '1px solid var(--border)' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.18)', color: '#4f46e5' }}>
              <Sparkles size={16} strokeWidth={2} />
            </div>
            <div className="leading-tight">
              <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>Moteur IA · {d.matchings}</div>
              <div className="text-[13px] font-semibold tabular" style={{ color: 'var(--text)' }}>
                {ai.matchings} matching{ai.matchings > 1 ? 's' : ''}
                {ai.cost != null && <span style={{ color: 'var(--text-muted)' }}> · ${ai.cost}</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <Kpi icon={Users} label="Consultants" value={consultants.length} to="/consultants"
          sub={d.avgTjm ? `TJM moy. ${d.avgTjm}€` : null} tint={TINT.indigo} />
        <Kpi icon={Briefcase} label={isAdmin ? "Appels d'offres" : 'Mes AOs'} value={aos.length} to="/aos"
          sub={`${d.open} ouvert${d.open > 1 ? 's' : ''}`} tint={TINT.emerald} />
        <Kpi icon={Building2} label="Clients" value={clients.length} to="/clients"
          sub={d.sectors.length ? `${d.sectors.length} secteurs` : null} tint={TINT.amber} />
        {isAdmin
          ? <Kpi icon={Sparkles} label="Matchings IA" value={ai.matchings} sub={ai.model} tint={TINT.violet} />
          : <Kpi icon={FileText} label="CVs soumis" value={submissions} tint={TINT.violet} />}
      </div>

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <ChartCard title="Appels d'offres par type" icon={Layers} className="lg:col-span-2">
          {d.aoTypes.length ? <VBars data={d.aoTypes} /> : <EmptyHint />}
        </ChartCard>
        <ChartCard title="Statut des AO" icon={BarChart3}>
          {d.aoStatus.length ? <><Donut data={d.aoStatus} centerLabel="AO" /><Legend data={d.aoStatus} /></> : <EmptyHint />}
        </ChartCard>
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-8">
        <ChartCard title="Top compétences demandées" icon={Zap}>
          {d.topSkills.length ? <HBars data={d.topSkills.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))} /> : <EmptyHint />}
        </ChartCard>
        <ChartCard title="Séniorité du vivier" icon={Award}>
          {consultants.length ? <VBars data={d.seniority} /> : <EmptyHint />}
        </ChartCard>
        <ChartCard title="Clients par secteur" icon={Building2}>
          {d.sectors.length ? <><Donut data={d.sectors} centerLabel="clients" /><Legend data={d.sectors} /></> : <EmptyHint />}
        </ChartCard>
      </div>

      {/* Recent + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent AOs */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-4 h-11" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
              <FileText size={14} strokeWidth={1.75} /> Derniers appels d'offres
            </div>
            <Link to="/aos" className="text-[12px] font-medium flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              Voir tout <ArrowRight size={11} strokeWidth={2} />
            </Link>
          </div>
          {loading ? (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>Chargement…</div>
          ) : recentAOs.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>Aucun appel d'offres pour le moment.</div>
          ) : (
            <ul>
              {recentAOs.map((ao, i) => (
                <li key={ao.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <Link to={`/aos/${ao.id}`} className="flex items-center gap-3 px-4 h-12 hover:bg-[var(--surface-2)] transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{ao.title}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>{ao.skills_required}</div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {ao.budget_max && <span className="text-[11px] tabular" style={{ color: 'var(--text-muted)' }}>{ao.budget_max}€/j</span>}
                      <span className="badge" style={{
                        background: ao.status === 'open' ? 'var(--success-soft)' : 'var(--surface-2)',
                        color: ao.status === 'open' ? 'var(--success)' : 'var(--text-faint)',
                      }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: 'currentColor' }} />
                        {ao.status === 'open' ? 'Ouvert' : 'Fermé'}
                      </span>
                      <ArrowRight size={12} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold mb-2.5" style={{ color: 'var(--text-faint)' }}>Raccourcis</h2>
          <div className="space-y-2.5">
            {isAdmin && <QuickAction to="/aos/new" icon={Plus} title="Nouvel appel d'offres" desc="IA : générer depuis un email" tint={TINT.emerald} />}
            {isAdmin && <QuickAction to="/clients/new" icon={Building2} title="Nouveau client" desc="Créer un dossier client" tint={TINT.amber} />}
            <QuickAction to="/consultants/new" icon={Users} title="Ajouter un consultant" desc="Profil + CV PDF" tint={TINT.indigo} />
            {isAdmin && <QuickAction onClick={() => setInviteOpen(true)} icon={UserPlus} title="Inviter un partenaire" desc="Lien sécurisé à 7 jours" tint={TINT.violet} />}
          </div>
        </div>
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}
