import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { Building2, Plus, Pencil, Trash2, Search, Briefcase, UserCircle2, Mail, ArrowRight, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

function TierBadge({ tier }) {
  const map = {
    list_1: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    list_2: 'bg-brand-500/10 text-brand-300 border border-brand-500/20',
    suspended: 'bg-red-500/10 text-red-400 border border-red-500/20',
  }
  const label = { list_1: 'Liste 1', list_2: 'Liste 2', suspended: 'Suspendu' }
  if (!tier) return null
  return <span className={clsx('badge text-[10px]', map[tier])}>{label[tier]}</span>
}

function ClientRow({ client, isAdmin, onEdit, onDelete, navigate }) {
  return (
    <div
      className="card p-4 flex items-center gap-4 hover:border-white/10 transition-all duration-150 group cursor-pointer"
      onClick={() => navigate(`/clients/${client.id}`)}
    >
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500/30 to-emerald-500/30 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
        {client.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">{client.name}</div>
          <TierBadge tier={client.tier} />
          {client.sector && (
            <span className="text-[10px] text-slate-500 inline-flex items-center gap-1">
              <Briefcase size={10} /> {client.sector}
            </span>
          )}
        </div>
        {client.contact_name && (
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <UserCircle2 size={10} /> {client.contact_name}
            {client.contact_email && <span className="text-slate-600">· {client.contact_email}</span>}
          </p>
        )}
        {!client.contact_name && client.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{client.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {isAdmin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={e => { e.stopPropagation(); onEdit(client) }} className="btn-ghost p-2">
              <Pencil size={13} />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(client.id) }} className="btn-danger p-2">
              <Trash2 size={13} />
            </button>
          </div>
        )}
        <ArrowRight size={13} className="text-slate-700 group-hover:text-brand-400 transition-colors ml-1" />
      </div>
    </div>
  )
}

function ClientModal({ client, onClose, onSaved, existingClients = [] }) {
  const isEdit = !!client?.id
  const [form, setForm] = useState({
    name: client?.name || '',
    description: client?.description || '',
    sector: client?.sector || '',
    contact_name: client?.contact_name || '',
    contact_email: client?.contact_email || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nameSuggestions, setNameSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleNameChange = (e) => {
    const val = e.target.value
    setForm(p => ({ ...p, name: val }))
    const trimmed = val.trim()
    if (trimmed.length >= 2) {
      const matches = existingClients.filter(c =>
        c.id !== client?.id &&
        c.name.toLowerCase().includes(trimmed.toLowerCase())
      )
      setNameSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    } else {
      setNameSuggestions([])
      setShowSuggestions(false)
    }
  }

  const exactMatch = existingClients.find(
    c => c.id !== client?.id && c.name.toLowerCase() === form.name.trim().toLowerCase()
  )

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isEdit) {
        await api.patch(`/clients/${client.id}`, form)
      } else {
        await api.post('/clients', form)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-white mb-4">
          {isEdit ? 'Modifier le client' : 'Nouveau client'}
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nom *</label>
            <div className="relative">
              <input className="input" required value={form.name}
                onChange={handleNameChange}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => nameSuggestions.length > 0 && setShowSuggestions(true)}
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-widest border-b border-white/5">
                    Clients existants similaires
                  </div>
                  {nameSuggestions.map(c => (
                    <div key={c.id} className="px-4 py-2.5 text-sm text-slate-200 flex items-center gap-2">
                      <Building2 size={13} className="text-brand-400 shrink-0" />
                      <span>{c.name}</span>
                      {c.sector && <span className="text-slate-500 text-xs ml-auto">{c.sector}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {exactMatch && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle size={13} className="shrink-0" />
                Un client nommé « {exactMatch.name} » existe déjà.
              </div>
            )}
          </div>
          <div>
            <label className="label">Secteur</label>
            <input className="input" placeholder="Banque, Énergie, Retail..." value={form.sector}
              onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input h-24 resize-none" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-center gap-1"><UserCircle2 size={11} /> Contact</label>
              <input className="input" placeholder="Nom du contact" value={form.contact_name}
                onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Mail size={11} /> Email</label>
              <input className="input" type="email" placeholder="email@..." value={form.contact_email}
                onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
            </div>
          </div>
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | client (edit only)
  const navigate = useNavigate()

  const [error, setError] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/clients')
      setClients(data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleDelete = async (id) => {
    if (!(await confirm({
      title: 'Supprimer ce client ?',
      message: 'Les AOs liés deviendront orphelins. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
    }))) return
    try {
      await api.delete(`/clients/${id}`)
      setClients(p => p.filter(c => c.id !== id))
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur lors de la suppression')
    }
  }

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.sector?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Building2 size={20} className="text-brand-400" />
            Clients
            <span className="text-sm font-normal text-slate-500">({clients.length})</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? 'Gestion des comptes clients et Accès partenaires' : 'Vos clients accessibles'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Link to="/partners-access" className="btn-ghost">Accès partenaires</Link>
            <Link to="/clients/new" className="btn-primary">
              <Plus size={15} /> Nouveau client
            </Link>
          </div>
        )}
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" className="input pl-9" placeholder="Rechercher par nom, secteur..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'Aucun résultat' : isAdmin ? 'Aucun client pour le moment' : 'Aucun client accessible'}
          </p>
          {isAdmin && !search && (
            <Link to="/clients/new" className="btn-primary mt-4 mx-auto">
              <Plus size={14} /> Créer le premier client
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <ClientRow key={c.id} client={c} isAdmin={isAdmin}
              onEdit={(c) => setModal(c)} onDelete={handleDelete} navigate={navigate} />
          ))}
        </div>
      )}

      {modal && <ClientModal client={modal} onClose={() => setModal(null)}
        onSaved={() => { setModal(null); fetchAll() }} existingClients={clients} />}

    </div>
  )
}
