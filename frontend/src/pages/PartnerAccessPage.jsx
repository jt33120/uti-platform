import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  Building2, Users, Loader2, AlertCircle, ChevronDown,
  Star, ListChecks, Ban, UserCircle2, ShieldOff, GripVertical,
} from 'lucide-react'

// Tiers read as one hue by depth (priority = deeper indigo); suspended stays
// red because it's a genuine warning state, and "none" stays neutral grey.
const COLUMNS = [
  { key: 'none', label: 'Aucun accès', icon: Ban, color: '#737373', tint: 'rgba(115,115,115,0.05)' },
  { key: 'list_1', label: 'Liste 1 · Prioritaire', icon: Star, color: '#4338ca', tint: 'rgba(67,56,202,0.07)' },
  { key: 'list_2', label: 'Liste 2', icon: ListChecks, color: '#818cf8', tint: 'rgba(129,140,248,0.08)' },
  { key: 'suspended', label: 'Suspendu', icon: AlertCircle, color: '#dc2626', tint: 'rgba(220,38,38,0.05)' },
]

function Avatar({ name, size = 28 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
    >
      {name?.charAt(0).toUpperCase() || '?'}
    </div>
  )
}

function PartnerCard({ partner, onDragStart, readOnly }) {
  return (
    <div
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : onDragStart}
      className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-150 group ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <Avatar name={partner.name} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{partner.name}</div>
        <div className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>{partner.email}</div>
      </div>
      {!readOnly && <GripVertical size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-faint)' }} />}
    </div>
  )
}

function Column({ col, partners, onDrop, onDragOver, onDragLeave, isTarget, readOnly }) {
  const Icon = col.icon
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="rounded-xl p-3 min-h-[320px] transition-all duration-150"
      style={{
        background: isTarget ? 'var(--accent-soft)' : col.tint,
        border: `1.5px ${isTarget ? 'dashed' : 'solid'} ${isTarget ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3 pb-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${col.color}1a`, color: col.color }}>
          <Icon size={13} strokeWidth={2.25} />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: col.color }}>{col.label}</span>
        <span className="ml-auto text-[11px] font-semibold tabular px-1.5 rounded" style={{ background: `${col.color}14`, color: col.color }}>
          {partners.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {partners.length === 0 ? (
          <div className="text-[11px] text-center py-8 italic" style={{ color: 'var(--text-faint)' }}>
            {readOnly ? 'Aucun partenaire' : 'Glissez un partenaire ici'}
          </div>
        ) : (
          partners.map(p => (
            <PartnerCard key={p.id} partner={p} readOnly={readOnly}
              onDragStart={(e) => e.dataTransfer.setData('partnerId', p.id)} />
          ))
        )}
      </div>
    </div>
  )
}

