import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, FileText, LogOut, Plus,
  Building2, Network
} from 'lucide-react'
import clsx from 'clsx'

const NavItem = ({ to, icon: Icon, label, end = false }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
        isActive
          ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      )
    }
  >
    <Icon size={16} className="shrink-0" />
    {label}
  </NavLink>
)

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-navy-950 border-r border-white/5">
        <div className="px-4 py-4 border-b border-white/5">
          <img src="/logo.jpeg" alt="UTI Group" className="h-12 w-auto object-contain rounded-xl shadow-md ring-1 ring-white/10" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 px-3 mb-2">Navigation</p>

          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />
          <NavItem to="/aos" icon={FileText} label="Appels d'offres" />
          <NavItem to="/clients" icon={Building2} label="Clients" />
          <NavItem to="/consultants" icon={Users} label="Consultants" />

          {isAdmin && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-slate-600 px-3 mt-5 mb-2">Admin</p>
              <NavItem to="/aos/new" icon={Plus} label="Nouvel AO" />
              <NavItem to="/clients?new=1" icon={Plus} label="Nouveau client" />
              <NavItem to="/partners-access" icon={Network} label="Gestion partenaires" />
            </>
          )}

          {!isAdmin && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-slate-600 px-3 mt-5 mb-2">Actions</p>
              <NavItem to="/consultants/new" icon={Plus} label="Ajouter consultant" />
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">{user?.name}</div>
              <div className={clsx(
                'text-[10px] font-medium uppercase tracking-wide',
                user?.role === 'admin' ? 'text-brand-400' : 'text-emerald-400'
              )}>
                {user?.role === 'admin' ? 'Administrateur' : 'Partenaire'}
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-600 hover:text-red-400 transition-colors" title="Déconnexion">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-navy-900">
        <div className="p-6 max-w-6xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
