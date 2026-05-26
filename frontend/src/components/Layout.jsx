import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, FileText, LogOut, Plus,
  Building2, Network, Sun, Moon, UserPlus, UserCheck, Package
} from 'lucide-react'
import clsx from 'clsx'
import InviteModal from './InviteModal'

const NavItem = ({ to, icon: Icon, label, end = false }) => (
  <NavLink
    to={to}
    end={end}
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

const NavButton = ({ onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
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
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    // Keep legacy `light` class out of the way
    document.documentElement.classList.remove('light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

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
        <div className="px-4 h-14 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <img src="/logo.jpeg" alt="UTI Group" className="h-7 w-7 rounded object-cover" />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tightest text-[var(--text)]">UTI Group</div>
            <div className="text-[10px] text-[var(--text-faint)]">Plateforme Partenaires</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />
          <NavItem to="/aos" icon={FileText} label={isAdmin ? "Appels d'offres" : "Mes AOs"} />
          <NavItem to="/clients" icon={Building2} label={isAdmin ? "Clients" : "Mes clients"} />
          <NavItem to="/consultants" icon={Users} label={isAdmin ? "Consultants" : "Mes consultants"} />

          {isAdmin && (
            <>
              <SectionLabel>Raccourcis</SectionLabel>
              <NavItem to="/partners" icon={UserCheck} label="Partenaires" />
              <NavItem to="/aos/new" icon={Plus} label="Nouvel AO" />
              <NavItem to="/clients/new" icon={Plus} label="Nouveau client" />
              <NavButton onClick={() => setInviteOpen(true)} icon={UserPlus} label="Inviter partenaire" />
              <NavItem to="/partners-access" icon={Network} label="Accès partenaires" />
              <NavItem to="/pacs" icon={Package} label="PACs" />
            </>
          )}

          {!isAdmin && (
            <>
              <SectionLabel>Raccourcis</SectionLabel>
              <NavItem to="/consultants/new" icon={Plus} label="Ajouter consultant" />
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5 px-2 h-11">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                 style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate text-[var(--text)]">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-medium">
                {user?.role === 'admin' ? 'Administrateur' : 'Partenaire'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
              title="Déconnexion"
            >
              <LogOut size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      {/* Main */}
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {/* Top bar */}
        <div
          className="h-14 flex items-center justify-end px-6"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <button
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
    </div>
  )
}
