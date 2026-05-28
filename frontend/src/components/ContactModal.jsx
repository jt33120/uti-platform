import { useState, useEffect } from 'react'
import { X, Send, Loader2, Check, AlertCircle } from 'lucide-react'
import api from '../lib/api'

const TYPES = [
  { value: 'bug',        label: 'Problème technique' },
  { value: 'question',   label: 'Question' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'other',      label: 'Autre' },
]

export default function ContactModal({ onClose, defaultType = 'question' }) {
  const [type, setType] = useState(defaultType)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async () => {
    setError('')
    if (!subject.trim()) { setError('Le sujet est requis.'); return }
    if (message.trim().length < 10) { setError('Le message doit contenir au moins 10 caractères.'); return }

    setSending(true)
    try {
      await api.post('/support/contact', { type, subject: subject.trim(), message: message.trim() })
      setSent(true)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Une erreur est survenue.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Contacter l'équipe</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: 'var(--success-bg, #dcfce7)', color: 'var(--success)' }}
              >
                <Check size={20} strokeWidth={2} />
              </div>
              <p className="text-[14px] font-medium text-[var(--text)]">Message envoyé !</p>
              <p className="text-[13px] text-[var(--text-muted)]">
                L'équipe a bien reçu votre message et vous répondra dans les meilleurs délais.
              </p>
              <button className="btn-primary text-[13px] h-8 px-4 mt-2" onClick={onClose}>
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Type */}
              <div>
                <label className="label">Type de demande</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className="px-3 h-7 rounded-full text-[12px] font-medium transition-colors"
                      style={
                        type === t.value
                          ? { background: 'var(--accent)', color: '#fff' }
                          : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="label">Sujet</label>
                <input
                  className="input w-full mt-1"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Décrivez brièvement votre demande"
                  maxLength={120}
                />
              </div>

              {/* Message */}
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input w-full mt-1 resize-none"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Donnez autant de détails que possible…"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 text-[13px] text-[var(--danger)]">
                  <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-ghost text-[13px] h-8 px-3" onClick={onClose}>Annuler</button>
                <button
                  className="btn-primary text-[13px] h-8 px-4 flex items-center gap-1.5"
                  onClick={handleSubmit}
                  disabled={sending}
                >
                  {sending
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Send size={13} strokeWidth={1.75} />
                  }
                  Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