export default function PartnerAccessPage({ embedded = false }) {
  const { isAdmin } = useAuth() // commerce : même vue, lecture seule
  const confirm = useConfirm()
  const readOnly = !isAdmin
  const [clients, setClients] = useState([])
  const [partners, setPartners] = useState([])
  const [access, setAccess] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dragTarget, setDragTarget] = useState(null)
  const [suspending, setSuspending] = useState(null)
  const [fetchError, setFetchError] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    setFetchError(null)
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
    } catch (e) {
      setFetchError(e.response?.data?.detail || e.message || 'Erreur de chargement des données')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

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

    const prev = access
    setAccess(prevAccess => {
      const others = prevAccess.filter(r => !(r.partner_id === partnerId && r.client_id === selectedClient))
      if (tierKey === 'none') return others
      return [...others, { partner_id: partnerId, client_id: selectedClient, tier: tierKey }]
    })

    try {
      if (tierKey === 'none') {
        await api.delete('/partners/access', { params: { partner_id: partnerId, client_id: selectedClient } })
      } else {
        await api.put('/partners/access', { partner_id: partnerId, client_id: selectedClient, tier: tierKey })
      }
    } catch (e) {
      setAccess(prev)
      alert(e.response?.data?.detail || 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const handleSuspendGlobally = async (partnerId) => {
    if (!(await confirm({
      title: "Suspendre l'accès de ce partenaire ?",
      message: "L'accès du partenaire sera suspendu sur tous les clients qui lui sont attribués. (Ceci ne bloque pas la connexion : pour cela, suspendez le compte depuis Admin → Comptes.)",
      confirmLabel: "Suspendre l'accès",
    }))) return
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
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="card p-6 flex items-start gap-3" style={{ borderColor: 'var(--danger)', background: 'var(--danger-soft)' }}>
        <AlertCircle size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Erreur de chargement</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{fetchError}</p>
          <button onClick={fetchAll} className="mt-3 text-xs font-medium" style={{ color: 'var(--accent-text)' }}>Réessayer</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {embedded ? (
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {readOnly
              ? 'Sélectionnez un client pour consulter les listes en lecture seule (modifications réservées aux administrateurs).'
              : 'Sélectionnez un client, puis glissez-déposez les partenaires entre les listes.'}
          </p>
          {saving && (
            <div className="text-xs flex items-center gap-1.5 shrink-0" style={{ color: 'var(--accent-text)' }}>
              <Loader2 size={12} className="animate-spin" /> Enregistrement…
            </div>
          )}
        </div>
      ) : (
        <div className="page-header">
          <div>
            <h1 className="section-title flex items-center gap-2">
              <Users size={19} strokeWidth={2} style={{ color: 'var(--accent-text)' }} />
              Habilitations partenaires
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {readOnly
                ? 'Sélectionnez un client pour consulter les listes en lecture seule (modifications réservées aux administrateurs).'
                : 'Sélectionnez un client, puis glissez-déposez les partenaires entre les listes.'}
            </p>
          </div>
          {saving && (
            <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--accent-text)' }}>
              <Loader2 size={12} className="animate-spin" /> Enregistrement…
            </div>
          )}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="card p-8 text-center">
          <Building2 size={28} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun client. Créez-en un d'abord depuis « Clients ».</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="card p-8 text-center">
          <UserCircle2 size={28} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun partenaire (rôle « ao ») n'est inscrit pour le moment.</p>
        </div>
      ) : (
        <>
          {/* Client picker */}
          <div className="card p-4 mb-5">
            <label className="label">Client</label>
            <div className="relative">
              <select value={selectedClient || ''} onChange={e => setSelectedClient(e.target.value)} className="input appearance-none pr-9">
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-faint)' }} />
            </div>
            {currentClient?.sector && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-faint)' }}>Secteur : {currentClient.sector}</p>
            )}
          </div>

          {/* Kanban */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {COLUMNS.map(col => (
              <Column
                key={col.key}
                col={col}
                partners={grouped[col.key]}
                readOnly={readOnly}
                isTarget={!readOnly && dragTarget === col.key}
                onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setDragTarget(col.key) }}
                onDragLeave={readOnly ? undefined : () => setDragTarget(t => (t === col.key ? null : t))}
                onDrop={readOnly ? undefined : (e) => { e.preventDefault(); handleDrop(col.key, e.dataTransfer.getData('partnerId')) }}
              />
            ))}
          </div>

          <p className="text-[11px] mt-4 text-center" style={{ color: 'var(--text-faint)' }}>
            <Star size={11} className="inline mr-1" style={{ color: 'var(--accent-text)' }} />
            Les partenaires de la <span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>Liste 1</span> sont prioritaires sur les AOs de ce client.
          </p>

          {/* Global suspension — admin only */}
          {isAdmin && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <ShieldOff size={13} style={{ color: 'var(--danger)' }} /> Suspension globale
            </h2>
            <div className="space-y-2">
              {partners.map(p => {
                const pa = access.filter(r => r.partner_id === p.id)
                const suspendedEverywhere = pa.length > 0 && pa.every(r => r.tier === 'suspended')
                const hasAnyAccess = pa.some(r => r.tier !== 'suspended')
                return (
                  <div key={p.id} className="card p-3 flex items-center gap-3">
                    <Avatar name={p.name} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{p.name}</div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>{p.email}</div>
                    </div>
                    {suspendedEverywhere ? (
                      <span className="badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }} title="Accès suspendu sur tous les clients attribués (ne bloque pas la connexion).">
                        <AlertCircle size={10} /> Accès suspendu
                      </span>
                    ) : hasAnyAccess ? (
                      <button onClick={() => handleSuspendGlobally(p.id)} disabled={suspending === p.id} className="btn-danger text-xs px-3 h-8" title="Suspendre l'accès à tous ses clients (ne bloque pas la connexion)">
                        {suspending === p.id
                          ? <><Loader2 size={12} className="animate-spin" />Suspension…</>
                          : <><ShieldOff size={12} />Suspendre l'accès</>}
                      </button>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>Aucun accès actif</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          )}
        </>
      )}
    </div>
  )
}
