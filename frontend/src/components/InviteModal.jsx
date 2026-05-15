import { useState } from 'react'
import { X, Mail, Copy, Check, UserPlus } from 'lucide-react'
import api from '../lib/api'

export default function InviteModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md card p-6 animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center">
            <UserPlus size={18} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Inviter un partenaire</h2>
            <p className="text-xs text-slate-500">Lien valable 7 jours, usage unique</p>
          </div>
        </div>

        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email du partenaire</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  className="input pl-8"
                  placeholder="partenaire@exemple.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center py-2">
                Annuler
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Génération...
                  </span>
                ) : "Générer le lien"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              Invitation créée pour <span className="font-medium">{email}</span>
            </div>

            <div>
              <label className="label">Lien d'invitation</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="input text-xs text-slate-400 flex-1 truncate"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  className={`shrink-0 px-3 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-all ${
                    copied
                      ? 'border-emerald-500/40 bg-emerald-600/10 text-emerald-400'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Envoyez ce lien au partenaire par email ou message. Il expire dans 7 jours.
              </p>
            </div>

            <button onClick={onClose} className="btn-primary w-full justify-center py-2">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
