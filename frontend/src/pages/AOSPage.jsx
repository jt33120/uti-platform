import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import {
  FileText, Plus, Euro, MapPin, Clock, ArrowRight, Search,
  Building2, Users, Star, ListChecks
} from 'lucide-react'
import clsx from 'clsx'

function TierBadge({ tier }) {
  if (!tier) return null
  const map = {
    list_1: { cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', label: 'Liste 1', icon: Star },
    list_2: { cls: 'bg-brand-500/10 text-brand-300 border border-brand-500/20', label: 'Liste 2', icon: ListChecks },
  }
  const c = map[tier]
  if (!c) return null
  const Icon = c.icon
  return (
    <span className={clsx('badge text-[10px]', c.cls)}>
      <Icon size={9} /> {c.label}
    </span>
  )
}

function AOCard({ ao, isAdmin }) {
  const isOpen = ao.status === 'open'
  return (
    <Link to={`/aos/${ao.id}`} className="card p-4 hover:border-white/10 transition-all duration-150 group block">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          {ao.clients?.name && (
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Building2 size={9} /> {ao.clients.name}
            </div>
          )}
          <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors line-clamp-2">
            {ao.title}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx(
            'badge',
            isOpen
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-500 border border-slate-600/20'
          )}>
            {isOpen ? 'Ouvert' : 'Fermé'}
          </span>
          <TierBadge tier={ao.tier} />
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{ao.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {ao.skills_required?.split(',').slice(0, 3).map((s, i) => (
          <span key={i} className="badge bg-brand-600/10 text-brand-300 border border-brand-500/15 text-[10px]">
            {s.trim()}
          </span>
        ))}
        {ao.skills_required?.split(',').length > 3 && (
          <span className="badge bg-white/5 text-slate-500 text-[10px]">
            +{ao.skills_required.split(',').length - 3}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 pt-2 border-t border-white/5">
        {ao.budget_max && (
          <span className="flex items-center gap-1">
            <Euro size={10} className="text-emerald-500" />
            {ao.budget_max}€/j
          </span>
        )}
        {ao.location && (
          <span className="flex items-center gap-1">
            <MapPin size={10} />
            {ao.location}
          </span>
        )}
        {ao.duration && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {ao.duration}
          </span>
        )}
        {isAdmin && (
          <span className="flex items-center gap-1 ml-auto text-brand-300">
            <Users size={10} />
            {ao.submission_count ?? 0} CV{(ao.submission_count ?? 0) > 1 ? 's' : ''}
          </span>
        )}
        <ArrowRight size={12} className={clsx('text-slate-700 group-hover:text-brand-400 transition-colors', !isAdmin && 'ml-auto')} />
      </div>
    </Link>
  )
}

export default function AOSPage() {
  const { isAdmin } = useAuth()
  const [aos, setAos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [groupBy, setGroupBy] = useState('client') // 'client' | 'none'

  useEffect(() => {
    api.get('/aos').then(r => setAos(r.data)).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => aos.filter(ao => {
    const matchSearch = !search ||
      ao.title.toLowerCase().includes(search.toLowerCase()) ||
      ao.skills_required?.toLowerCase().includes(search.toLowerCase()) ||
      ao.clients?.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || ao.status === filter
    return matchSearch && matchFilter
  }), [aos, search, filter])

  // Sort: list_1 first, then list_2, then by created_at desc (admin: just date)
  const sorted = useMemo(() => {
    const tierRank = { list_1: 0, list_2: 1 }
    return [...filtered].sort((a, b) => {
      const ar = tierRank[a.tier] ?? 2
      const br = tierRank[b.tier] ?? 2
      if (ar !== br) return ar - br
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [filtered])

  const groupedByClient = useMemo(() => {
    if (groupBy !== 'client') return null
    const groups = new Map()
    for (const ao of sorted) {
      const key = ao.clients?.id || 'unknown'
      const name = ao.clients?.name || 'Sans client'
      if (!groups.has(key)) groups.set(key, { name, items: [] })
      groups.get(key).items.push(ao)
    }
    return Array.from(groups.entries()).map(([id, v]) => ({ id, name: v.name, items: v.items }))
  }, [sorted, groupBy])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <FileText size={20} className="text-brand-400" />
            Appels d'Offres
            <span className="text-sm font-normal text-slate-500">({aos.length})</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? 'Cliquez sur un AO — le matching IA se lance automatiquement'
              : 'Cliquez sur un AO pour proposer un consultant'}
          </p>
        </div>
        {isAdmin && (
          <Link to="/aos/new" className="btn-primary">
            <Plus size={15} />
            Nouvel AO
          </Link>
        )}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" className="input pl-9"
            placeholder="Rechercher par titre, client, compétence..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {['all', 'open', 'closed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1 text-xs rounded-md font-medium transition-all',
                filter === f ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {f === 'all' ? 'Tous' : f === 'open' ? 'Ouverts' : 'Fermés'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {[
            { k: 'client', l: 'Par client' },
            { k: 'none', l: 'Liste' },
          ].map(o => (
            <button
              key={o.k}
              onClick={() => setGroupBy(o.k)}
              className={clsx(
                'px-3 py-1 text-xs rounded-md font-medium transition-all',
                groupBy === o.k ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Chargement...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'Aucun résultat' : 'Aucun appel d\'offres accessible pour le moment'}
          </p>
          {isAdmin && (
            <Link to="/aos/new" className="btn-primary mt-4 mx-auto">
              <Plus size={14} /> Créer le premier AO
            </Link>
          )}
        </div>
      ) : groupBy === 'client' && groupedByClient ? (
        <div className="space-y-6">
          {groupedByClient.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={13} className="text-brand-400" />
                <h2 className="text-sm font-semibold text-white">{group.name}</h2>
                <span className="text-xs text-slate-500">({group.items.length})</span>
                <div className="flex-1 h-px bg-white/5 ml-2" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.items.map(ao => <AOCard key={ao.id} ao={ao} isAdmin={isAdmin} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(ao => <AOCard key={ao.id} ao={ao} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  )
}
