import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import NotificationSettings from '../components/NotificationSettings'
import { Bell, RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const KIND_LABEL = { list_1: 'Liste 1', list_2: 'Liste 2', relance: 'Relance', manual: 'Renvoi ciblé' }
const fmt = (iso) => iso
  ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  : '—'

export default function NotificationsPage() {
  const { isAdmin } = useAuth()
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = () => {
    setRefreshing(true); setError('')
    api.get('/notifications/log')
      .then(r => setLogs(r.data.logs || []))
      .catch(e => { setError(e.response?.data?.detail || 'Erreur de chargement'); setLogs([]) })
      .finally(() => setRefreshing(false))
  }
  useEffect(load, [])

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Bell size={20} strokeWidth={1.75} style={{ color: 'var(--accent-text)' }} />
            Notifications mail
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Journal des emails envoyés aux partenaires (ouverture d'AO, relances, renvois ciblés).
          </p>
        </div>
        <button onClick={load} disabled={refreshing} className="btn-ghost">
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Rafraîchir
        </button>
      </div>

      {isAdmin && (
        <div className="mb-8">
          <NotificationSettings />
        </div>
      )}

      <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold mb-3" style={{ color: 'var(--text-faint)' }}>
        Derniers envois {logs ? `(${logs.length})` : ''}
      </h2>

      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}

      {logs === null ? (
        <div className="py-10 text-center"><Loader2 size={20} className="animate-spin inline" style={{ color: 'var(--text-faint)' }} /></div>
      ) : logs.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--text-faint)' }}>Aucun email envoyé pour le moment.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}>
                <th className="font-medium px-3 py-2.5">Date</th>
                <th className="font-medium px-3 py-2.5">Destinataire</th>
                <th className="font-medium px-3 py-2.5 hidden md:table-cell">AO</th>
                <th className="font-medium px-3 py-2.5">Type</th>
                <th className="font-medium px-3 py-2.5">Statut</th>
                <th className="font-medium px-3 py-2.5 hidden lg:table-cell">Par</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-3 py-2 tabular whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{fmt(l.created_at)}</td>
                  <td className="px-3 py-2">
                    <div style={{ color: 'var(--text)' }}>{l.recipient_name || '—'}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{l.recipient_email}</div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>{l.ao_title || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{KIND_LABEL[l.kind] || l.kind}</td>
                  <td className="px-3 py-2">
                    {l.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--success)' }}>
                        <CheckCircle size={12} /> Envoyé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--danger)' }} title={l.error || ''}>
                        <AlertCircle size={12} /> Échec
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell" style={{ color: 'var(--text-faint)' }}>{l.sent_by_name || 'Système'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
