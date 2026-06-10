import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, FileText, LogOut, Plus,
  Building2, Network, Sun, Moon, UserPlus, UserCheck, Package, Settings,
  HelpCircle, Mail, Compass, Gauge
} from 'lucide-react'
import clsx from 'clsx'
import InviteModal from './InviteModal'
import SettingsModal from './SettingsModal'
import ContactModal from './ContactModal'
import AssistantWidget from './AssistantWidget'
import OnboardingTour from './OnboardingTour'

const TOUR_KEY = 'uti_tour_v1' // bump suffix to re-show the tour to everyone

const ADMIN_STEPS = [
  { selector: '[data-tour="brand"]', title: 'Bienvenue 👋', text: "Voici un tour rapide de la plateforme UTI Group. Vous pouvez le passer à tout moment." },
  { selector: '[data-tour="nav-aos"]', title: "Appels d'offres", text: "Créez et suivez vos AOs. En ouvrant un AO, le matching IA se lance automatiquement et vous visualisez la couverture (partenaires & consultants) ainsi que la date limite." },
  { selector: '[data-tour="nav-clients"]', title: 'Clients', text: 'Gérez vos comptes clients — chaque appel d’offres est rattaché à un client.' },
  { selector: '[data-tour="nav-consultants"]', title: 'Vivier de consultants', text: 'Retrouvez tous les consultants proposés par les partenaires.' },
  { selector: '[data-tour="nav-partners"]', title: 'Partenaires & accès', text: 'Invitez des partenaires et définissez leurs accès par client (Liste 1 / Liste 2).' },
  { selector: '[data-tour="nav-new-ao"]', title: 'Créer un AO', text: 'Le raccourci pour publier un nouvel appel d’offres en quelques secondes.' },
  { selector: '[data-tour="assistant"]', title: 'Assistant', text: 'Votre copilote : il vous guide vers la bonne page et pré-remplit les formulaires — mais ne valide jamais à votre place.' },
  { selector: '[data-tour="theme"]', title: 'Thème clair / sombre', text: 'Basculez l’apparence quand vous le souhaitez.' },
]

const COMMERCE_STEPS = [
  { selector: '[data-tour="brand"]', title: 'Bienvenue 👋', text: "Voici un tour rapide de votre espace commercial UTI. Vous pouvez le passer à tout moment." },
  { selector: '[data-tour="nav-aos"]', title: "Appels d'offres", text: "Votre cœur de métier : créez les besoins clients et suivez-les. Le matching IA se lance automatiquement à chaque CV reçu — et dès la création, des consultants du vivier vous sont recommandés." },
  { selector: '[data-tour="nav-new-ao"]', title: 'Créer un AO', text: "Le raccourci pour publier un besoin en quelques secondes — l'IA peut le générer depuis un email." },
  { selector: '[data-tour="nav-consultants"]', title: 'Vivier de consultants', text: "Tous les consultants des partenaires, en consultation. Un bouton vous permet de contacter directement le partenaire porteur." },
  { selector: '[data-tour="nav-clients"]', title: 'Clients', text: "Tous les clients, en lecture : la création et la modification restent réservées aux administrateurs." },
  { selector: '[data-tour="nav-partners"]', title: 'Partenaires', text: "La même vue que les administrateurs, en lecture seule — les rattachements partenaires ↔ clients ne sont pas modifiables." },
  { selector: '[data-tour="assistant"]', title: 'Assistant', text: 'Votre copilote : il répond sur vos données, vous guide et pré-remplit les formulaires — sans jamais valider à votre place.' },
]

