import { useState, useEffect } from 'react'
import { X, Copy, Check, Mail, AlertTriangle, Send, Loader2, Briefcase, BadgePercent } from 'lucide-react'
import api from '../lib/api'

// Each tile maps to a (role, org) pair. The two "Commercial" tiles share the
// exact same role ('commerce') — and therefore identical rights — and only
// differ by their commercial entity (org), which drives the displayed label.
const INVITE_ROLES = [
  { key: 'ao', role: 'ao', org: null, label: 'Partenaire', desc: 'Propose des consultants sur vos AOs', icon: Briefcase },
  { key: 'commerce_uti', role: 'commerce', org: 'uti', label: 'Commercial UTI', desc: 'Crée les besoins, lance le matching', icon: BadgePercent },
  { key: 'commerce_grpit', role: 'commerce', org: 'groupement-it', label: 'Commercial Groupement-IT', desc: 'Mêmes droits que Commercial UTI', icon: BadgePercent },
]

export default function InviteModal({ onClose, defaultRole = 'ao' }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [sel, setSel] = useState(defaultRole === 'commerce' ? 'commerce_uti' : 'ao')
  const selected = INVITE_ROLES.find(r => r.key === sel) || INVITE_ROLES[0]
  const isCommerce = selected.role === 'commerce'
  const [inviteUrl, setInviteUrl] = useState(null)
  const [inviteToken, setInviteToken] = useState(null)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [resending, setResending] = useState(false)
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
      const res = await api.post('/invitations', { name, email, role: selected.role, org: selected.org })
      setInviteUrl(res.data.url)
      // Extract token from the returned URL so we can re-send if needed
      try {
        const u = new URL(res.data.url)
        setInviteToken(u.searchParams.get('invite'))
      } catch { /* ignore */ }
      setEmailSent(!!res.data.email_sent)
      setEmailError(res.data.email_sent ? null : res.data.email_error)
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

  const handleResend = async () => {
    if (!inviteToken) return
    setResending(true)
    setEmailError(null)
    try {
      await api.post('/invitations/resend', { token: inviteToken })
      setEmailSent(true)
    } catch (err) {
      setEmailError(err.response?.data?.detail || "Échec d'envoi de l'email")
    } finally {
      setResending(false)
    }
  }

  const mailtoHref = inviteUrl
    ? `mailto:${email}?subject=${encodeURIComponent('Invitation — GROUPEMENT-IT Plateforme')}&body=${encodeURIComponent(
        `Bonjour ${name},\n\nVous êtes invité(e) à rejoindre la plateforme partenaires Groupement-IT.\n\nCliquez ici pour créer votre compte (lien valable 7 jours) :\n${inviteUrl}\n\nÀ bientôt.`
      )}`
    : '#'

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
              Inviter un compte
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
              <label className="label">Type de compte</label>
              <div className="flex flex-col gap-2">
                {INVITE_ROLES.map(r => {
                  const Icon = r.icon
                  const active = sel === r.key
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setSel(r.key)}
                      className="flex items-center gap-2.5 p-2.5 rounded-md text-left transition-colors"
                      style={{
                        background: active ? 'var(--surface-2)' : 'var(--surface)',
                        border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                      }}
                    >
                      <Icon size={15} strokeWidth={1.75} className="text-[var(--text)] shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold text-[var(--text)]">{r.label}</span>
                        <span className="block text-[10.5px] text-[var(--text-faint)] leading-tight">{r.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="label">Nom affiché</label>
              <input
                type="text"
                className="input"
                placeholder={isCommerce ? 'ex: Jean Dupont' : 'ex: Partenaire Île-de-France'}
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
                minLength={2}
              />
              <p className="text-[11px] text-[var(--text-faint)] mt-1">
                Utilisé tel quel dans l'email (« Bonjour … ») — un prénom suffit. Modifiable ensuite côté admin.
              </p>
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder={isCommerce ? 'prenom.nom@groupement-it.com' : 'partenaire@exemple.com'}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
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
              Invitation créée pour <span className="font-medium">{name}</span> ({email})
            </div>

            {/* Email status */}
            {emailSent ? (
              <div
                className="text-[12px] rounded-md px-3 py-2 flex items-center gap-2"
                style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
              >
                <Check size={13} strokeWidth={2} />
                Email envoyé automatiquement à <span className="font-medium">{email}</span>
              </div>
            ) : (
              <div
                className="text-[12px] rounded-md px-3 py-2 flex items-start gap-2"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
              >
                <AlertTriangle size={13} strokeWidth={2} className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  L'email n'a pas pu être envoyé automatiquement.
                  {emailError && <div className="opacity-80 mt-0.5 break-words text-[11px]">{emailError}</div>}
                </div>
              </div>
            )}

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
            </div>

            {/* Send actions */}
            <div className="flex gap-2">
              <button
                onClick={handleResend}
                disabled={resending || !inviteToken}
                className="btn-ghost flex-1 justify-center"
                title="Renvoyer l'email via Resend"
              >
                {resending ? (
                  <><Loader2 size={13} className="animate-spin" /> Envoi...</>
                ) : emailSent ? (
                  <><Send size={13} strokeWidth={1.75} /> Renvoyer l'email</>
                ) : (
                  <><Send size={13} strokeWidth={1.75} /> Envoyer l'email</>
                )}
              </button>
              <a
                href={mailtoHref}
                className="btn-ghost flex-1 justify-center"
                title="Ouvrir votre client mail avec le lien pré-rempli"
              >
                <Mail size={13} strokeWidth={1.75} /> Via mon mail
              </a>
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
