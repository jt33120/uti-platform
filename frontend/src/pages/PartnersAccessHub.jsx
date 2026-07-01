import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Users, Package } from 'lucide-react'
import PartnerAccessPage from './PartnerAccessPage'
import PacsPage from './PacsPage'

// Page « Habilitations partenaires » à onglets :
//  - Par partenaire : la matrice réelle (partner_clients)
//  - Modèles        : les PACs (gabarits réutilisables) — admin uniquement
export default function PartnersAccessHub() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()

  const TABS = [
    { key: 'access', label: 'Par partenaire', icon: Users },
    ...(isAdmin ? [{ key: 'pacs', label: 'Modèles', icon: Package }] : []),
  ]

  const requested = params.get('tab')
  const active = TABS.some(t => t.key === requested) ? requested : 'access'

  const setActive = (key) => {
    const next = new URLSearchParams(params)
    if (key === 'access') next.delete('tab')
    else next.set('tab', key)
    setParams(next, { replace: true })
  }

  return (
    <div className="animate-slide-up">
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users size={19} strokeWidth={2} style={{ color: 'var(--accent-text)' }} />
            Habilitations partenaires
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Qui accède à quels clients, et via quels modèles réutilisables.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => {
          const Icon = t.icon
          const on = active === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
              style={{
                borderColor: on ? 'var(--accent)' : 'transparent',
                color: on ? 'var(--accent-text)' : 'var(--text-muted)',
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {active === 'pacs' && isAdmin
        ? <PacsPage embedded />
        : <PartnerAccessPage embedded />}
    </div>
  )
}
