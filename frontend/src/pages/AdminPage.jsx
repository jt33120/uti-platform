import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  Gauge, Users, FileText, Sparkles, Ticket, UserPlus, X, Loader2,
  Shield, Briefcase, BadgePercent, Check, RotateCcw, Inbox,
} from 'lucide-react'
import InviteModal from '../components/InviteModal'

const ROLE_META = {
  admin: { label: 'Administrateur', icon: Shield },
  commerce: { label: 'Commercial UTI', icon: BadgePercent },
  ao: { label: 'Partenaire', icon: Briefcase },
}

const fmtDate = (iso) => iso
  ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
  : '—'
const fmtDateTime = (iso) => iso
  ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  : 'Jamais'

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex flex-col gap-1.5 lg:px-5 lg:border-l lg:first:border-l-0 lg:first:pl-0 border-[color:var(--border)]">
      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
        <Icon size={14} strokeWidth={2} />
        <span className="text-[11px] uppercase tracking-[0.07em] font-semibold">{label}</span>
      </div>
      <div className="text-[30px] font-semibold tabular leading-none" style={{ color: 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{sub}</div>}
    </div>
  )
}

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || { label: role, icon: Users }
  const Icon = meta.icon
  return (
    <span className="badge" style={{
      background: role === 'ao' ? 'var(--surface-2)' : 'var(--accent-soft)',
      color: role === 'ao' ? 'var(--text-muted)' : 'var(--accent-text)',
    }}>
      <Icon size={10} strokeWidth={2} /> {meta.label}
    </span>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [overview, setOverview] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [pending, setPending] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [ticketBusy, setTicketBusy] = useState(null)
  const [ticketFilter, setTicketFilter] = useState('open')

  const load = async () => {
    const settle = (p) => p.then(r => ({ ok: true, data: r.data })).catch(() => ({ ok: false }))
    const [o, a, t] = await Promise.all([
      settle(api.get('/admin/overview')),
      settle(api.get('/admin/accounts')),
      settle(api.get('/admin/tickets')),
    ])
    if (o.ok) setOverview(o.data)
    if (a.ok) { setAccounts(a.data.accounts || []); setPending(a.data.pending_invitations || []) }
    if (t.ok) setTickets(t.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deleteAccount = async (acc) => {
    if (!(await confirm({
      title: 'Supprimer ce compte ?',
      message: `Le compte « ${acc.name} » (${acc.email}) sera supprimé définitivement. Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
    }))) return
    setDeletingId(acc.id)
    try {
      await api.delete(`/admin/accounts/${acc.id}`)
      setAccounts(p => p.filter(a => a.id !== acc.id))
      // Keep the KPI tiles in sync without a full reload
      setOverview(o => o ? {
        ...o,
        accounts_total: Math.max(0, (o.accounts_total || 1) - 1),
        accounts_by_role: { ...o.accounts_by_role, [acc.role]: Math.max(0, (o.accounts_by_role?.[acc.role] || 1) - 1) },
      } : o)
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  const setTicketStatus = async (ticket, status) => {
    setTicketBusy(ticket.id)
    try {
      await api.patch(`/admin/tickets/${ticket.id}`, { status })
      setTickets(p => p.map(t => (t.id === ticket.id ? { ...t, status } : t)))
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur de mise à jour du ticket')
    } finally {
      setTicketBusy(null)
    }
  }

  const shownTickets = tickets.filter(t =>
    ticketFilter === 'all' ? true : (t.status || 'open') === ticketFilter
  )
  const openCount = tickets.filter(t => (t.status || 'open') === 'open').length
  const hairline = { borderTop: '1px solid var(--border)' }

  if (loading) {
    return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-faint)' }}>Chargement de la supervision…</div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Gauge size={20} strokeWidth={1.75} style={{ color: 'var(--accent-text)' }} />
            Supervision
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Comptes, tickets et activité de la plateforme.
          </p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="btn-primary">
          <UserPlus size={15} strokeWidth={1.75} /> Inviter un compte
        </button>
      </div>

      {/* KPIs */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 pb-8">
          <Kpi icon={Users} label="Comptes" value={overview.accounts_total}
            sub={Object.entries(overview.accounts_by_role || {})
              .map(([r, n]) => `${n} ${ROLE_META[r]?.label?.toLowerCase() || r}${n > 1 ? 's' : ''}`)
              .join(' · ') || null} />
          <Kpi icon={Users} label="Actifs (30 j)" value={overview.active_accounts_30d}
            sub="connexions sur 30 jours" />
          <Kpi icon={FileText} label="AOs" value={overview.aos_total}
            sub={`${overview.aos_open ?? 0} ouverts · ${overview.aos_30d ?? 0} créés / 30 j`} />
          <Kpi icon={Sparkles} label="Activité 30 j" value={overview.submissions_30d}
            sub={`CVs soumis · ${overview.matchings_30d ?? 0} matchings`} />
        </div>
      )}

      {/* Comptes */}
      <div className="pt-7" style={hairline}>
        <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
          <Users size={13} strokeWidth={2} /> Comptes ({accounts.length})
        </h2>
        <div className="card overflow-hidden mb-4">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border)' }}>
                <th className="font-medium px-4 py-2.5">Nom</th>
                <th className="font-medium px-4 py-2.5 hidden md:table-cell">Email</th>
                <th className="font-medium px-4 py-2.5">Rôle</th>
                <th className="font-medium px-4 py-2.5 hidden md:table-cell">Dernière connexion</th>
                <th className="font-medium px-4 py-2.5 hidden xl:table-cell">Créé le</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-[var(--surface-2)] transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text)' }}>
                    {acc.name}
                    {acc.id === user?.id && <span className="ml-1.5 text-[10px]" style={{ color: 'var(--text-faint)' }}>(vous)</span>}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>{acc.email}</td>
                  <td className="px-4 py-2.5"><RoleBadge role={acc.role} /></td>
                  <td className="px-4 py-2.5 hidden md:table-cell tabular" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(acc.last_login_at)}</td>
                  <td className="px-4 py-2.5 hidden xl:table-cell tabular" style={{ color: 'var(--text-faint)' }}>{fmtDate(acc.created_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {acc.id !== user?.id && (
                      <button
                        onClick={() => deleteAccount(acc)}
                        disabled={deletingId === acc.id}
                        className="p-1 rounded transition-colors text-[var(--text-faint)] hover:text-[var(--danger)]"
                        title="Supprimer le compte"
                      >
                        {deletingId === acc.id ? <Loader2 size={13} className="animate-spin" /> : <X size={14} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pending.length > 0 && (
          <div className="mb-2">
            <h3 className="text-[11px] uppercase tracking-[0.08em] font-semibold mb-2" style={{ color: 'var(--text-faint)' }}>
              Invitations en attente ({pending.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {pending.map(inv => (
                <span key={inv.id} className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {inv.name || inv.email} · {ROLE_META[inv.role]?.label || inv.role} · expire le {fmtDate(inv.expires_at)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tickets */}
      <div className="pt-7 mt-7" style={hairline}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
            <Ticket size={13} strokeWidth={2} /> Tickets support ({openCount} ouvert{openCount > 1 ? 's' : ''})
          </h2>
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--surface-2)' }}>
            {[{ k: 'open', l: 'Ouverts' }, { k: 'resolved', l: 'Traités' }, { k: 'all', l: 'Tous' }].map(o => (
              <button key={o.k} onClick={() => setTicketFilter(o.k)}
                className={ticketFilter === o.k ? 'seg-active px-3 py-1 text-xs rounded-md font-medium' : 'px-3 py-1 text-xs rounded-md font-medium text-[var(--text-muted)] hover:text-[var(--text)]'}>
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {shownTickets.length === 0 ? (
          <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
            <Inbox size={26} className="mx-auto mb-2 opacity-50" />
            {ticketFilter === 'open' ? 'Aucun ticket ouvert. 🎉' : 'Aucun ticket.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {shownTickets.map(t => {
              const resolved = (t.status || 'open') === 'resolved'
              return (
                <div key={t.id} className="card p-4" style={resolved ? { opacity: 0.65 } : undefined}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{t.subject}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
                        {t.from_name} ({t.from_email}) · {t.type} · {fmtDateTime(t.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => setTicketStatus(t, resolved ? 'open' : 'resolved')}
                      disabled={ticketBusy === t.id}
                      className="btn-ghost shrink-0 !h-7 !px-2.5 text-[11px]"
                      title={resolved ? 'Rouvrir' : 'Marquer comme traité'}
                    >
                      {ticketBusy === t.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : resolved
                          ? <><RotateCcw size={11} strokeWidth={2} /> Rouvrir</>
                          : <><Check size={12} strokeWidth={2} /> Traité</>}
                    </button>
                  </div>
                  <p className="text-[12.5px] whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {t.message}
                  </p>
                  <a
                    href={`mailto:${t.from_email}?subject=${encodeURIComponent(`Re: ${t.subject}`)}`}
                    className="inline-flex items-center gap-1 mt-2 text-[11.5px] font-medium hover:underline"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    Répondre par email
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={() => { setInviteOpen(false); load() }} />}
    </div>
  )
}
