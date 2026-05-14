import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { Users, FileText, Plus, ArrowRight, TrendingUp, Send } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color = 'brand', to }) {
  const colors = {
    brand: 'bg-brand-600/10 text-brand-400 border-brand-500/20',
    emerald: 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-600/10 text-purple-400 border-purple-500/20',
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
  const [stats, setStats] = useState({ consultants: null, aos: null, submissions: null })
  const [recentAOs, setRecentAOs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const requests = [api.get('/consultants'), api.get('/aos')]
        if (!isAdmin) requests.push(api.get('/submissions/mine'))
        const [consultantsRes, aosRes, subsRes] = await Promise.all(requests)
        setStats({
          consultants: consultantsRes.data.length,
          aos: aosRes.data.length,
          submissions: subsRes?.data.length ?? null,
        })
        setRecentAOs(aosRes.data.slice(0, 5))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
        {isAdmin ? (
          <StatCard icon={TrendingUp} label="Matching IA" value="Actif" color="purple" />
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
      </div>

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
