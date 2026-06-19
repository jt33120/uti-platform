import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import api from '../lib/api'

// Profile options map to a (role, org) pair. The two "Commercial" entries share
// role 'commerce' (identical rights) and differ only by commercial entity.
const PROFILE_OPTIONS = [
  { key: 'admin', role: 'admin', org: null, label: 'Administrateur' },
  { key: 'commerce_uti', role: 'commerce', org: 'uti', label: 'Commercial UTI' },
  { key: 'commerce_grpit', role: 'commerce', org: 'groupement-it', label: 'Commercial Groupement-IT' },
  { key: 'ao', role: 'ao', org: null, label: 'Partenaire' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'suspended', label: 'Suspendu' },
  { value: 'disabled', label: 'Désactivé' },
]

const profileKey = (acc) =>
  acc.role === 'commerce'
    ? (acc.org === 'groupement-it' ? 'commerce_grpit' : 'commerce_uti')
    : acc.role

export default function AccountEditModal({ account, isSelf, onClose, onSaved }) {
  const [name, setName] = useState(account.name || '')
  const [email, setEmail] = useState(account.email || '')
  const [profile, setProfile] = useState(profileKey(account))
  const [status, setStatus] = useState(account.status || 'active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const opt = PROFILE_OPTIONS.find(o => o.key === profile)
      const payload = {}
      if (name.trim() !== (account.name || '')) payload.name = name.trim()
      if (email.trim() !== (account.email || '')) payload.email = email.trim()
      if (!isSelf) {
        if (opt.role !== account.role) payload.role = opt.role
        // Always send org alongside a role change so the entity stays coherent.
        if (opt.role !== account.role || (opt.org || null) !== (account.org || null)) {
          payload.org = opt.org
        }
        if (status !== (account.status || 'active')) payload.status = status
      }
      if (Object.keys(payload).length === 0) { onClose(); return }
      const res = await api.patch(`/admin/accounts/${account.id}`, payload)
      onSaved(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] card p-5"
        style={{ boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tightest text-[var(--text)]">Modifier le compte</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Nom, email, rôle et statut du compte</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors -mt-1 -mr-1 p-1 rounded">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="label">Nom affiché</label>
            <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} required minLength={2} autoFocus />
          </div>

          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="label">Profil / rôle</label>
            <select className="input" value={profile} onChange={e => setProfile(e.target.value)} disabled={isSelf}>
              {PROFILE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Statut</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)} disabled={isSelf}>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {isSelf && (
            <p className="text-[11px] text-[var(--text-faint)]">
              Vous ne pouvez pas modifier votre propre rôle ni votre statut.
            </p>
          )}

          {error && (
            <div className="text-[13px] rounded-md px-3 py-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Enregistrement…</> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
