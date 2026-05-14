import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import {
  Building2, Users, Loader2, AlertCircle, ChevronDown,
  Star, ListChecks, Ban, UserCircle2, ShieldOff, CheckCircle2
} from 'lucide-react'
import clsx from 'clsx'

const COLUMNS = [
  { key: 'none', label: 'Aucun accès', icon: Ban, color: 'text-slate-400', accent: 'border-slate-700/40' },
  { key: 'list_1', label: 'Liste 1 (prioritaire)', icon: Star, color: 'text-emerald-400', accent: 'border-emerald-500/30' },
  { key: 'list_2', label: 'Liste 2', icon: ListChecks, color: 'text-brand-300', accent: 'border-brand-500/30' },
  { key: 'suspended', label: 'Suspendu', icon: AlertCircle, color: 'text-red-400', accent: 'border-red-500/30' },
]

function PartnerCard({ partner, draggable, onDragStart }) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={clsx(
        'flex items-center gap-2 p-2.5 rounded-lg bg-white/3 border border-white/5',
        'hover:border-white/15 transition-all duration-150',
        draggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500/40 to-emerald-500/40 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
        {partner.name?.charAt(0).toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white truncate">{partner.name}</div>
        <div className="text-[10px] text-slate-500 truncate">{partner.email}</div>
      </div>
    </div>
  )
}

function Column({ col, partners, onDrop, onDragOver, isTarget }) {
  const Icon = col.icon
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={clsx(
        'card p-3 min-h-[300px] transition-all duration-150 border-2',
        isTarget ? 'border-brand-400 bg-brand-500/5' : col.accent
      )}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
        <Icon size={14} className={col.color} />
        <span className={clsx('text-xs font-semibold uppercase tracking-wide', col.color)}>
          {col.label}
        </span>
        <span className="ml-auto text-[10px] text-slate-500">{partners.length}</span>
      </div>
      <div className="space-y-1.5">
        {partners.length === 0 ? (
          <div className="text-[11px] text-slate-600 text-center py-6 italic">
            Glissez un partenaire ici
          </div>
        ) : (
          partners.map(p => <PartnerCard key={p.id} partner={p} draggable
            onDragStart={(e) => e.dataTransfer.setData('partnerId', p.id)} />)
        )}
      </div>
    </div>
  )
}

export default function PartnerAccessPage() {
  const [clients, setClients] = useState([])
  const [partners, setPartners] = useState([])
  const [access, setAccess] = useState([]) // partner_clients rows
  const [selectedClient, setSelectedClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragTarget, setDragTarget] = useState(null)
  const [suspending, setSuspending] = useState(null) // partner id being suspended

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [c, p, a] = await Promise.all([
        api.get('/clients'),
        api.get('/partners'),
        api.get('/partners/access'),
      ])
      setClients(c.data)
      setPartners(p.data)
      setAccess(a.data)
      if (!selectedClient && c.data.length) setSelectedClient(c.data[0].id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // Group partners by tier for the currently selected client
  const grouped = useMemo(() => {
    const result = { none: [], list_1: [], list_2: [], suspended: [] }
    if (!selectedClient) return result
    const byPartner = {}
    for (const row of access) {
      if (row.client_id === selectedClient) byPartner[row.partner_id] = row.tier
    }
    for (const p of partners) {
      const tier = byPartner[p.id] || 'none'
      result[tier].push(p)
    }
    return result
  }, [access, partners, selectedClient])

  const handleDrop = async (tierKey, partnerId) => {
    if (!selectedClient || !partnerId) return
    setSaving(true)
    setDragTarget(null)

    // Optimistic update
    const prev = access
    setAccess(prevAccess => {
      const others = prevAccess.filter(r => !(r.partner_id === partnerId && r.client_id === selectedClient))
      if (tierKey === 'none') return others
      return [...others, { partner_id: partnerId, client_id: selectedClient, tier: tierKey }]
    })

    try {
      if (tierKey === 'none') {
        await api.delete('/partners/access', {
          params: { partner_id: partnerId, client_id: selectedClient },
        })
      } else {
        await api.put('/partners/access', {
          partner_id: partnerId,
          client_id: selectedClient,
          tier: tierKey,
        })
      }
    } catch (e) {
      setAccess(prev) // rollback
      alert(e.response?.data?.detail || 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const handleSuspendGlobally = async (partnerId) => {
    if (!confirm('Suspendre ce partenaire sur TOUS les clients ?')) return
    setSuspending(partnerId)
    try {
      await api.post(`/partners/${partnerId}/suspend`)
      await fetchAll()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur lors de la suspension')
    } finally {
      setSuspending(null)
    }
  }

  const currentClient = clients.find(c => c.id === selectedClient)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users size={20} className="text-brand-400" />
            Gestion partenaires
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Sélectionnez un client, puis glissez-déposez les partenaires entre les listes
          </p>
        </div>
        {saving && (
          <div className="text-xs text-brand-300 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Enregistrement...
          </div>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="card p-8 text-center">
          <Building2 size={28} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Aucun client. Créez-en un d'abord depuis « Clients ».</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="card p-8 text-center">
          <UserCircle2 size={28} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Aucun partenaire (rôle « ao ») n'est inscrit pour le moment.</p>
        </div>
      ) : (
        <>
          {/* Client picker */}
          <div className="card p-4 mb-5">
            <label className="label">Client</label>
            <div className="relative">
              <select
                value={selectedClient || ''}
                onChange={e => setSelectedClient(e.target.value)}
                className="input appearance-none pr-9"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-navy-900">{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
            {currentClient?.sector && (
              <p className="text-[11px] text-slate-500 mt-2">Secteur : {currentClient.sector}</p>
            )}
          </div>

          {/* Kanban columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {COLUMNS.map(col => (
              <Column
                key={col.key}
                col={col}
                partners={grouped[col.key]}
                isTarget={dragTarget === col.key}
                onDragOver={(e) => { e.preventDefault(); setDragTarget(col.key) }}
                onDrop={(e) => {
                  e.preventDefault()
                  const partnerId = e.dataTransfer.getData('partnerId')
                  handleDrop(col.key, partnerId)
                }}
              />
            ))}
          </div>

          <p className="text-[11px] text-slate-600 mt-4 text-center">
            <Star size={11} className="inline text-emerald-500 mr-1" />
            Les partenaires de la <span className="text-emerald-400">Liste 1</span> sont prioritaires sur les AOs de ce client.
          </p>

          {/* Global partner management */}
          <div className="mt-8">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldOff size={13} className="text-red-400" /> Suspension globale
            </h2>
            <div className="space-y-2">
              {partners.map(p => {
                const partnerAccess = access.filter(r => r.partner_id === p.id)
                const isSuspendedEverywhere = partnerAccess.length > 0 &&
                  partnerAccess.every(r => r.tier === 'suspended')
                const hasAnyAccess = partnerAccess.some(r => r.tier !== 'suspended')
                return (
                  <div key={p.id} className="card p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/40 to-emerald-500/40 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {p.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{p.email}</div>
                    </div>
                    {isSuspendedEverywhere ? (
                      <span className="badge bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] flex items-center gap-1">
                        <AlertCircle size={10} /> Suspendu partout
                      </span>
                    ) : hasAnyAccess ? (
                      <button
                        onClick={() => handleSuspendGlobally(p.id)}
                        disabled={suspending === p.id}
                        className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5"
                      >
                        {suspending === p.id
                          ? <><Loader2 size={12} className="animate-spin" />Suspension...</>
                          : <><ShieldOff size={12} />Suspendre partout</>}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600">Aucun accès actif</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