const AO_STEPS = [
  { selector: '[data-tour="brand"]', title: 'Bienvenue 👋', text: 'Voici un tour rapide de la plateforme. Vous pouvez le passer à tout moment.' },
  { selector: '[data-tour="nav-aos"]', title: 'Mes appels d’offres', text: 'Consultez les AOs auxquels vous avez accès et proposez vos consultants en y joignant un CV. Vous verrez ensuite votre score IA.' },
  { selector: '[data-tour="nav-clients"]', title: 'Mes clients', text: 'Les clients pour lesquels vous êtes habilité à répondre.' },
  { selector: '[data-tour="nav-consultants"]', title: 'Mon vivier', text: 'Gérez vos consultants ici ; vous les proposez ensuite depuis la page d’un AO.' },
  { selector: '[data-tour="nav-add-consultant"]', title: 'Ajouter un consultant', text: 'Le raccourci pour enrichir votre vivier.' },
  { selector: '[data-tour="nav-contact"]', title: 'Contacter l’équipe', text: 'Une question ou un souci ? Écrivez-nous directement.' },
  { selector: '[data-tour="assistant"]', title: 'Assistant', text: 'Votre copilote : il vous guide et pré-remplit les formulaires, sans jamais valider à votre place.' },
]

const NavItem = ({ to, icon: Icon, label, end = false, tour }) => (
  <NavLink
    to={to}
    end={end}
    data-tour={tour}
    className={({ isActive }) =>
      clsx(
        'flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] font-medium transition-colors',
        isActive
          ? 'bg-[var(--surface-2)] text-[var(--text)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
      )
    }
  >
    <Icon size={15} className="shrink-0" strokeWidth={1.75} />
    <span className="truncate">{label}</span>
  </NavLink>
)

const NavButton = ({ onClick, icon: Icon, label, tour }) => (
  <button
    onClick={onClick}
    data-tour={tour}
    className="flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] font-medium transition-colors w-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
  >
    <Icon size={15} className="shrink-0" strokeWidth={1.75} />
    <span className="truncate">{label}</span>
  </button>
)

const SectionLabel = ({ children }) => (
  <p className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--text-faint)] px-2.5 mt-5 mb-1.5">
    {children}
  </p>
)

