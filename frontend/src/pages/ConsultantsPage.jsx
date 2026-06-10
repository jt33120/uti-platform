import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  Users, Plus, X, Search, Euro, Clock, Briefcase,
  Mail, Loader2, Check, UserCircle2,
} from 'lucide-react'
import clsx from 'clsx'

function SkillTag({ skill }) {
  return (
    <span className="badge bg-brand-600/10 text-brand-300 border border-brand-500/15 text-[10px]">
      {skill.trim()}
    </span>
  )
}

function EmploymentBadge({ type }) {
  if (!type) return null
  const label = type === 'salarie' ? 'Salarié' : 'Indépendant'
  return (
    <span className="badge text-[10px]" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      {label}
    </span>
  )
}

// Email the partner who carries this consultant — pre-filled, sent via the
// backend SMTP (Reply-To = the staff member writing it).
function ContactPartnerModal({ consultant, onClose }) {
  const [subject, setSubject] = useState(`[UTI Group] Au sujet de votre consultant ${consultant.name}`)
  const [message, setMessage] = useState(
    `Bonjour ${consultant.owner?.name || ''},\n\n`
    + `Je vous contacte au sujet de votre consultant ${consultant.name}`
    + `${consultant.skills ? ` (${consultant.skills.split(',').slice(0, 3).map(s => s.trim()).join(', ')})` : ''}.\n\n`
    + `\n\nCordialement,`
  )
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const send = async (e) => {
    e.preventDefault()
    setSending(true); setError('')
    try {
      await api.post(`/consultants/${consultant.id}/contact-partner`, { subject, message })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || "Échec d'envoi de l'email")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="card p-5 w-full max-w-[480px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tightest" style={{ color: 'var(--text)' }}>
              Contacter le partenaire
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {consultant.owner?.name} — à propos de {consultant.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text)]">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {sent ? (
          <div className="space-y-3.5">
            <div className="text-[13px] rounded-md px-3 py-2.5 flex items-center gap-2"
                 style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <Check size={14} strokeWidth={2} />
              Email envoyé à {consultant.owner?.name}. Il pourra vous répondre directement.
            </div>
            <button onClick={onClose} className="btn-primary w-full justify-center">Fermer</button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3.5">
            <div>
              <label className="label">Sujet</label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)} required />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input min-h-[150px] resize-y" value={message} onChange={e => setMessage(e.target.value)} required />
            </div>
            {error && (
              <div className="text-[13px] rounded-md px-3 py-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
              <button type="submit" disabled={sending} className="btn-primary flex-1 justify-center">
                {sending ? <><Loader2 size={13} className="animate-spin" /> Envoi…</> : <><Mail size={13} strokeWidth={1.75} /> Envoyer</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function ConsultantCard({ consultant, onDelete, canDelete, canContact, onContact }) {
  const skills = consultant.skills?.split(',').slice(0, 4) || []
  const extraSkills = (consultant.skills?.split(',').length || 0) - 4
  // CVs are anonymised at upload — names are usually initials / trigrams
  const ownerIsPartner = consultant.owner?.role === 'ao'

  return (
    <div className="card p-4 hover:border-white/10 transition-all duration-150 group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
               style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
            {consultant.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{consultant.name}</div>
            {consultant.experience_years && (
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock size={10} />
                {consultant.experience_years} ans d'expérience
              </div>
            )}
          </div>
        </div>
        {consultant.tjm && (
          <div className="flex items-center gap-0.5 text-xs font-medium rounded-lg px-2 py-1 shrink-0"
               style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
            <Euro size={10} />
            {consultant.tjm}/j
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <EmploymentBadge type={consultant.employment_type} />
        {skills.map((s, i) => <SkillTag key={i} skill={s} />)}
        {extraSkills > 0 && (
          <span className="badge bg-white/5 text-slate-400 text-[10px]">+{extraSkills}</span>
        )}
      </div>

      {/* Porteur — who carries this consultant, with one-click contact */}
      {consultant.owner && (
        <div className="flex items-center gap-1.5 mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <UserCircle2 size={12} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">
            Porté par <span className="font-medium" style={{ color: 'var(--text)' }}>{consultant.owner.name}</span>
          </span>
          {canContact && ownerIsPartner && (
            <button
              onClick={() => onContact(consultant)}
              className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium transition-colors"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
              title={`Envoyer un email à ${consultant.owner.name}`}
            >
              <Mail size={10} strokeWidth={2} /> Contacter
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs text-slate-500">
        {consultant.availability && (
          <span className="inline-flex items-center gap-1">
            <Briefcase size={10} /> {consultant.availability}
          </span>
        )}
        <span className="ml-auto text-slate-700">
          {new Date(consultant.created_at).toLocaleDateString('fr-FR')}
        </span>
        {canDelete && (
          <button onClick={() => onDelete(consultant.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Supprimer">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function ConsultantsPage() {
  const { isAdmin, isStaff, isCommerce } = useAuth()
  const confirm = useConfirm()
  const [consultants, setConsultants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [contactFor, setContactFor] = useState(null)

  const fetchConsultants = async () => {
    try {
      const { data } = await api.get('/consultants')
      setConsultants(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConsultants() }, [])

  const handleDelete = async (id) => {
    if (!(await confirm({
      title: 'Supprimer ce consultant ?',
      message: 'Le consultant et toutes ses soumissions seront supprimés. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
    }))) return
    try {
      await api.delete(`/consultants/${id}`)
      setConsultants(p => p.filter(c => c.id !== id))
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  const filtered = consultants.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.skills?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <Users size={20} strokeWidth={1.75} style={{ color: 'var(--accent-text)' }} />
            Vivier de consultants
            <span className="text-sm font-normal text-slate-500">({consultants.length})</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isStaff
              ? 'Tous les consultants des partenaires — CV anonymisés (initiales / trigramme). Contactez le porteur en un clic.'
              : 'Vos consultants. Soumettez-les en réponse à des AOs depuis la page de l\'AO.'}
          </p>
        </div>
        {!isStaff && (
          <Link to="/consultants/new" className="btn-primary">
            <Plus size={15} />
            Ajouter
          </Link>
        )}
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Rechercher par nom, compétence..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">
            {search ? 'Aucun résultat' : 'Aucun consultant dans votre vivier'}
          </p>
          {!isStaff && (
            <Link to="/consultants/new" className="btn-primary mt-4 mx-auto">
              <Plus size={14} /> Ajouter le premier consultant
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ConsultantCard key={c.id} consultant={c}
                            onDelete={handleDelete}
                            canDelete={isAdmin || (!isStaff && !isCommerce)}
                            canContact={isStaff}
                            onContact={setContactFor} />
          ))}
        </div>
      )}

      {contactFor && (
        <ContactPartnerModal consultant={contactFor} onClose={() => setContactFor(null)} />
      )}
    </div>
  )
}
