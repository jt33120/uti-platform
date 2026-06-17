import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X } from 'lucide-react'

const ACK_KEY = 'uti_cookie_ack_v1'

// Bandeau cookies discret. La plateforme n'utilise que du stockage strictement
// nécessaire (pas de traçage), donc bandeau purement informatif.
export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(ACK_KEY)) {
      const t = setTimeout(() => setVisible(true), 900)
      return () => clearTimeout(t)
    }
  }, [])

  const ack = () => {
    localStorage.setItem(ACK_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm z-[60] card p-3.5 flex items-start gap-3 shadow-lg"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      role="dialog" aria-label="Information cookies"
    >
      <Cookie size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-text)' }} />
      <div className="flex-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Ce site n'utilise que des éléments de stockage <strong>strictement nécessaires</strong>
        {' '}(session, thème) — aucun traçage publicitaire.{' '}
        <Link to="/legal/confidentialite" className="underline" style={{ color: 'var(--accent-text)' }}>
          En savoir plus
        </Link>.
        <div className="mt-2">
          <button onClick={ack} className="btn-primary text-[11px] px-3 py-1">J'ai compris</button>
        </div>
      </div>
      <button onClick={ack} className="shrink-0" style={{ color: 'var(--text-faint)' }} aria-label="Fermer">
        <X size={14} />
      </button>
    </div>
  )
}
