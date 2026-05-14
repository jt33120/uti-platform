import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Users, Plus, Trash2, Search, Euro, Clock, Briefcase } from 'lucide-react'
import clsx from 'clsx'

function SkillTag({ skill }) {
  return (
    <span className="badge bg-brand-600/10 text-brand-300 border border-brand-500/15 text-[10px]">
      {skill.trim()}
    </span>
  )
}

function EmploymentBadge({ type }) {
  if (!type) return null
  const cls = type === 'salarie'
    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  const label = type === 'salarie' ? 'Salarié' : 'Indépendant'
  return <span className={clsx('badge border text-[10px]', cls)}>{label}</span>
}

function ConsultantCard({ consultant, onDelete, canDelete }) {
  const skills = consultant.skills?.split(',').slice(0, 4) || []
  const extraSkills = (consultant.skills?.split(',').length || 0) - 4

  return (
    <div className="card p-4 hover:border-white/10 transition-all duration-150 group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/30 to-brand-500/30 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {consultant.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{consultant.name}</div>
            {consultant.experience_years && (
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock size={10} />
                {consultant.experience_years} ans d'expérience
              </div>
            )}
          </div>
        </div>
        {consultant.tjm && (
          <div className="flex items-center gap-0.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 shrink-0">
            <Euro size={10} />
            {consultant.tjm}/j
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <EmploymentBadge type={consultant.employment_type} />
        {skills.map((s, i) => <SkillTag key={i} skill={s} />)}
        {extraSkills > 0 && (
          <span className="badge bg-white/5 text-slate-400 text-[10px]">+{extraSkills}</span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs text-slate-500">
        {consultant.availability && (
          <span className="inline-flex items-center gap-1">
            <Briefcase size={10} /> {consultant.availability}
          </span>
        )}
        <span className="ml-auto text-slate-700">
          {new Date(consultant.created_at).toLocaleDateString('fr-FR')}
        </span>
        {canDelete && (
          <button onClick={() => onDelete(consultant.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function ConsultantsPage() {
  const { isAdmin } = useAuth()
  const [consultants, setConsultants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchConsultants = async () => {
    try {
      const { data } = await api.get('/consultants')
      setConsultants(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConsultants() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce consultant ? Toutes ses soumissions seront perdues.')) return
    try {
      await api.delete(`/consultants/${id}`)
      setConsultants(p => p.filter(c => c.id !== id))
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  const filtered = consultants.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.skills?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users size={20} className="text-emerald-400" />
            Roster Consultants
            <span className="text-sm font-normal text-slate-500">({consultants.length})</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Vue d\'ensemble de tous les consultants des partenaires'
              : 'Vos consultants. Soumettez-les en réponse à des AOs depuis la page de l\'AO.'}
          </p>
        </div>
        {!isAdmin && (
          <Link to="/consultants/new" className="btn-primary">
            <Plus size={15} />
            Ajouter
          </Link>
        )}
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Rechercher par nom, compétence..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'Aucun résultat' : 'Aucun consultant dans votre roster'}
          </p>
          {!isAdmin && (
            <Link to="/consultants/new" className="btn-primary mt-4 mx-auto">
              <Plus size={14} /> Ajouter le premier consultant
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ConsultantCard key={c.id} consultant={c}
                            onDelete={handleDelete} canDelete={isAdmin || true} />
          ))}
        </div>
      )}
    </div>
  )
}
