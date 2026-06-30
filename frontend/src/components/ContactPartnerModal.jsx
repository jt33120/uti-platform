import { useState, useEffect } from 'react'
import api from '../lib/api'
import { X, Mail, Loader2, Check } from 'lucide-react'

// Email the partner who carries a consultant, pre-filled, sent via the backend
// SMTP (Reply-To = the staff member writing it). `consultant.owner` must hold
// the carrying partner (id/name/email/role).
export default function ContactPartnerModal({ consultant, onClose }) {
  const [subject, setSubject] = useState(`[Groupement-IT] Au sujet de votre consultant ${consultant.name}`)
  const [message, setMessage] = useState(
    `Bonjour ${consultant.owner?.name || ''},\n\n`
    + `Je vous contacte au sujet de votre consultant ${consultant.name}`
    + `${consultant.skills ? ` (${consultant.skills.split(',').slice(0, 3).map(s => s.trim()).join(', ')})` : ''}.\n\n`
    + `\n\nCordialement,`
  )
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const send = async (e) => {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await api.post(`/consultants/${consultant.id}/contact-partner`, { subject, message })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || "Échec d'envoi de l'email")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="card p-5 w-full max-w-[480px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tightest" style={{ color: 'var(--text)' }}>
              Contacter le partenaire
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {consultant.owner?.name} à propos de {consultant.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text)]">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {sent ? (
          <div className="space-y-3.5">
            <div className="text-[13px] rounded-md px-3 py-2.5 flex items-center gap-2"
                 style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <Check size={14} strokeWidth={2} />
              Email envoyé à {consultant.owner?.name}. Il pourra vous répondre directement.
            </div>
            <button onClick={onClose} className="btn-primary w-full justify-center">Fermer</button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3.5">
            <div>
              <label className="label">Sujet</label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)} required />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input min-h-[150px] resize-y" value={message} onChange={e => setMessage(e.target.value)} required />
            </div>
            {error && (
              <div className="text-[13px] rounded-md px-3 py-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
              <button type="submit" disabled={sending} className="btn-primary flex-1 justify-center">
                {sending ? <><Loader2 size={13} className="animate-spin" /> Envoi…</> : <><Mail size={13} strokeWidth={1.75} /> Envoyer</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
