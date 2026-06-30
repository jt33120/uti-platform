import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import ContactPartnerModal from '../components/ContactPartnerModal'
import {
  Users, Plus, X, Search, Euro, Clock, MapPin, Map as MapIcon,
  Mail, UserCircle2, SlidersHorizontal,
  ChevronRight, RotateCcw,
} from 'lucide-react'
import clsx from 'clsx'

function EmploymentBadge({ type }) {
  if (!type) return null
  const label = type === 'salarie' ? 'Salarié' : 'Indépendant'
  return (
    <span className="badge text-[10px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      {label}
    </span>
  )
}

// Une ligne d'annuaire (l'ensemble est cliquable -> fiche profil).
function ConsultantRow({ consultant, onOpen, onMap, onContact, onDelete, canDelete, canContact }) {
  const c = consultant
  const skills = c.skills?.split(',').map(s => s.trim()).filter(Boolean) || []
  const ownerIsPartner = c.owner?.role === 'ao'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(c.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(c.id) }}
      className="card group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 cursor-pointer hover:border-white/10 transition-all"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
           style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
        {c.name.charAt(0).toUpperCase()}
      </div>

      {/* Nom + compétences */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{c.name}</span>
          <EmploymentBadge type={c.employment_type} />
        </div>
        <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-faint)' }}>
          {skills.length ? skills.slice(0, 5).join(' · ') : 'Compétences non renseignées'}
          {skills.length > 5 && ` +${skills.length - 5}`}
        </div>
      </div>

      {/* Ville + dispo (md+) */}
      <div className="hidden md:flex flex-col items-end shrink-0 min-w-[110px]">
        {c.city && (
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <MapPin size={11} /> {c.city}
          </span>
        )}
        {c.availability && (
          <span className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-faint)' }}>
            <Clock size={10} /> {c.availability}
          </span>
        )}
      </div>

      {/* TJM */}
      {c.tjm != null && (
        <div className="hidden sm:flex items-center gap-0.5 text-xs font-medium rounded-lg px-2 py-1 shrink-0"
             style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
          <Euro size={10} /> {c.tjm}/j
        </div>
      )}

      {/* Porteur (lg+) */}
      {c.owner && (
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] shrink-0 max-w-[150px]" style={{ color: 'var(--text-muted)' }}>
          <UserCircle2 size={12} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{c.owner.name}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {(c.latitude != null && c.longitude != null) && (
          <button
            onClick={(e) => { e.stopPropagation(); onMap(c.id) }}
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--accent-text)] transition-colors"
            title="Voir sur la carte"
          >
            <MapIcon size={15} strokeWidth={1.75} />
          </button>
        )}
        {canContact && ownerIsPartner && (
          <button
            onClick={(e) => { e.stopPropagation(); onContact(c) }}
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--accent-text)] transition-colors"
            title={`Contacter ${c.owner?.name || 'le partenaire'}`}
          >
            <Mail size={15} strokeWidth={1.75} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Supprimer"
          >
            <X size={15} />
          </button>
        )}
        <ChevronRight size={16} className="text-[var(--text-faint)] group-hover:text-[var(--accent-text)] transition-colors" />
      </div>
    </div>
  )
}

const SORTS = [
  { k: 'name', l: 'Alphabétique' },
  { k: 'recent', l: 'Plus récents' },
  { k: 'tjm', l: 'TJM décroissant' },
]

const EMPTY_FILTERS = { employment: 'all', city: '', skill: '', availability: '', tjmMin: '', tjmMax: '', owner: 'all' }

