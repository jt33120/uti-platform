import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, FileText, Bell, SlidersHorizontal } from 'lucide-react'
import clsx from 'clsx'
import { EmailTemplatesPanel } from './EmailTemplatesPage'
import { EmailLogPanel } from './NotificationsPage'
import NotificationSettings from '../components/NotificationSettings'

// Hub « Emails » : tout le cycle de vie au même endroit.
// Onglets gérés par rôle — Modèles & Réglages sont réservés à l'admin ;
// le Journal reste visible par tout le staff (admin + commerce).
const ALL_TABS = [
  { k: 'modeles', label: 'Modèles', icon: FileText, adminOnly: true },
  { k: 'journal', label: 'Journal des envois', icon: Bell, adminOnly: false },
  { k: 'reglages', label: "Réglages d'envoi", icon: SlidersHorizontal, adminOnly: true },
]

export default function EmailsPage() {
  const { isAdmin } = useAuth()
  const tabs = ALL_TABS.filter(t => !t.adminOnly || isAdmin)
  const [params, setParams] = useSearchParams()

  // Onglet courant : celui demandé s'il est autorisé, sinon le premier visible.
  const requested = params.get('tab')
  const active = tabs.find(t => t.k === requested)?.k || tabs[0].k

  const select = (k) => setParams(k === tabs[0].k ? {} : { tab: k }, { replace: true })

  return (
    <div className="animate-slide-up">
      <div className="mb-4">
        <h1 className="section-title flex items-center gap-2">
          <Mail size={20} strokeWidth={1.75} style={{ color: 'var(--accent-text)' }} />
          Emails
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Modèles, journal des envois et réglages des notifications, au même endroit.
        </p>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(t => {
          const Icon = t.icon
          const on = active === t.k
          return (
            <button
              key={t.k}
              onClick={() => select(t.k)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
                on ? 'border-current' : 'border-transparent hover:text-slate-200'
              )}
              style={{ color: on ? 'var(--accent-text)' : 'var(--text-muted)' }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {active === 'modeles' && <EmailTemplatesPanel />}
      {active === 'journal' && <EmailLogPanel />}
      {active === 'reglages' && <NotificationSettings />}
    </div>
  )
}
