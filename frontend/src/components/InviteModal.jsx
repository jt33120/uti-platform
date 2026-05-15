import { useState, useEffect } from 'react'
import { X, Copy, Check } from 'lucide-react'
import api from '../lib/api'

export default function InviteModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied, setCopied] = useState(false)
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
      const res = await api.post('/invitations', { email })
      setInviteUrl(res.data.url)
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la création de l'invitation")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <h2 className="text-[15px] font-semibold tracking-tightest text-[var(--text)]">
              Inviter un partenaire
            </h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Lien valable 7 jours, à usage unique
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors -mt-1 -mr-1 p-1 rounded"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="label">Email du partenaire</label>
              <input
                type="email"
                className="input"
                placeholder="partenaire@exemple.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {error && (
              <div
                className="text-[13px] rounded-md px-3 py-2"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
              >
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
                Annuler
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                {loading ? 'Génération...' : 'Générer le lien'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3.5">
            <div
              className="text-[13px] rounded-md px-3 py-2"
              style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
            >
              Invitation créée pour <span className="font-medium">{email}</span>
            </div>

            <div>
              <label className="label">Lien d'invitation</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="input flex-1 text-[12px] tabular truncate"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  className="btn-ghost shrink-0 !px-3"
                >
                  {copied ? (
                    <><Check size={13} strokeWidth={2} /> Copié</>
                  ) : (
                    <><Copy size={13} strokeWidth={1.75} /> Copier</>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
                Envoyez ce lien par email ou message au partenaire.
              </p>
            </div>

            <button onClick={onClose} className="btn-primary w-full justify-center">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
