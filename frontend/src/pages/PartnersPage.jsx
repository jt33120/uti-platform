import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import {
  Users, Search, Pencil, Trash2, X, Loader2, AlertCircle,
  ShieldOff, Star, ListChecks, UserPlus, Ban, CalendarDays,
  Settings2,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import InviteModal from '../components/InviteModal'

// ── Edit modal ────────────────────────────────────────────────────────────────
function PartnerModal({ partner, onClose, onSaved }) {
  const [name, setName] = useState(partner.name)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.patch(`/partners/${partner.id}`, { name: name.trim() })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="card p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">Modifier le partenaire</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={14} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nom affiché</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              minLength={2}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input opacity-50 cursor-not-allowed"
              value={partner.email}
              disabled
            />
            <p className="text-[10px] text-slate-500 mt-1">
              L'adresse email ne peut pas être modifiée ici.
            </p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-xs px-3">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs px-4 flex items-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tier summary badges ───────────────────────────────────────────────────────
function AccessSummary({ summary }) {
  if (summary.total === 0) {
    return <span className="text-[10px] text-slate-600 flex items-center gap-1"><Ban size={9} /> Aucun accès</span>
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {summary.list_1 > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
          <Star size={9} /> {summary.list_1} Liste 1
        </span>
      )}
      {summary.list_2 > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] text-brand-300">
          <ListChecks size={9} /> {summary.list_2} Liste 2
        </span>
      )}
      {summary.suspended > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
          <ShieldOff size={9} /> {summary.suspended} suspendu{summary.suspended > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PartnersPage() {
  const { isAdmin } = useAuth() // commerce: même vue, lecture seule
  const navigate = useNavigate()
  const [partners, setPartners] = useState([])
  const [access, setAccess] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [search, setSearch] = useState('')
  const [editPartner, setEditPartner] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [suspending, setSuspending] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [p, a] = await Promise.all([
        api.get('/partners'),
        api.get('/partners/access'),
      ])
      setPartners(p.data)
      setAccess(a.data)
    } catch (e) {
      setFetchError(e.response?.data?.detail || e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = useMemo(() =>
    partners.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
    ), [partners, search])

  const getAccessSummary = (partnerId) => {
    const rows = access.filter(r => r.partner_id === partnerId)
    return {
      total: rows.length,
      list_1: rows.filter(r => r.tier === 'list_1').length,
      list_2: rows.filter(r => r.tier === 'list_2').length,
      suspended: rows.filter(r => r.tier === 'suspended').length,
    }
  }

  const handleDelete = async (partner) => {
    if (!confirm(
      `Supprimer définitivement « ${partner.name} » ?\n\nCette action supprime le compte et tous ses accès. Elle est irréversible.`
    )) return
    setDeleting(partner.id)
    try {
      await api.delete(`/partners/${partner.id}`)
      await fetchAll()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur lors de la suppression')
    } finally {
      setDeleting(null)
    }
  }

  const handleSuspend = async (partner) => {
    if (!confirm(`Suspendre « ${partner.name} » sur tous les clients ?`)) return
    setSuspending(partner.id)
    try {
      await api.post(`/partners/${partner.id}/suspend`)
      await fetchAll()
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur lors de la suspension')
    } finally {
      setSuspending(null)
    }
  }

  // ── Stat counters ─────────────────────────────────────────────────────────
  const totalSuspended = partners.filter(p => {
    const s = getAccessSummary(p.id)
    return s.total > 0 && s.suspended === s.total
  }).length
  const totalActive = partners.length - totalSuspended

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="card p-6 flex items-start gap-3 border border-red-500/30 bg-red-500/5">
        <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-300">Erreur de chargement</p>
          <p className="text-xs text-red-400 mt-1">{fetchError}</p>
          <button onClick={fetchAll} className="mt-3 text-xs text-brand-300 hover:underline">
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users size={20} className="text-brand-400" />
            Partenaires
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {partners.length} inscrit{partners.length !== 1 ? 's' : ''}
            {totalSuspended > 0 && (
              <span className="ml-2 text-red-400">· {totalSuspended} suspendu{totalSuspended > 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setInviteOpen(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <UserPlus size={13} /> Inviter un partenaire
          </button>
        )}
      </div>

      {/* Stat pills */}
      {partners.length > 0 && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <Users size={13} className="text-brand-400" />
            <span className="text-xs text-slate-300">{partners.length} partenaire{partners.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <Star size={13} className="text-emerald-400" />
            <span className="text-xs text-slate-300">{totalActive} actif{totalActive !== 1 ? 's' : ''}</span>
          </div>
          {totalSuspended > 0 && (
            <div className="card px-4 py-2.5 flex items-center gap-2 border-red-500/20">
              <ShieldOff size={13} className="text-red-400" />
              <span className="text-xs text-red-400">{totalSuspended} suspendu{totalSuspended !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      {partners.length > 0 && (
        <div className="relative mb-4">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="input pl-8 text-sm"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Users size={30} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">
            {search
              ? 'Aucun résultat pour cette recherche.'
              : 'Aucun partenaire inscrit. Utilisez le bouton « Inviter » pour en ajouter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(partner => {
            const summary = getAccessSummary(partner.id)
            const isSuspendedEverywhere = summary.total > 0 && summary.suspended === summary.total

            return (
              <div
                key={partner.id}
                onClick={() => navigate(`/partners/${partner.id}`)}
                className={clsx(
                  'card p-4 flex items-center gap-4 hover:border-white/10 transition-all duration-150 cursor-pointer',
                  isSuspendedEverywhere && 'border-red-500/20 opacity-80'
                )}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500/40 to-emerald-500/40 border border-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {partner.name?.charAt(0).toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{partner.name}</span>
                    {isSuspendedEverywhere && (
                      <span className="badge bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] flex items-center gap-1">
                        <ShieldOff size={9} /> Suspendu partout
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{partner.email}</p>
                  <div className="mt-1.5">
                    <AccessSummary summary={summary} />
                  </div>
                </div>

                {/* Date */}
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-600 shrink-0">
                  <CalendarDays size={10} />
                  {new Date(partner.created_at).toLocaleDateString('fr-FR')}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {/* Manage clients */}
                  <button
                    onClick={() => navigate(`/partners/${partner.id}`)}
                    className="btn-ghost p-2 text-slate-400 hover:text-brand-300 transition-colors"
                    title="Gérer les clients de ce partenaire"
                  >
                    <Settings2 size={13} />
                  </button>

                  {/* Write actions — admin only; commerce keeps the same view read-only */}
                  {isAdmin && summary.total > 0 && !isSuspendedEverywhere && (
                    <button
                      onClick={() => handleSuspend(partner)}
                      disabled={suspending === partner.id}
                      className="btn-ghost p-2 text-slate-400 hover:text-red-400 transition-colors"
                      title="Suspendre sur tous les clients"
                    >
                      {suspending === partner.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <ShieldOff size={13} />}
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => setEditPartner(partner)}
                      className="btn-ghost p-2"
                      title="Modifier"
                    >
                      <Pencil size={13} />
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(partner)}
                      disabled={deleting === partner.id}
                      className="btn-ghost p-2 hover:text-red-400 transition-colors"
                      title="Supprimer définitivement"
                    >
                      {deleting === partner.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <X size={13} />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {editPartner && (
        <PartnerModal
          partner={editPartner}
          onClose={() => setEditPartner(null)}
          onSaved={() => { setEditPartner(null); fetchAll() }}
        />
      )}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  )
}
