import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export default function NewConsultantPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', tjm: '', skills: '', experience_years: '',
    availability: '', employment_type: 'independant',
    email: '', phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = { ...form }
      if (!payload.tjm) delete payload.tjm; else payload.tjm = parseInt(payload.tjm)
      if (!payload.experience_years) delete payload.experience_years
      else payload.experience_years = parseInt(payload.experience_years)
      ;['email', 'phone', 'availability'].forEach(k => { if (!payload[k]) delete payload[k] })
      await api.post('/consultants', payload)
      navigate('/consultants')
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
          <h1 className="section-title">Nouveau Consultant</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ajoutez un profil à votre roster. Le CV sera attaché lors de la soumission à un AO.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Profil</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nom complet *</label>
              <input type="text" className="input" placeholder="Marie Dupont"
                value={form.name} onChange={set('name')} required />
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
                      'px-3 py-2.5 text-xs rounded-lg border font-medium transition-all',
                      form.employment_type === o.v
                        ? 'bg-brand-600/20 border-brand-500/40 text-brand-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    )}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">TJM (€/jour)</label>
              <input type="number" className="input" placeholder="650"
                value={form.tjm} onChange={set('tjm')} min="0" max="9999" />
            </div>
            <div>
              <label className="label">Années d'expérience</label>
              <input type="number" className="input" placeholder="5"
                value={form.experience_years} onChange={set('experience_years')} min="0" max="50" />
            </div>

            <div className="col-span-2">
              <label className="label">Compétences clés *</label>
              <input type="text" className="input"
                placeholder="Python, React, AWS, Docker (séparées par des virgules)"
                value={form.skills} onChange={set('skills')} required />
            </div>

            <div className="col-span-2">
              <label className="label">Disponibilité</label>
              <input type="text" className="input" placeholder="Immédiate, Janvier 2025..."
                value={form.availability} onChange={set('availability')} />
            </div>

            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="marie@example.com"
                value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input type="tel" className="input" placeholder="06 12 34 56 78"
                value={form.phone} onChange={set('phone')} />
            </div>
          </div>
        </div>

        <div className="card p-4 border border-brand-500/20 bg-brand-500/5">
          <p className="text-xs text-brand-200">
            ℹ️ Le CV sera attaché lorsque vous soumettez ce consultant à un Appel d'Offres précis.
            Ouvrez un AO depuis la liste pour le proposer.
          </p>
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
            {loading
              ? <><Loader2 size={15} className="animate-spin" />Enregistrement...</>
              : <><UserPlus size={15} />Ajouter au roster</>}
          </button>
        </div>
      </form>
    </div>
  )
}