export default function Layout() {
  const { user, logout, isAdmin, isCommerce, isStaff } = useAuth()
  const navigate = useNavigate()

  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactDefaultType, setContactDefaultType] = useState('question')
  const [showTour, setShowTour] = useState(false)
  const profileMenuRef = useRef(null)

  const openContact = (type = 'question') => {
    setContactDefaultType(type)
    setContactOpen(true)
  }

  // First-login product tour — shown once per user (cached in localStorage),
  // never on subsequent connections.
  const tourStorageKey = user ? `${TOUR_KEY}_${user.id}` : null
  useEffect(() => {
    if (!tourStorageKey) return
    if (localStorage.getItem(tourStorageKey)) return
    const t = setTimeout(() => setShowTour(true), 700) // let the layout settle
    return () => clearTimeout(t)
  }, [tourStorageKey])

  const finishTour = () => {
    if (tourStorageKey) localStorage.setItem(tourStorageKey, 'done')
    setShowTour(false)
  }
  const replayTour = () => { setProfileMenuOpen(false); setShowTour(true) }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.classList.remove('light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
      }
    }
    if (profileMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-[232px] shrink-0 flex flex-col"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Brand */}
        <div data-tour="brand" className="px-4 h-14 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <img src="/logo.jpeg" alt="UTI Group" className="h-7 w-7 rounded object-cover" />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tightest text-[var(--text)]">UTI Group</div>
            <div className="text-[10px] text-[var(--text-faint)]">Plateforme Partenaires</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" end tour="nav-dashboard" />
          <NavItem to="/aos" icon={FileText} label={isStaff ? "Appels d'offres" : "Mes AOs"} tour="nav-aos" />
          <NavItem to="/clients" icon={Building2} label={isStaff ? "Clients" : "Mes clients"} tour="nav-clients" />
          <NavItem to="/consultants" icon={Users} label={isStaff ? "Consultants" : "Mes consultants"} tour="nav-consultants" />

          {isAdmin && (
            <>
              <SectionLabel>Raccourcis</SectionLabel>
              <NavItem to="/partners" icon={UserCheck} label="Partenaires" tour="nav-partners" />
              <NavItem to="/aos/new" icon={Plus} label="Nouvel AO" tour="nav-new-ao" />
              <NavItem to="/clients/new" icon={Plus} label="Nouveau client" />
              <NavButton onClick={() => setInviteOpen(true)} icon={UserPlus} label="Inviter un compte" />
              <NavItem to="/partners-access" icon={Network} label="Accès partenaires" />
              <NavItem to="/graph" icon={Compass} label="Cartographie" />
              <NavItem to="/pacs" icon={Package} label="PACs" />
              <SectionLabel>Administration</SectionLabel>
              <NavItem to="/admin" icon={Gauge} label="Supervision" />
            </>
          )}

          {isCommerce && (
            <>
              <SectionLabel>Raccourcis</SectionLabel>
              <NavItem to="/aos/new" icon={Plus} label="Nouvel AO" tour="nav-new-ao" />
              <NavItem to="/partners" icon={UserCheck} label="Partenaires" tour="nav-partners" />
              <NavItem to="/partners-access" icon={Network} label="Accès partenaires" />
              <NavItem to="/graph" icon={Compass} label="Cartographie" />
              <NavButton onClick={() => openContact('question')} icon={Mail} label="Contacter l'équipe" tour="nav-contact" />
            </>
          )}

          {!isStaff && (
            <>
              <SectionLabel>Raccourcis</SectionLabel>
              <NavItem to="/consultants/new" icon={Plus} label="Ajouter consultant" tour="nav-add-consultant" />
              <NavButton onClick={() => openContact('question')} icon={Mail} label="Contacter l'équipe" tour="nav-contact" />
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-2 relative" style={{ borderTop: '1px solid var(--border)' }} ref={profileMenuRef}>
          {/* Profile popover menu */}
          {profileMenuOpen && (
            <div
              className="absolute left-2 right-2 card py-1"
              style={{ bottom: 'calc(100% + 4px)', zIndex: 50 }}
            >
              <button
                onClick={() => { setProfileMenuOpen(false); setSettingsOpen(true) }}
                className="flex items-center gap-2.5 w-full px-3 h-8 text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors rounded"
              >
                <Settings size={14} strokeWidth={1.75} />
                Paramètres du profil
              </button>
              <button
                onClick={replayTour}
                className="flex items-center gap-2.5 w-full px-3 h-8 text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors rounded"
              >
                <Compass size={14} strokeWidth={1.75} />
                Revoir le tutoriel
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3 h-8 text-[13px] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors rounded"
              >
                <LogOut size={14} strokeWidth={1.75} />
                Déconnexion
              </button>
            </div>
          )}

          <button
            onClick={() => setProfileMenuOpen(o => !o)}
            className="flex items-center gap-2.5 px-2 h-11 w-full rounded-md transition-colors hover:bg-[var(--surface-2)]"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Avatar"
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                   style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12px] font-medium truncate text-[var(--text)]">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">
                {user?.role === 'admin' ? 'Administrateur' : user?.role === 'commerce' ? 'Commercial UTI' : 'Partenaire'}
              </div>
            </div>
          </button>
        </div>
      </aside>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {contactOpen && <ContactModal defaultType={contactDefaultType} onClose={() => setContactOpen(false)} />}

      {/* Main */}
      <main className="flex-1 overflow-y-auto app-bg">
        {/* Top bar */}
        <div
          className="h-14 flex items-center justify-end gap-1 px-6"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => openContact('bug')}
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            title="Aide / Signaler un problème"
          >
            <HelpCircle size={15} strokeWidth={1.75} />
          </button>
          <button
            data-tour="theme"
            onClick={() => setDark(d => !d)}
            className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            title={dark ? 'Passer en clair' : 'Passer en sombre'}
          >
            {dark ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          </button>
        </div>
        <div className="px-6 py-6 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Floating AI assistant — routes & pre-fills, never submits */}
      <AssistantWidget />

      {/* First-login guided tour (role-aware, shown once) */}
      {showTour && (
        <OnboardingTour
          steps={isAdmin ? ADMIN_STEPS : isCommerce ? COMMERCE_STEPS : AO_STEPS}
          onClose={finishTour}
        />
      )}
    </div>
  )
}
