import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import {
  ArrowLeft, Zap, Euro, MapPin, Clock, Users, CheckCircle,
  AlertCircle, TrendingUp, Award, ChevronDown, ChevronUp,
  Loader2, FileText, Trash2, RotateCcw, Building2, Plus,
  Upload, X, UserCircle2, Briefcase
} from 'lucide-react'
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
function SubmitModal({ aoId, roster, onClose, onSubmitted }) {
  const fileRef = useRef(null)
  const [mode, setMode] = useState(roster.length > 0 ? 'existing' : 'new')
  const [consultantId, setConsultantId] = useState(roster[0]?.id || '')
  const [form, setForm] = useState({
    name: '', skills: '', tjm: '', experience_years: '',
    employment_type: 'independant', availability: '',
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

        {roster.length > 0 && (
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-4">
            <button type="button" onClick={() => setMode('existing')}
              className={clsx('flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-all',
                mode === 'existing' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200')}>
              Depuis le roster
            </button>
            <button type="button" onClick={() => setMode('new')}
              className={clsx('flex-1 px-3 py-1.5 text-xs rounded-md font-medium transition-all',
                mode === 'new' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200')}>
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
                  {roster.map(c => (
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

// ─── Submission row (admin sees all, partner sees their own) ────
function SubmissionRow({ sub, onDelete, canDelete }) {
  const c = sub.consultants || {}
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/5 hover:border-white/10 transition-all group">
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
        </div>
        <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.skills}</p>
      </div>
      <a href={sub.cv_url} target="_blank" rel="noopener noreferrer"
         className="text-xs text-slate-400 hover:text-brand-400 inline-flex items-center gap-1">
        <FileText size={12} /> CV
      </a>
      {canDelete && (
        <button onClick={() => onDelete(sub.id)}
                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────
export default function AODetailPage() {
  const { id } = useParams()
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()

  const [ao, setAo] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [roster, setRoster] = useState([])
  const [matchResults, setMatchResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [showSubmitModal, setShowSubmitModal] = useState(false)

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
          const rosterRes = await api.get('/consultants')
          setRoster(rosterRes.data)
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

  const handleRerunMatch = () => runMatching()

  const handleDelete = async () => {
    if (!confirm('Supprimer cet AO ?')) return
    await api.delete(`/aos/${id}`)
    navigate('/aos')
  }

  const handleDeleteSubmission = async (sid) => {
    if (!confirm('Retirer cette soumission ?')) return
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
    <div className="max-w-4xl animate-slide-up">
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
          </div>
        </div>
        {isAdmin && (
          <button onClick={handleDelete} className="btn-danger p-2">
            <Trash2 size={15} />
          </button>
        )}
      </div>

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
      </div>

      {/* Description */}
      <div className="card p-4 mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Description</p>
        <p className="text-sm text-slate-300 leading-relaxed">{ao.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: AO meta */}
        <div className="lg:col-span-1 space-y-4">
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
                    canDelete={isAdmin || s.submitted_by === user.id}
                    onDelete={handleDeleteSubmission}
                  />
                ))}
              </div>
            </div>
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
        <SubmitModal aoId={id} roster={roster}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={handleSubmissionSuccess} />
      )}
    </div>
  )
}
