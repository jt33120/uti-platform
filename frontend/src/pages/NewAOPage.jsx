import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../lib/api'
import {
  ArrowLeft, FileText, Loader2, ChevronDown, Building2,
  Euro, MapPin, Clock, Zap, CheckCircle, CalendarClock,
  Sparkles, UploadCloud, X
} from 'lucide-react'

export default function NewAOPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [clients, setClients] = useState([])
  const AO_TYPES = ['Assurance', 'Banque / Finance', 'IT / Dev', 'Énergie', 'Retail', 'Public', 'Santé', 'Autre']

  const [form, setForm] = useState({
    client_id: '', title: '', description: '', skills_required: '',
    budget_max: '', location: '', duration: '', context: '', ao_type: '', deadline: '',
    ...(state?.assistantPrefill || {}),  // assistant may pre-fill (never submits)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // AI draft step
  const [aiText, setAiText] = useState('')
  const [aiFiles, setAiFiles] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiDone, setAiDone] = useState(false)

  const generateFromSource = async () => {
    setAiError(''); setAiDone(false)
    if (!aiText.trim() && aiFiles.length === 0) {
      setAiError("Collez le texte d'un email ou ajoutez un fichier (PDF, DOCX)."); return
    }
    setAiLoading(true)
    try {
      const fd = new FormData()
      fd.append('pasted_text', aiText)
      aiFiles.forEach(f => fd.append('files', f))
      const { data } = await api.post('/aos/draft', fd)
      setForm(p => ({
        ...p,
        title: data.title || p.title,
        description: data.description || p.description,
        skills_required: data.skills_required || p.skills_required,
        ao_type: data.ao_type || p.ao_type,
        budget_max: data.budget_max != null ? String(data.budget_max) : p.budget_max,
        location: data.location || p.location,
        duration: data.duration || p.duration,
        deadline: data.deadline || p.deadline,
        context: data.context || p.context,
      }))
      setAiDone(true)
    } catch (err) {
      setAiError(err.response?.data?.detail || 'Échec de la génération. Réessayez.')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    api.get('/clients').then(r => {
      setClients(r.data)
      if (r.data.length === 1) setForm(p => ({ ...p, client_id: r.data[0].id }))
    })
  }, [])

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.client_id) { setError('Veuillez sélectionner un client'); return }
    setLoading(true)
    try {
      const payload = { ...form }
      if (!payload.budget_max) delete payload.budget_max
      else payload.budget_max = parseInt(payload.budget_max)
      if (!payload.deadline) delete payload.deadline
      const { data } = await api.post('/aos', payload)
      navigate(`/aos/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const selectedClient = clients.find(c => c.id === form.client_id)
  const skillsList = form.skills_required.split(',').map(s => s.trim()).filter(Boolean)

  return (
    <div className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={22} className="text-brand-400" />
            Nouvel Appel d'Offres
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Les compétences renseignées alimentent directement le scoring IA</p>
        </div>
      </div>

      {/* AI generation step — paste an email / drop attachments → pre-fill the form */}
      <div className="card p-6 mb-6 border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.08] to-brand-500/[0.04]">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/30 to-brand-500/30 border border-violet-400/20 flex items-center justify-center shrink-0">
            <Sparkles size={17} className="text-violet-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Générer l'AO avec l'IA</h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Collez l'email reçu et/ou ajoutez la pièce jointe (PDF, DOCX). L'IA pré-remplit le formulaire ci-dessous —
              vous vérifiez et ajustez avant d'enregistrer.
            </p>
          </div>
        </div>

        <textarea
          className="input h-28 resize-none text-sm"
          placeholder="Collez ici le texte de l'email de l'appel d'offres…"
          value={aiText} onChange={e => setAiText(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <label className="btn-ghost cursor-pointer text-sm">
            <UploadCloud size={15} /> Ajouter un fichier
            <input
              type="file" multiple accept=".pdf,.docx,.txt" className="hidden"
              onChange={e => { setAiFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = '' }}
            />
          </label>
          {aiFiles.map((f, i) => (
            <span key={i} className="badge bg-white/5 border border-white/10 text-slate-300 text-xs">
              <FileText size={11} className="inline mr-1" />{f.name}
              <button
                type="button"
                onClick={() => setAiFiles(prev => prev.filter((_, j) => j !== i))}
                className="ml-1.5 text-slate-500 hover:text-red-400"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            type="button" onClick={generateFromSource} disabled={aiLoading}
            className="btn-primary text-sm ml-auto"
          >
            {aiLoading
              ? <><Loader2 size={14} className="animate-spin" />Génération…</>
              : <><Sparkles size={14} />Générer l'AO</>}
          </button>
        </div>

        {aiError && <p className="text-xs text-red-400 mt-3">{aiError}</p>}
        {aiDone && !aiError && (
          <p className="text-xs text-emerald-400 mt-3 flex items-center gap-1.5">
            <CheckCircle size={12} /> Champs pré-remplis — vérifiez et ajustez ci-dessous avant d'enregistrer.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — main fields */}
          <div className="lg:col-span-2 space-y-5">

            {/* Client & title */}
            <div className="card p-6 space-y-5">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Building2 size={13} className="text-brand-400" /> Client & Mission
              </h2>

              <div>
                <label className="label">Client *</label>
                <div className="relative">
                  <select
                    value={form.client_id} onChange={set('client_id')} required
                    className="input appearance-none pr-9 text-base"
                  >
                    <option value="" className="bg-navy-900">— Sélectionner un client —</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id} className="bg-navy-900">
                        {c.name}{c.sector ? ` · ${c.sector}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
                {clients.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1.5">
                    Aucun client disponible — créez-en un d'abord depuis « Clients ».
                  </p>
                )}
              </div>

              <div>
                <label className="label">Type d'AO</label>
                <div className="relative">
                  <select
                    value={form.ao_type} onChange={set('ao_type')}
                    className="input appearance-none pr-9"
                  >
                    <option value="" className="bg-navy-900">— Sélectionner un type —</option>
                    {AO_TYPES.map(t => (
                      <option key={t} value={t} className="bg-navy-900">{t}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="label">Titre de la mission *</label>
                <input
                  type="text" className="input text-base" required
                  placeholder="ex: Data Engineer Senior — Modernisation Data Platform"
                  value={form.title} onChange={set('title')}
                />
              </div>

              <div>
                <label className="label">Description *</label>
                <textarea
                  className="input h-36 resize-none"
                  placeholder="Contexte de la mission, responsabilités, équipe, environnement technique..."
                  value={form.description} onChange={set('description')} required
                />
              </div>
            </div>

            {/* Skills */}
            <div className="card p-6 space-y-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Zap size={13} className="text-brand-400" /> Compétences requises (IA)
              </h2>
              <div>
                <input
                  type="text" className="input text-base" required
                  placeholder="React, TypeScript, Node.js, PostgreSQL, Docker..."
                  value={form.skills_required} onChange={set('skills_required')}
                />
                <p className="text-[11px] text-slate-600 mt-1.5">Séparées par des virgules · utilisées pour le scoring IA</p>
              </div>
              {skillsList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skillsList.map((s, i) => (
                    <span key={i} className="badge bg-brand-600/10 text-brand-300 border border-brand-500/15 text-xs">
                      <CheckCircle size={10} className="inline mr-1" />{s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Context */}
            <div className="card p-6 space-y-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText size={13} className="text-brand-400" /> Contexte additionnel (IA)
              </h2>
              <textarea
                className="input h-28 resize-none"
                placeholder="Secteur métier, culture d'équipe, points de vigilance, RGPD, stack tech spécifique, urgence..."
                value={form.context} onChange={set('context')}
              />
              <p className="text-[11px] text-slate-600">Ce texte est transmis tel quel à l'IA pour affiner le scoring</p>
            </div>
          </div>

          {/* Right — conditions + summary */}
          <div className="space-y-5">

            {/* Conditions */}
            <div className="card p-6 space-y-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Conditions</h2>

              <div>
                <label className="label flex items-center gap-1.5">
                  <CalendarClock size={12} style={{ color: 'var(--danger)' }} /> Date limite de réponse
                </label>
                <input type="date" className="input"
                  value={form.deadline} onChange={set('deadline')} />
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Euro size={12} className="text-emerald-400" /> Budget max (€/jour)
                </label>
                <input type="number" className="input" placeholder="700"
                  value={form.budget_max} onChange={set('budget_max')} min="0" />
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <Clock size={12} className="text-amber-400" /> Durée
                </label>
                <input type="text" className="input" placeholder="3 mois renouvelable"
                  value={form.duration} onChange={set('duration')} />
              </div>

              <div>
                <label className="label flex items-center gap-1.5">
                  <MapPin size={12} className="text-brand-400" /> Localisation
                </label>
                <input type="text" className="input" placeholder="Paris 8e / Remote 3j/sem"
                  value={form.location} onChange={set('location')} />
              </div>
            </div>

            {/* Preview */}
            <div className="card p-6 space-y-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Récapitulatif</h2>

              {selectedClient && (
                <div className="flex items-center gap-2 p-2.5 bg-white/3 border border-white/5 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500/40 to-emerald-500/40 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {selectedClient.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{selectedClient.name}</div>
                    {selectedClient.sector && <div className="text-[10px] text-slate-500">{selectedClient.sector}</div>}
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs">
                {form.deadline && (
                  <div className="flex items-center gap-2 font-medium" style={{ color: 'var(--danger)' }}>
                    <CalendarClock size={11} /> Échéance : {form.deadline}
                  </div>
                )}
                {form.ao_type && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText size={11} className="text-violet-400" /> {form.ao_type}
                  </div>
                )}
                {form.budget_max && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Euro size={11} className="text-emerald-400" /> {form.budget_max}€/j
                  </div>
                )}
                {form.duration && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={11} className="text-amber-400" /> {form.duration}
                  </div>
                )}
                {form.location && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin size={11} className="text-brand-400" /> {form.location}
                  </div>
                )}
                {skillsList.length > 0 && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Zap size={11} className="text-brand-400" /> {skillsList.length} compétence{skillsList.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading
                  ? <><Loader2 size={15} className="animate-spin" />Création...</>
                  : <><FileText size={15} />Créer l'AO</>}
              </button>
              <button type="button" onClick={() => navigate(-1)} className="btn-ghost w-full justify-center py-2.5">
                Annuler
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
