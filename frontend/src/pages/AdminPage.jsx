import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  Gauge, Users, FileText, Sparkles, UserPlus, X, Loader2,
  Shield, Briefcase, BadgePercent, Coins, Pencil, PauseCircle, Ban,
} from 'lucide-react'
import InviteModal from '../components/InviteModal'
import AccountEditModal from '../components/AccountEditModal'

const ROLE_META = {
  admin: { label: 'Administrateur', icon: Shield },
  commerce: { label: 'Commercial UTI', icon: BadgePercent },
  ao: { label: 'Partenaire', icon: Briefcase },
}

// Role label that accounts for the commercial entity (UTI vs Groupement-IT).
const roleLabel = (item) =>
  item.role === 'commerce'
    ? (item.org === 'groupement-it' ? 'Commercial Groupement-IT' : 'Commercial UTI')
    : (ROLE_META[item.role]?.label || item.role)

const STATUS_META = {
  suspended: { label: 'Suspendu', icon: PauseCircle, color: 'var(--warning, #b45309)' },
  disabled: { label: 'Désactivé', icon: Ban, color: 'var(--danger)' },
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

function RoleBadge({ item }) {
  const meta = ROLE_META[item.role] || { label: item.role, icon: Users }
  const Icon = meta.icon
  return (
    <span className="badge" style={{
      background: item.role === 'ao' ? 'var(--surface-2)' : 'var(--accent-soft)',
      color: item.role === 'ao' ? 'var(--text-muted)' : 'var(--accent-text)',
    }}>
      <Icon size={10} strokeWidth={2} /> {roleLabel(item)}
    </span>
  )
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <span className="badge ml-1.5" style={{ background: 'var(--surface-2)', color: meta.color }}>
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
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    const settle = (p) => p.then(r => ({ ok: true, data: r.data })).catch(() => ({ ok: false }))
    const [o, a] = await Promise.all([
      settle(api.get('/admin/overview')),
      settle(api.get('/admin/accounts')),
    ])
    if (o.ok) setOverview(o.data)
    if (a.ok) { setAccounts(a.data.accounts || []); setPending(a.data.pending_invitations || []) }
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

  const onAccountSaved = (updated) => {
    setAccounts(p => p.map(a => (a.id === updated.id ? { ...a, ...updated } : a)))
    setEditing(null)
  }

  const hairline = { borderTop: '1px solid var(--border)' }

  if (loading) {
    return <div className="py-20 text-center text-sm" style={{ color: 'var(--text-faint)' }}>Chargement des comptes…</div>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Gauge size={20} strokeWidth={1.75} style={{ color: 'var(--accent-text)' }} />
            Admin comptes Utilisateurs
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Comptes, accès et activité de la plateforme.
          </p>
        </div>
        <button onClick={() => setInviteOpen(true)} className="btn-primary">
          <UserPlus size={15} strokeWidth={1.75} /> Inviter un compte
        </button>
      </div>

      {/* KPIs */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-y-6 pb-8">
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
          <Kpi icon={Coins} label="Coût IA" value={overview.matching_cost_usd != null ? `$${overview.matching_cost_usd}` : '—'}
            sub={`cumulé · ${overview.matchings_total ?? 0} matchings`} />
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
                    <StatusBadge status={acc.status} />
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>{acc.email}</td>
                  <td className="px-4 py-2.5"><RoleBadge item={acc} /></td>
                  <td className="px-4 py-2.5 hidden md:table-cell tabular" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(acc.last_login_at)}</td>
                  <td className="px-4 py-2.5 hidden xl:table-cell tabular" style={{ color: 'var(--text-faint)' }}>{fmtDate(acc.created_at)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(acc)}
                      className="p-1 rounded transition-colors text-[var(--text-faint)] hover:text-[var(--text)]"
                      title="Modifier le compte"
                    >
                      <Pencil size={14} />
                    </button>
                    {acc.id !== user?.id && (
                      <button
                        onClick={() => deleteAccount(acc)}
                        disabled={deletingId === acc.id}
                        className="p-1 rounded transition-colors text-[var(--text-faint)] hover:text-[var(--danger)] ml-0.5"
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
                  {inv.name || inv.email} · {roleLabel(inv)} · expire le {fmtDate(inv.expires_at)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={() => { setInviteOpen(false); load() }} />}
      {editing && (
        <AccountEditModal
          account={editing}
          isSelf={editing.id === user?.id}
          onClose={() => setEditing(null)}
          onSaved={onAccountSaved}
        />
      )}
    </div>
  )
}