export default function ConsultantsPage() {
  const { isAdmin, isStaff, isCommerce } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [consultants, setConsultants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [contactFor, setContactFor] = useState(null)
  const [advanced, setAdvanced] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('name')

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
    if (!(await confirm({
      title: 'Supprimer ce consultant ?',
      message: 'Le consultant et toutes ses soumissions seront supprimés. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
    }))) return
    try {
      await api.delete(`/consultants/${id}`)
      setConsultants(p => p.filter(c => c.id !== id))
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  const setF = (k) => (e) => setFilters(p => ({ ...p, [k]: e.target.value }))

  // Liste des partenaires porteurs (staff) pour le filtre.
  const owners = useMemo(() => {
    const m = new Map()
    consultants.forEach(c => { if (c.owner) m.set(c.owner.id, c.owner.name) })
    return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [consultants])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const out = consultants.filter(c => {
      if (q && !(c.name.toLowerCase().includes(q) || c.skills?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)))
        return false
      if (filters.employment !== 'all' && c.employment_type !== filters.employment) return false
      if (filters.city && !c.city?.toLowerCase().includes(filters.city.toLowerCase())) return false
      if (filters.skill && !c.skills?.toLowerCase().includes(filters.skill.toLowerCase())) return false
      if (filters.availability && !c.availability?.toLowerCase().includes(filters.availability.toLowerCase())) return false
      if (filters.tjmMin && (c.tjm == null || c.tjm < Number(filters.tjmMin))) return false
      if (filters.tjmMax && (c.tjm == null || c.tjm > Number(filters.tjmMax))) return false
      if (filters.owner !== 'all' && c.created_by !== filters.owner) return false
      return true
    })
    out.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'tjm') return (b.tjm || 0) - (a.tjm || 0)
      return new Date(b.created_at) - new Date(a.created_at) // recent
    })
    return out
  }, [consultants, search, filters, sort])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.employment !== 'all') n++
    if (filters.city) n++
    if (filters.skill) n++
    if (filters.availability) n++
    if (filters.tjmMin || filters.tjmMax) n++
    if (filters.owner !== 'all') n++
    return n
  }, [filters])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users size={20} strokeWidth={1.75} style={{ color: 'var(--accent-text)' }} />
            Vivier de consultants
            <span className="text-sm font-normal text-slate-500">({consultants.length})</span>
          </h1>
          {!isStaff && (
            <p className="text-sm text-slate-500 mt-0.5">
              Vos consultants. Soumettez-les en réponse à des AOs depuis la page de l'AO.
            </p>
          )}
        </div>
        {!isStaff && (
          <Link to="/consultants/new" className="btn-primary">
            <Plus size={15} />
            Ajouter
          </Link>
        )}
      </div>

      {/* Barre d'outils : recherche + recherche avancée + tri */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Rechercher par nom, compétence, ville..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setAdvanced(v => !v)}
          className={clsx('btn-ghost gap-1.5 text-sm', advanced && 'text-[var(--accent-text)]')}
          style={advanced ? { background: 'var(--accent-soft)' } : undefined}
          title="Filtres avancés"
        >
          <SlidersHorizontal size={14} /> Recherche avancée
          {activeFilterCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="input appearance-none pr-8 text-sm h-9 py-0"
            title="Trier"
          >
            {SORTS.map(s => <option key={s.k} value={s.k} className="bg-navy-900">{s.l}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Filtres avancés (panneau gauche) */}
        {advanced && (
          <aside className="w-60 shrink-0 card p-4 space-y-4 hidden md:block">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
                <SlidersHorizontal size={13} /> Filtres
              </h2>
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(EMPTY_FILTERS)}
                        className="text-[11px] inline-flex items-center gap-1 text-slate-500 hover:text-slate-300">
                  <RotateCcw size={11} /> Réinitialiser
                </button>
              )}
            </div>

            <div>
              <label className="label">Statut</label>
              <div className="flex flex-col gap-1">
                {[{ v: 'all', l: 'Tous' }, { v: 'independant', l: 'Indépendant' }, { v: 'salarie', l: 'Salarié' }].map(o => (
                  <button key={o.v} onClick={() => setFilters(p => ({ ...p, employment: o.v }))}
                    className={clsx('text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                      filters.employment === o.v ? 'seg-active' : 'text-slate-400 hover:text-slate-200 bg-white/5')}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Compétence</label>
              <input className="input h-9 py-0 text-sm" placeholder="React, AWS…" value={filters.skill} onChange={setF('skill')} />
            </div>

            <div>
              <label className="label">Ville</label>
              <input className="input h-9 py-0 text-sm" placeholder="Paris, Lyon…" value={filters.city} onChange={setF('city')} />
            </div>

            <div>
              <label className="label">Disponibilité</label>
              <input className="input h-9 py-0 text-sm" placeholder="Immédiate…" value={filters.availability} onChange={setF('availability')} />
            </div>

            <div>
              <label className="label">TJM (€/j)</label>
              <div className="flex items-center gap-1.5">
                <input className="input h-9 py-0 text-sm" type="number" min="0" placeholder="min" value={filters.tjmMin} onChange={setF('tjmMin')} />
                <span className="text-slate-600 text-xs">→</span>
                <input className="input h-9 py-0 text-sm" type="number" min="0" placeholder="max" value={filters.tjmMax} onChange={setF('tjmMax')} />
              </div>
            </div>

            {isStaff && owners.length > 0 && (
              <div>
                <label className="label">Partenaire porteur</label>
                <div className="relative">
                  <select className="input appearance-none pr-8 h-9 py-0 text-sm" value={filters.owner} onChange={setF('owner')}>
                    <option value="all" className="bg-navy-900">Tous</option>
                    {owners.map(o => <option key={o.id} value={o.id} className="bg-navy-900">{o.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Liste */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center py-16 text-slate-500 text-sm">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users size={32} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">
                {search || activeFilterCount ? 'Aucun résultat' : 'Aucun consultant dans votre vivier'}
              </p>
              {!isStaff && !search && !activeFilterCount && (
                <Link to="/consultants/new" className="btn-primary mt-4 mx-auto">
                  <Plus size={14} /> Ajouter le premier consultant
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="text-[11px] mb-2 px-1" style={{ color: 'var(--text-faint)' }}>
                {filtered.length} consultant{filtered.length > 1 ? 's' : ''}
              </div>
              <div className="space-y-2">
                {filtered.map(c => (
                  <ConsultantRow
                    key={c.id}
                    consultant={c}
                    onOpen={(id) => navigate(`/consultants/${id}`)}
                    onMap={(id) => navigate(`/carte?focus=${id}`)}
                    onContact={setContactFor}
                    onDelete={handleDelete}
                    canDelete={isAdmin || (!isStaff && !isCommerce)}
                    canContact={isStaff}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {contactFor && (
        <ContactPartnerModal consultant={contactFor} onClose={() => setContactFor(null)} />
      )}
    </div>
  )
}
