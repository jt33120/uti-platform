import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { Users, FileText, Plus, ArrowRight, Building2, UserPlus, Send, Sparkles } from 'lucide-react'
import InviteModal from '../components/InviteModal'

function StatTile({ label, value, to, sublabel }) {
  const inner = (
    <div className="stat-tile group">
      <div className="stat-label">{label}</div>
      <div className="flex items-baseline justify-between">
        <div className="stat-value">{value ?? '—'}</div>
        {to && <ArrowRight size={14} className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors" strokeWidth={1.75} />}
      </div>
      {sublabel && <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{sublabel}</div>}
    </div>
  )
  return to ? <Link to={to} className="block">{inner}</Link> : inner
}

function QuickAction({ to, onClick, icon: Icon, title, desc }) {
  const inner = (
    <div className="card p-3.5 flex items-center gap-3 transition-colors hover:bg-[var(--surface-2)] group cursor-pointer">
      <div className="w-8 h-8 rounded-md flex items-center justify-center surface-2 border border-[var(--border)]">
        <Icon size={15} strokeWidth={1.75} className="text-[var(--text)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--text)]">{title}</div>
        <div className="text-[11px] text-[var(--text-faint)] truncate">{desc}</div>
      </div>
      <ArrowRight size={14} strokeWidth={1.75} className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors" />
    </div>
  )
  if (to) return <Link to={to}>{inner}</Link>
  return <button onClick={onClick} className="text-left w-full">{inner}</button>
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [stats, setStats] = useState({ consultants: null, aos: null, clients: null, submissions: null, matchings: null, aiModel: 'GPT-4o', cost: null })
  const [recentAOs, setRecentAOs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const settle = (p) => p.then(r => ({ ok: true, data: r.data })).catch(() => ({ ok: false, data: null }))

      const [consultantsR, aosR, clientsR, subsR, matchingR] = await Promise.all([
        settle(api.get('/consultants')),
        settle(api.get('/aos')),
        settle(api.get('/clients')),
        isAdmin ? Promise.resolve({ ok: false, data: null }) : settle(api.get('/submissions/mine')),
        isAdmin ? settle(api.get('/matching/stats')) : Promise.resolve({ ok: false, data: null }),
      ])

      setStats({
        consultants: consultantsR.ok ? consultantsR.data.length : null,
        aos: aosR.ok ? aosR.data.length : null,
        clients: clientsR.ok ? clientsR.data.length : null,
        submissions: subsR.ok ? subsR.data.length : null,
        matchings: matchingR.ok ? matchingR.data.total_matchings : null,
        aiModel: matchingR.ok ? matchingR.data.model_used : 'GPT-4o',
        cost: matchingR.ok ? matchingR.data.total_cost_usd : null,
      })
      if (aosR.ok) setRecentAOs(aosR.data.slice(0, 5))
      setLoading(false)
    }
    fetchData()
  }, [isAdmin])

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tightest text-[var(--text)]">
            Bonjour, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            {isAdmin
              ? "Gérez vos appels d'offres et lancez le scoring IA."
              : "Soumettez des consultants et suivez les appels d'offres."}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatTile label="Consultants" value={stats.consultants} to="/consultants" />
        <StatTile label={isAdmin ? "Appels d'offres" : 'Mes AOs'} value={stats.aos} to="/aos" />
        <StatTile label="Clients" value={stats.clients} to="/clients" />
        {isAdmin ? (
          <StatTile
            label="Matchings IA"
            value={stats.matchings}
            sublabel={stats.cost !== null ? `${stats.aiModel} · $${stats.cost}` : stats.aiModel}
          />
        ) : (
          <StatTile label="CVs soumis" value={stats.submissions} />
        )}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-[var(--text-faint)] mb-2.5">Raccourcis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {isAdmin && <QuickAction to="/aos/new" icon={Plus} title="Nouvel appel d'offres" desc="Publier un nouveau AO" />}
          {isAdmin && <QuickAction to="/clients/new" icon={Building2} title="Nouveau client" desc="Créer un dossier client" />}
          <QuickAction to="/consultants/new" icon={Users} title="Ajouter un consultant" desc="Profil + CV PDF" />
          {isAdmin && <QuickAction onClick={() => setInviteOpen(true)} icon={UserPlus} title="Inviter un partenaire" desc="Lien sécurisé à 7 jours" />}
        </div>
      </div>

      {/* Recent AOs */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 h-11" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]">
            <FileText size={14} strokeWidth={1.75} />
            Derniers appels d'offres
          </div>
          <Link to="/aos" className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-1">
            Voir tout <ArrowRight size={11} strokeWidth={2} />
          </Link>
        </div>
        {loading ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--text-faint)]">Chargement...</div>
        ) : recentAOs.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--text-faint)]">
            Aucun appel d'offres pour le moment.
          </div>
        ) : (
          <ul>
            {recentAOs.map((ao, i) => (
              <li key={ao.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <Link
                  to={`/aos/${ao.id}`}
                  className="flex items-center gap-3 px-4 h-12 hover:bg-[var(--surface-2)] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text)] truncate">{ao.title}</div>
                    <div className="text-[11px] text-[var(--text-faint)] truncate">{ao.skills_required}</div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {ao.budget_max && (
                      <span className="text-[11px] text-[var(--text-muted)] tabular">{ao.budget_max}€/j</span>
                    )}
                    <span
                      className="badge"
                      style={{
                        background: ao.status === 'open' ? 'var(--success-soft)' : 'var(--surface-2)',
                        color: ao.status === 'open' ? 'var(--success)' : 'var(--text-faint)',
                      }}
                    >
                      <span className="w-1 h-1 rounded-full" style={{ background: 'currentColor' }} />
                      {ao.status === 'open' ? 'Ouvert' : 'Fermé'}
                    </span>
                    <ArrowRight size={12} strokeWidth={2} className="text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}
