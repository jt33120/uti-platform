import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { ArrowLeft, FileText, Loader2, ChevronDown } from 'lucide-react'

export default function NewAOPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [form, setForm] = useState({
    client_id: '', title: '', description: '', skills_required: '',
    budget_max: '', location: '', duration: '', context: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

      const { data } = await api.post('/aos', payload)
      navigate(`/aos/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="section-title">Nouvel Appel d'Offres</h1>
          <p className="text-sm text-slate-500 mt-0.5">Renseignez les détails pour le matching IA</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Client & Mission</h2>

          <div>
            <label className="label">Client *</label>
            <div className="relative">
              <select
                value={form.client_id}
                onChange={set('client_id')}
                required
                className="input appearance-none pr-9"
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
                Aucun client. Créez-en un d'abord depuis « Clients ».
              </p>
            )}
          </div>

          <div>
            <label className="label">Titre de la mission *</label>
            <input type="text" className="input" placeholder="Développeur React Senior — Secteur Banque"
              value={form.title} onChange={set('title')} required />
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              className="input h-28 resize-none"
              placeholder="Décrivez la mission, le contexte client, les responsabilités attendues..."
              value={form.description}
              onChange={set('description')}
              required
            />
          </div>

          <div>
            <label className="label">Compétences requises *</label>
            <input type="text" className="input"
              placeholder="React, TypeScript, Node.js, GraphQL (séparées par des virgules)"
              value={form.skills_required} onChange={set('skills_required')} required />
            <p className="text-[11px] text-slate-600 mt-1">Ces compétences seront utilisées par l'IA pour le scoring</p>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Conditions</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Budget max (€/jour)</label>
              <input type="number" className="input" placeholder="700"
                value={form.budget_max} onChange={set('budget_max')} min="0" />
            </div>
            <div>
              <label className="label">Durée</label>
              <input type="text" className="input" placeholder="3 mois renouvelable"
                value={form.duration} onChange={set('duration')} />
            </div>
            <div className="col-span-2">
              <label className="label">Localisation</label>
              <input type="text" className="input" placeholder="Paris 8e / Remote 3j/sem"
                value={form.location} onChange={set('location')} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Contexte additionnel (IA)</h2>
          <textarea
            className="input h-24 resize-none"
            placeholder="Contexte métier, secteur d'activité, culture d'équipe, points de vigilance pour le matching..."
            value={form.context}
            onChange={set('context')}
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost flex-1 justify-center py-2.5">
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center py-2.5">
            {loading ? <><Loader2 size={15} className="animate-spin" />Création...</> : <><FileText size={15} />Créer l'AO</>}
          </button>
        </div>
      </form>
    </div>
  )
}
