import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { Users, FileText, Plus, ArrowRight, TrendingUp, Send, Building2, UserPlus } from 'lucide-react'
import InviteModal from '../components/InviteModal'

function StatCard({ icon: Icon, label, value, color = 'brand', to }) {
  const colors = {
    brand: 'bg-brand-600/10 text-brand-400 border-brand-500/20',
    emerald: 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-600/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-600/10 text-amber-400 border-amber-500/20',
  }
  const content = (
    <div className="card p-5 flex items-center gap-4 hover:border-white/10 transition-all duration-150">
      <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
      {to && <ArrowRight size={14} className="ml-auto text-slate-600" />}
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
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
    <div className="animate-slide-up">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Bonjour, <span className="text-brand-400">{user?.name}</span> 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {isAdmin
            ? 'Gérez vos appels d\'offres et lancez le scoring IA.'
            : 'Soumettez des consultants et suivez les appels d\'offres.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label={isAdmin ? 'Consultants' : 'Mes consultants'}
          value={stats.consultants}
          color="emerald"
          to="/consultants"
        />
        <StatCard
          icon={FileText}
          label={isAdmin ? "Appels d'offres" : "Mes AOs"}
          value={stats.aos}
          color="brand"
          to="/aos"
        />
        <StatCard
          icon={Building2}
          label="Clients"
          value={stats.clients}
          color="amber"
          to="/clients"
        />
        {isAdmin ? (
          <div className="card p-5 flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg border bg-purple-600/10 text-purple-400 border-purple-500/20">
                <TrendingUp size={18} />
              </div>
              <div className="flex-1">
                <div className="text-2xl font-bold text-white">{stats.matchings ?? '—'}</div>
                <div className="text-xs text-slate-500 mb-2">Matchings effectués</div>
                <div className="text-xs text-slate-400 space-y-0.5">
                  <div>{stats.aiModel}</div>
                  {stats.cost !== null && <div className="text-slate-300 font-medium">${stats.cost}</div>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <StatCard icon={Send} label="CVs soumis" value={stats.submissions} color="purple" />
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {isAdmin && (
          <Link to="/aos/new" className="card p-4 border-dashed border-white/10 hover:border-brand-500/40 hover:bg-brand-600/5 transition-all duration-150 flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center group-hover:bg-brand-600/30 transition-colors">
              <Plus size={18} className="text-brand-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Créer un Appel d'Offres</div>
              <div className="text-xs text-slate-500">Publier un nouveau AO pour matching</div>
            </div>
            <ArrowRight size={14} className="ml-auto text-slate-600 group-hover:text-brand-400 transition-colors" />
          </Link>
        )}
        {isAdmin && (
          <Link to="/clients/new" className="card p-4 border-dashed border-white/10 hover:border-amber-500/40 hover:bg-amber-600/5 transition-all duration-150 flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-amber-600/20 flex items-center justify-center group-hover:bg-amber-600/30 transition-colors">
              <Plus size={18} className="text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Ajouter un Client</div>
              <div className="text-xs text-slate-500">Créer un nouveau dossier client</div>
            </div>
            <ArrowRight size={14} className="ml-auto text-slate-600 group-hover:text-amber-400 transition-colors" />
          </Link>
        )}
        <Link to="/consultants/new" className="card p-4 border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-600/5 transition-all duration-150 flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-emerald-600/20 flex items-center justify-center group-hover:bg-emerald-600/30 transition-colors">
            <Plus size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-white">Ajouter un Consultant</div>
            <div className="text-xs text-slate-500">Uploader un profil + CV PDF</div>
          </div>
          <ArrowRight size={14} className="ml-auto text-slate-600 group-hover:text-emerald-400 transition-colors" />
        </Link>
        {isAdmin && (
          <button onClick={() => setInviteOpen(true)} className="card p-4 border-dashed border-white/10 hover:border-purple-500/40 hover:bg-purple-600/5 transition-all duration-150 flex items-center gap-3 group text-left w-full">
            <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
              <UserPlus size={18} className="text-purple-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Inviter un partenaire</div>
              <div className="text-xs text-slate-500">Générer un lien d'inscription sécurisé</div>
            </div>
            <ArrowRight size={14} className="ml-auto text-slate-600 group-hover:text-purple-400 transition-colors" />
          </button>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      {/* Recent AOs */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText size={15} className="text-brand-400" />
            Derniers Appels d'Offres
          </h2>
          <Link to="/aos" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
            Voir tout <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">Chargement...</div>
        ) : recentAOs.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">
            Aucun appel d'offres pour le moment
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentAOs.map(ao => (
              <Link
                key={ao.id}
                to={`/aos/${ao.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/3 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate group-hover:text-white">{ao.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{ao.skills_required}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ao.budget_max && (
                    <span className="text-xs text-slate-500">{ao.budget_max}€/j</span>
                  )}
                  <span className={`badge ${ao.status === 'open' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400'}`}>
                    {ao.status === 'open' ? 'Ouvert' : 'Fermé'}
                  </span>
                  <ArrowRight size={12} className="text-slate-600 group-hover:text-brand-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
