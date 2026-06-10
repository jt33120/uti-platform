import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useConfirm } from '../contexts/ConfirmContext'
import {
  ArrowLeft, Zap, Euro, MapPin, Clock, Users, CheckCircle,
  AlertCircle, TrendingUp, Award, ChevronDown, ChevronUp,
  Loader2, FileText, Trash2, RotateCcw, Building2, Plus,
  Upload, X, UserCircle2, Briefcase, Calendar, Pencil,
  CalendarClock, AlertTriangle, BarChart3
} from 'lucide-react'

// Parse date-only strings ("YYYY-MM-DD") as *local* dates to avoid the UTC
// off-by-one; full timestamps fall back to native parsing.
const parseDateLocal = (iso) => {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso)
}

const formatDate = (iso) => {
  if (!iso) return null
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDateLocal(iso))
}

// Days between today (midnight) and the deadline date. Negative = past.
const daysUntil = (iso) => {
  if (!iso) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = parseDateLocal(iso); d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}
import clsx from 'clsx'

// ─── Score visuals (same as before) ─────────────────────────────
function ScoreRing({ score, size = 80 }) {
  const radius = (size / 2) - 8
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#3b82f6' : score >= 30 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} className="fill-none stroke-white/5" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      <text x={size/2} y={size/2} dominantBaseline="middle" textAnchor="middle"
        className="fill-white font-bold text-base rotate-90"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`, fontSize: size < 70 ? '13px' : '16px' }}>
        {score}
      </text>
    </svg>
  )
}

function RecoTag({ reco }) {
  const styles = {
    FORT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    MOYEN: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
    FAIBLE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  const labels = { FORT: '★ Recommandé', MOYEN: 'À considérer', FAIBLE: 'Peu adapté' }
  return (
    <span className={clsx('badge border text-xs', styles[reco] || styles.MOYEN)}>
      {labels[reco] || reco}
    </span>
  )
}

function BreakdownBar({ label, value, max }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className="text-white font-medium">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MatchCard({ result, rank }) {
  const [expanded, setExpanded] = useState(rank === 1)
  const bd = result.breakdown || {}
  const bdEntries = [
    { label: 'Compétences techniques', value: bd.competences_techniques ?? 0, max: 40 },
    { label: 'Séniorité', value: bd.seniorite ?? 0, max: 20 },
    { label: 'Contexte / domaine', value: bd.contexte_domaine ?? 0, max: 20 },
    { label: 'Compatibilité TJM', value: bd.compatibilite_tjm ?? 0, max: 20 },
  ]

  return (
    <div className={clsx('card overflow-hidden transition-all duration-200', rank === 1 && 'border-emerald-500/30 bg-emerald-500/3')}>
      {rank === 1 && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 flex items-center gap-1.5">
          <Award size={12} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-semibold">Meilleur match</span>
        </div>
      )}

      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/2 transition-colors"
           onClick={() => setExpanded(p => !p)}>
        <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
          {rank}
        </div>
        <ScoreRing score={result.score_total} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white">{result.consultant_name}</h3>
            <RecoTag reco={result.recommandation} />
            {result.employment_type && (
              <span className="badge bg-white/5 text-slate-400 text-[10px]">
                {result.employment_type === 'salarie' ? 'Salarié' : 'Indépendant'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{result.resume_matching}</p>
          {result.consultant_tjm && (
            <span className="text-xs text-emerald-400 mt-1 inline-flex items-center gap-0.5">
              <Euro size={10} />{result.consultant_tjm}€/j
            </span>
          )}
        </div>
        <button className="text-slate-600 hover:text-slate-300 transition-colors shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4 animate-fade-in">
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Détail du score</p>
            {bdEntries.map(e => <BreakdownBar key={e.label} {...e} />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {result.points_forts?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                  <CheckCircle size={11} /> Points forts
                </p>
                <ul className="space-y-1">
                  {result.points_forts.map((p, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5 shrink-0">·</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.points_faibles?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1">
                  <AlertCircle size={11} /> Points de vigilance
                </p>
                <ul className="space-y-1">
                  {result.points_faibles.map((p, i) => (
                    <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5 shrink-0">·</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {result.cv_url && (
            <a href={result.cv_url} target="_blank" rel="noopener noreferrer"
               className="btn-ghost text-xs w-full justify-center">
              <FileText size={13} /> Consulter le CV soumis
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Submission modal (partner submits a CV to this AO) ─────────
function SubmitModal({ aoId, vivier, onClose, onSubmitted, prefill }) {
  const fileRef = useRef(null)
  const [mode, setMode] = useState(prefill ? 'new' : (vivier.length > 0 ? 'existing' : 'new'))
  const [consultantId, setConsultantId] = useState(vivier[0]?.id || '')
  const [form, setForm] = useState({
    name: '', skills: '', tjm: '', experience_years: '',
    employment_type: 'independant', availability: '',
    ...(prefill || {}),
  })
  const [cvFile, setCvFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (file) => {
    if (file && file.type === 'application/pdf') {
      setCvFile(file)
      setError('')
    } else {
      setError('Seuls les fichiers PDF sont acceptés')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!cvFile) { setError('Veuillez joindre un CV PDF'); return }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('ao_id', aoId)
      fd.append('cv_file', cvFile)
      if (mode === 'existing') {
        if (!consultantId) { setError('Sélectionnez un consultant'); setLoading(false); return }
        fd.append('consultant_id', consultantId)
      } else {
        fd.append('name', form.name)
        fd.append('skills', form.skills)
        if (form.tjm) fd.append('tjm', form.tjm)
        if (form.experience_years) fd.append('experience_years', form.experience_years)
        if (form.employment_type) fd.append('employment_type', form.employment_type)
        if (form.availability) fd.append('availability', form.availability)
      }
      await api.post('/submissions', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSubmitted()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la soumission')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Proposer un consultant</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        {vivier.length > 0 && (
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-4">
            <button type="button" onClick={() => setMode('existing')}
              className={clsx('flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-all',
                mode === 'existing' ? 'seg-active' : 'text-slate-400 hover:text-slate-200')}>
              Depuis le vivier
            </button>
            <button type="button" onClick={() => setMode('new')}
              className={clsx('flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-all',
                mode === 'new' ? 'seg-active' : 'text-slate-400 hover:text-slate-200')}>
              Nouveau consultant
            </button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'existing' ? (
            <div>
              <label className="label">Consultant *</label>
              <div className="relative">
                <select className="input appearance-none pr-9" value={consultantId}
                        onChange={e => setConsultantId(e.target.value)}>
                  {vivier.map(c => (
                    <option key={c.id} value={c.id} className="bg-navy-900">
                      {c.name}{c.tjm ? ` · ${c.tjm}€/j` : ''}{c.employment_type ? ` · ${c.employment_type === 'salarie' ? 'Salarié' : 'Indépendant'}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Nom complet *</label>
                  <input className="input" required value={form.name}
                         onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Compétences clés *</label>
                  <input className="input" required placeholder="Python, React, AWS..."
                         value={form.skills}
                         onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} />
                </div>
                <div>
                  <label className="label">TJM (€/j)</label>
                  <input className="input" type="number" min="0"
                         value={form.tjm} onChange={e => setForm(p => ({ ...p, tjm: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Expérience (ans)</label>
                  <input className="input" type="number" min="0" max="50"
                         value={form.experience_years}
                         onChange={e => setForm(p => ({ ...p, experience_years: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Statut *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: 'independant', l: 'Indépendant' },
                      { v: 'salarie', l: 'Salarié' },
                    ].map(o => (
                      <button key={o.v} type="button"
                        onClick={() => setForm(p => ({ ...p, employment_type: o.v }))}
                        className={clsx(
                          'px-3 py-2 text-xs rounded-lg border font-medium transition-all',
                          form.employment_type === o.v
                            ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                        )}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="label">CV (PDF) *</label>
            {cvFile ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-emerald-300 truncate">{cvFile.name}</div>
                  <div className="text-xs text-slate-500">{(cvFile.size / 1024).toFixed(0)} Ko</div>
                </div>
                <button type="button" onClick={() => setCvFile(null)}
                        className="text-slate-500 hover:text-red-400">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div
                className={clsx(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150',
                  dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-white/10 hover:border-white/20'
                )}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}>
                <Upload size={24} className="mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-400 font-medium">Glissez le PDF ou cliquez</p>
                <p className="text-[10px] text-slate-700 mt-1">PDF · Max 10MB</p>
                <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
                       onChange={e => handleFile(e.target.files[0])} />
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <><Loader2 size={14} className="animate-spin" />Envoi...</> : 'Soumettre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Submission row (admin sees all + partner name, partner sees their own) ────
function SubmissionRow({ sub, onDelete, canDelete, isAdmin, aoSkillsRequired }) {
  const c = sub.consultants || {}
  const submitter = sub.submitter || {}

  // Skills match: highlight consultant skills that match AO required skills
  const aoSkillsNorm = aoSkillsRequired
    ? aoSkillsRequired.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : []
  const cvSkills = c.skills ? c.skills.split(',').map(s => s.trim()).filter(Boolean) : []
  const matchCount = cvSkills.filter(s =>
    aoSkillsNorm.some(as => as.includes(s.toLowerCase()) || s.toLowerCase().includes(as))
  ).length

  return (
    <div className="p-3 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-all group">
      <div className="flex items-center gap-3">
        <UserCircle2 size={28} className="text-slate-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{c.name || 'Inconnu'}</span>
            {c.employment_type && (
              <span className="badge bg-white/5 text-slate-400 text-[10px]">
                {c.employment_type === 'salarie' ? 'Salarié' : 'Indépendant'}
              </span>
            )}
            {c.tjm && (
              <span className="text-[10px] text-emerald-400 inline-flex items-center gap-0.5">
                <Euro size={9} />{c.tjm}/j
              </span>
            )}
            {isAdmin && submitter.name && (
              <span className="text-[10px] text-brand-400/70 flex items-center gap-0.5">
                <UserCircle2 size={9} /> {submitter.name}
              </span>
            )}
          </div>
        </div>
        <a href={sub.cv_url} target="_blank" rel="noopener noreferrer"
           className="text-xs text-slate-400 hover:text-brand-400 inline-flex items-center gap-1 shrink-0">
          <FileText size={12} /> CV
        </a>
        {canDelete && (
          <button onClick={() => onDelete(sub.id)}
                  className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {cvSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pl-10">
          {cvSkills.slice(0, 5).map((skill, i) => {
            const matches = aoSkillsNorm.some(as => as.includes(skill.toLowerCase()) || skill.toLowerCase().includes(as))
            return (
              <span key={i} className={clsx('badge text-[9px]',
                matches
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/5 text-slate-500 border border-white/5'
              )}>
                {skill}
              </span>
            )
          })}
          {cvSkills.length > 5 && (
            <span className="badge bg-white/3 text-slate-600 text-[9px] border border-white/3">+{cvSkills.length - 5}</span>
          )}
          {aoSkillsNorm.length > 0 && (
            <span className="text-[9px] text-slate-600 ml-1 self-center">
              {matchCount}/{aoSkillsNorm.length} skills AO
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AO edit modal ──────────────────────────────────────────────
function AOEditModal({ ao, onClose, onSaved }) {
  const AO_TYPES = ['Assurance', 'Banque / Finance', 'IT / Dev', 'Énergie', 'Retail', 'Public', 'Santé', 'Autre']
  const [clients, setClients] = useState([])
  const [form, setForm] = useState({
    client_id: ao.client_id || '',
    title: ao.title || '',
    description: ao.description || '',
    skills_required: ao.skills_required || '',
    budget_max: ao.budget_max?.toString() || '',
    location: ao.location || '',
    duration: ao.duration || '',
    context: ao.context || '',
    ao_type: ao.ao_type || '',
    deadline: ao.deadline || '',
    status: ao.status || 'open',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const payload = { ...form }
      if (!payload.budget_max) delete payload.budget_max
      else payload.budget_max = parseInt(payload.budget_max)
      if (!payload.deadline) delete payload.deadline
      await api.patch(`/aos/${ao.id}`, payload)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Pencil size={14} className="text-brand-400" /> Modifier l'AO
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={14} /></button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Client *</label>
              <div className="relative">
                <select className="input appearance-none pr-9" value={form.client_id} onChange={set('client_id')} required>
                  <option value="" className="bg-navy-900">— Choisir un client —</option>
                  {clients.map(c => <option key={c.id} value={c.id} className="bg-navy-900">{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Titre *</label>
              <input className="input" required value={form.title} onChange={set('title')} />
            </div>
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea className="input min-h-[80px] resize-y" required value={form.description} onChange={set('description')} />
          </div>

          <div>
            <label className="label">
              Compétences requises * <span className="text-slate-500 font-normal">(séparées par des virgules)</span>
            </label>
            <input className="input" required value={form.skills_required} onChange={set('skills_required')} placeholder="Python, React, AWS..." />
          </div>

          <div>
            <label className="label">Contexte / Notes IA</label>
            <textarea className="input min-h-[60px] resize-y" value={form.context} onChange={set('context')} />
          </div>

          <div>
            <label className="label" style={{ color: 'var(--danger)' }}>Date limite de réponse</label>
            <input className="input" type="date" value={form.deadline} onChange={set('deadline')} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="label">Budget max (€/j)</label>
              <input className="input" type="number" min="0" value={form.budget_max} onChange={set('budget_max')} />
            </div>
            <div>
              <label className="label">Localisation</label>
              <input className="input" value={form.location} onChange={set('location')} />
            </div>
            <div>
              <label className="label">Durée</label>
              <input className="input" value={form.duration} onChange={set('duration')} />
            </div>
            <div>
              <label className="label">Type AO</label>
              <div className="relative">
                <select className="input appearance-none pr-9" value={form.ao_type} onChange={set('ao_type')}>
                  <option value="" className="bg-navy-900">—</option>
                  {AO_TYPES.map(t => <option key={t} value={t} className="bg-navy-900">{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Statut</label>
            <div className="flex gap-2">
              {[{ v: 'open', l: 'Ouvert' }, { v: 'closed', l: 'Fermé' }].map(o => (
                <button key={o.v} type="button"
                  onClick={() => setForm(p => ({ ...p, status: o.v }))}
                  className={clsx(
                    'px-4 py-2 text-xs rounded-lg border font-medium transition-all',
                    form.status === o.v
                      ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  )}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-xs px-3">Annuler</button>
            <button type="submit" disabled={loading} className="btn-primary text-xs px-4 flex items-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Deadline banner (big & red) ────────────────────────────────
function DeadlineBanner({ deadline }) {
  if (!deadline) return null
  const days = daysUntil(deadline)
  const overdue = days < 0
  const urgent = days >= 0 && days <= 7

  return (
    <div
      className="mb-5 rounded-lg border px-5 py-4 flex items-center gap-4"
      style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger)' }}
    >
      <div
        className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--danger)', color: '#fff' }}
      >
        {overdue ? <AlertTriangle size={22} /> : <CalendarClock size={22} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--danger)' }}>
          Date limite de réponse
        </div>
        <div className="text-2xl font-bold leading-tight" style={{ color: 'var(--danger)' }}>
          {formatDate(deadline)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-2xl font-extrabold tabular" style={{ color: 'var(--danger)' }}>
          {overdue ? 'Dépassée' : days === 0 ? "Aujourd'hui" : `J-${days}`}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
          {overdue
            ? `depuis ${Math.abs(days)} j`
            : days === 0 ? 'dernier jour' : urgent ? 'échéance proche' : 'restants'}
        </div>
      </div>
    </div>
  )
}

// ─── AO insights chart (admin) ──────────────────────────────────
function StatBar({ label, value, max, color, sublabel }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
          {label}
        </span>
        <span className="text-xs font-semibold text-[var(--text)] tabular">
          {value}
          {sublabel ? <span className="text-[var(--text-faint)] font-normal">{sublabel}</span> : null}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value > 0 ? Math.max(pct, 4) : 0}%`, background: color }}
        />
      </div>
    </div>
  )
}

function AOInsightsChart({ aoId }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    api.get(`/aos/${aoId}/stats`)
      .then(r => { if (alive) setStats(r.data) })
      .catch(e => { if (alive) setError(e.response?.data?.detail || 'Erreur') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [aoId])

  if (loading) {
    return (
      <div className="card p-4 flex items-center justify-center h-40">
        <Loader2 size={18} className="animate-spin text-[var(--text-faint)]" />
      </div>
    )
  }
  if (error || !stats) return null

  // Distinct, accessible colors per series
  const C = {
    eligible: '#6366f1',   // indigo  — could answer / matching pool
    responded: '#10b981',  // emerald — answered
    proposed: '#8b5cf6',   // violet  — proposed
    gap: '#f59e0b',        // amber   — matching but not proposed
  }
  const partnersMax = Math.max(stats.partners_eligible, stats.partners_responded, 1)
  const consultantsMax = Math.max(
    stats.consultants_pool_eligible, stats.consultants_proposed, stats.consultants_eligible_not_proposed, 1
  )
  const partnerCoverage = stats.partners_eligible > 0
    ? Math.round((stats.partners_responded / stats.partners_eligible) * 100) : 0
  const consultantCoverage = stats.consultants_pool_eligible > 0
    ? Math.round((stats.consultants_proposed / stats.consultants_pool_eligible) * 100) : 0

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-4">
        <BarChart3 size={13} className="text-[var(--accent-text)]" /> Couverture de l'AO
      </p>

      {/* Partners */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Partenaires</span>
          <span className="text-[11px] text-[var(--text-faint)]">{partnerCoverage}% ont répondu</span>
        </div>
        <div className="space-y-2.5">
          <StatBar
            label="Peuvent répondre" value={stats.partners_eligible} max={partnersMax} color={C.eligible}
            sublabel={(stats.partners_list_1 + stats.partners_list_2) > 0 ? ` · L1 ${stats.partners_list_1} / L2 ${stats.partners_list_2}` : ''}
          />
          <StatBar label="Ont répondu" value={stats.partners_responded} max={partnersMax} color={C.responded} />
        </div>
      </div>

      {/* Consultants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Consultants</span>
          <span className="text-[11px] text-[var(--text-faint)]">{consultantCoverage}% du vivier éligible proposé</span>
        </div>
        <div className="space-y-2.5">
          <StatBar label="Éligibles (vivier qui matche)" value={stats.consultants_pool_eligible} max={consultantsMax} color={C.eligible} />
          <StatBar label="Proposés" value={stats.consultants_proposed} max={consultantsMax} color={C.proposed} />
          <StatBar label="Éligibles non proposés" value={stats.consultants_eligible_not_proposed} max={consultantsMax} color={C.gap} />
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-faint)] mt-4 leading-relaxed">
        « Éligibles » = consultants dont les compétences recoupent celles de l'AO, chez des partenaires ayant accès au client.
      </p>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────
export default function AODetailPage() {
  const { id } = useParams()
  const { isAdmin: isAdminRole, isStaff, user } = useAuth()
  const isAdmin = isStaff // staff view (admin + commerce) — naming kept to avoid touching every usage below
  const confirm = useConfirm()
  const navigate = useNavigate()
  const location = useLocation()

  const [ao, setAo] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [vivier, setVivier] = useState([])
  const [matchResults, setMatchResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  // Assistant can deep-link here to open the "propose consultant" flow,
  // optionally pre-filling the new-consultant fields. It never submits.
  const [submitPrefill, setSubmitPrefill] = useState(location.state?.assistantPrefill || null)

  const fetchAo = async () => {
    const r = await api.get(`/aos/${id}`)
    setAo(r.data)
    return r.data
  }
  const fetchSubmissions = async () => {
    const r = await api.get(`/submissions/ao/${id}`)
    setSubmissions(r.data)
    return r.data
  }

  const runMatching = async () => {
    setMatching(true)
    setMatchError('')
    try {
      const { data } = await api.post('/matching/run', { ao_id: id, top_n: 3 })
      setMatchResults(data.results)
    } catch (err) {
      setMatchError(err.response?.data?.detail || 'Erreur lors du matching IA')
    } finally {
      setMatching(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const [aoData, subs] = await Promise.all([fetchAo(), fetchSubmissions()])

        if (!isAdmin) {
          const vivierRes = await api.get('/consultants')
          setVivier(vivierRes.data)

          if (subs.length > 0) {
            try {
              const cached = await api.get(`/matching/results/${id}`)
              if (cached.data.results?.length > 0) setMatchResults(cached.data.results)
            } catch { /* scoring not run yet */ }
          }
        }

        if (isAdmin && subs.length > 0) {
          setLoading(false)

          // Use cached results only if they were run AFTER the latest submission
          try {
            const cached = await api.get(`/matching/results/${id}`)
            const cachedResults = cached.data.results || []
            if (cachedResults.length) {
              const latestRun = cachedResults[0]?.created_at
              const latestSub = subs.reduce((max, s) =>
                s.submitted_at > max ? s.submitted_at : max, '')
              if (latestRun && latestRun > latestSub) {
                setMatchResults(cachedResults)
                return
              }
            }
          } catch { /* no cache */ }

          // No valid cache — run fresh
          await runMatching()
          return
        }
      } catch {
        navigate('/aos')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id, isAdmin])

  // Assistant deep-link: open the "propose consultant" modal for partners.
  useEffect(() => {
    if (!isAdmin && location.state?.openSubmit) {
      setShowSubmitModal(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const handleRerunMatch = () => runMatching()

  const handleDelete = async () => {
    if (!(await confirm({
      title: "Supprimer cet appel d'offres ?",
      message: 'L\'AO et ses données associées seront supprimés définitivement.',
      confirmLabel: 'Supprimer',
    }))) return
    await api.delete(`/aos/${id}`)
    navigate('/aos')
  }

  const handleDeleteSubmission = async (sid) => {
    if (!(await confirm({
      title: 'Retirer cette soumission ?',
      message: 'Le CV soumis sera retiré de cet AO.',
      confirmLabel: 'Retirer',
    }))) return
    await api.delete(`/submissions/${sid}`)
    setSubmissions(p => p.filter(s => s.id !== sid))
  }

  const handleSubmissionSuccess = async () => {
    setShowSubmitModal(false)
    await Promise.all([fetchSubmissions(), fetchAo()])
    if (isAdmin) await runMatching()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    )
  }
  if (!ao) return null

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <button onClick={() => navigate('/aos')} className="btn-ghost p-2 mt-0.5">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          {ao.clients?.name && (
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <Building2 size={11} className="text-brand-400" /> {ao.clients.name}
              {ao.clients.sector && <span className="text-slate-600">· {ao.clients.sector}</span>}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white">{ao.title}</h1>
            <span className={clsx('badge', ao.status === 'open'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-400')}>
              {ao.status === 'open' ? 'Ouvert' : 'Fermé'}
            </span>
            {ao.ao_type && (
              <span className="badge bg-violet-500/10 text-violet-300 border border-violet-500/20 text-xs">
                {ao.ao_type}
              </span>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button onClick={() => setShowEditModal(true)} className="btn-ghost p-2" title="Modifier">
              <Pencil size={15} />
            </button>
            <button onClick={handleDelete} className="btn-danger p-2" title="Supprimer">
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Deadline — big & red */}
      <DeadlineBanner deadline={ao.deadline} />

      {/* Key info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {ao.budget_max && (
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-xs text-slate-500 flex items-center gap-1"><Euro size={11} className="text-emerald-400" />Budget max</span>
            <span className="text-lg font-bold text-white">{ao.budget_max}€<span className="text-sm font-normal text-slate-400">/j</span></span>
          </div>
        )}
        {ao.location && (
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={11} className="text-brand-400" />Localisation</span>
            <span className="text-lg font-bold text-white leading-tight">{ao.location}</span>
          </div>
        )}
        {ao.duration && (
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={11} className="text-amber-400" />Durée</span>
            <span className="text-lg font-bold text-white">{ao.duration}</span>
          </div>
        )}
        <div className="card p-4 flex flex-col gap-1">
          <span className="text-xs text-slate-500 flex items-center gap-1"><Users size={11} className="text-blue-400" />CVs soumis</span>
          <span className="text-lg font-bold text-white">
            {ao.submission_count ?? submissions.length}
            <span className="text-sm font-normal text-slate-400"> reçus</span>
          </span>
        </div>
        {ao.created_at && (
          <div className="card p-4 flex flex-col gap-1">
            <span className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={11} className="text-slate-400" />Date d'ajout</span>
            <span className="text-sm font-semibold text-white leading-tight">{formatDate(ao.created_at)}</span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="card p-4 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Description</p>
        <p className="text-sm text-slate-300 leading-relaxed">{ao.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: AO meta */}
        <div className="lg:col-span-1 space-y-4">
          {isAdmin && <AOInsightsChart aoId={id} />}
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Compétences requises</p>
            <div className="flex flex-wrap gap-1.5">
              {ao.skills_required?.split(',').map((s, i) => (
                <span key={i} className="badge bg-brand-600/10 text-brand-300 border border-brand-500/15 text-[10px]">
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>
          {ao.context && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contexte additionnel</p>
              <p className="text-xs text-slate-400 leading-relaxed">{ao.context}</p>
            </div>
          )}
        </div>

        {/* Right: AI Matching (admin) OR Submission flow (partner) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Partner view: submit a CV */}
          {!isAdmin && (
            <div className="card p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <Briefcase size={15} className="text-brand-400" />
                    Proposer un consultant
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {submissions.length === 0
                      ? "Vous n'avez encore soumis aucun CV à cet AO."
                      : `Vous avez soumis ${submissions.length} CV${submissions.length > 1 ? 's' : ''}.`}
                  </p>
                </div>
                <button onClick={() => setShowSubmitModal(true)} className="btn-primary">
                  <Plus size={15} /> Soumettre un CV
                </button>
              </div>
            </div>
          )}

          {/* Submissions list */}
          {submissions.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                {isAdmin ? `Tous les CVs reçus (${submissions.length})` : `Vos soumissions (${submissions.length})`}
              </p>
              <div className="space-y-2">
                {submissions.map(s => (
                  <SubmissionRow
                    key={s.id}
                    sub={s}
                    canDelete={isAdminRole || s.submitted_by === user.id}
                    onDelete={handleDeleteSubmission}
                    isAdmin={isAdmin}
                    aoSkillsRequired={ao.skills_required}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Partner: own match scores */}
          {!isAdmin && submissions.length > 0 && (
            matchResults && matchResults.length > 0 ? (
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-brand-400" /> Vos scores IA
                </p>
                <div className="space-y-3">
                  {matchResults.map((result, i) => (
                    <MatchCard key={result.submission_id || i} result={result} rank={i + 1} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="card p-4 border-dashed border-white/10 text-center">
                <TrendingUp size={22} className="mx-auto text-slate-700 mb-2" />
                <p className="text-xs text-slate-500">Scoring IA en attente — l'administrateur analysera vos CVs prochainement</p>
              </div>
            )
          )}

          {/* Admin: matching results / controls */}
          {isAdmin && (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <Zap size={15} className="text-brand-400" />
                      Scoring IA
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {submissions.length === 0
                        ? "En attente de soumissions de CVs"
                        : `Analyse automatique de ${submissions.length} CV${submissions.length > 1 ? 's' : ''} · Top 3`}
                    </p>
                  </div>
                  {submissions.length > 0 && (
                    <button onClick={handleRerunMatch} disabled={matching}
                            className={clsx('btn-ghost gap-2', matching && 'opacity-75')}>
                      {matching
                        ? <><Loader2 size={14} className="animate-spin" />Analyse...</>
                        : <><RotateCcw size={14} />Relancer</>}
                    </button>
                  )}
                </div>
                {matching && (
                  <div className="mt-3 p-3 bg-brand-500/5 border border-brand-500/15 rounded-lg">
                    <div className="flex items-center gap-2 text-xs text-brand-300">
                      <Loader2 size={12} className="animate-spin" />
                      GPT-4o analyse les CVs... 15–30 secondes.
                    </div>
                  </div>
                )}
                {matchError && (
                  <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {matchError}
                  </div>
                )}
              </div>

              {matchResults && matchResults.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <TrendingUp size={12} className="text-brand-400" />
                    <span>Top {matchResults.length} · classés par score IA</span>
                  </div>
                  {matchResults.map((result, i) => (
                    <MatchCard key={result.submission_id || result.consultant_id || i} result={result} rank={i + 1} />
                  ))}
                </div>
              ) : !matching && submissions.length === 0 ? (
                <div className="card p-8 text-center border-dashed border-white/10">
                  <Users size={28} className="mx-auto text-slate-700 mb-3" />
                  <p className="text-slate-400 text-sm">Aucun CV n'a encore été soumis</p>
                  <p className="text-xs text-slate-600 mt-1">Le scoring se lancera automatiquement dès la première soumission</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showSubmitModal && (
        <SubmitModal aoId={id} vivier={vivier} prefill={submitPrefill}
          onClose={() => { setShowSubmitModal(false); setSubmitPrefill(null) }}
          onSubmitted={handleSubmissionSuccess} />
      )}
      {showEditModal && (
        <AOEditModal
          ao={ao}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => { setShowEditModal(false); await fetchAo() }}
        />
      )}
    </div>
  )
}
