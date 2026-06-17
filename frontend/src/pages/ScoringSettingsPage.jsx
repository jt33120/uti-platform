import { useState, useEffect } from 'react'
import api from '../lib/api'
import { SlidersHorizontal, Loader2, RotateCcw, Save, Info, CheckCircle } from 'lucide-react'

// Pilotage de la grille de scoring (AI Act Art. 13/17 — transparence & gestion
// des modifications). Le scoring reste déterministe ; seuls les poids/seuils
// changent. La somme des poids doit faire 100.
const FIELDS = [
  { key: 'w_competences', label: 'Poids — Compétences techniques', min: 0, max: 100, weight: true },
  { key: 'w_seniorite', label: 'Poids — Séniorité', min: 0, max: 100, weight: true },
  { key: 'w_contexte', label: 'Poids — Contexte / domaine', min: 0, max: 100, weight: true },
  { key: 'w_tjm', label: 'Poids — Compatibilité TJM', min: 0, max: 100, weight: true },
  { key: 'seniority_full_years', label: "Années d'expérience pour la séniorité maximale", min: 1, max: 40 },
  { key: 'reco_fort_min', label: 'Seuil recommandation FORT (score ≥)', min: 0, max: 100 },
  { key: 'reco_moyen_min', label: 'Seuil recommandation MOYEN (score ≥)', min: 0, max: 100 },
]

export default function ScoringSettingsPage() {
  const [form, setForm] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [meta, setMeta] = useState({ grid_version: '', is_custom: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/scoring-config')
      .then(r => {
        setForm(r.data.config)
        setDefaults(r.data.defaults)
        setMeta({ grid_version: r.data.grid_version, is_custom: r.data.is_custom })
      })
      .catch(e => setError(e.response?.data?.detail || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  const set = (k) => (e) => {
    setForm(p => ({ ...p, [k]: parseInt(e.target.value || '0', 10) }))
    setSaved(false)
  }

  const weightSum = form
    ? form.w_competences + form.w_seniorite + form.w_contexte + form.w_tjm
    : 0

  const save = async () => {
    setError(''); setSaving(true); setSaved(false)
    try {
      const { data } = await api.put('/scoring-config', form)
      setForm(data.config)
      setMeta(m => ({ ...m, is_custom: true }))
      setSaved(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => { setForm({ ...defaults }); setSaved(false) }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-faint)' }} /></div>
  }
  if (!form) return <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>

  return (
    <div className="animate-slide-up max-w-2xl">
      <div className="flex items-center gap-2.5 mb-1">
        <SlidersHorizontal size={18} style={{ color: 'var(--accent-text)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Paramètres du scoring</h1>
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Ajustez la grille de notation. Le scoring reste <strong>déterministe et explicable</strong> —
        seuls les poids et seuils changent. Grille v{meta.grid_version}.
      </p>

      <div className="card p-4 mb-4 flex gap-3" style={{ borderColor: 'var(--border)' }}>
        <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-text)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Conformité AI Act : toute modification est <strong>journalisée</strong> (Art. 12) et
          s'applique aux scorings suivants. La somme des poids doit faire <strong>100</strong> et
          le seuil FORT doit être supérieur au seuil MOYEN.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        {FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between gap-4">
            <label className="text-sm" style={{ color: 'var(--text)' }}>{f.label}</label>
            <input
              type="number" min={f.min} max={f.max}
              className="input w-24 text-right" value={form[f.key]}
              onChange={set(f.key)}
            />
          </div>
        ))}

        <div className="flex items-center justify-between pt-2 text-sm border-t" style={{ borderColor: 'var(--border)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Somme des poids</span>
          <span className="font-semibold tabular" style={{ color: weightSum === 100 ? 'var(--accent-text)' : 'var(--danger)' }}>
            {weightSum} / 100
          </span>
        </div>
      </div>

      {error && <p className="text-sm mt-3" style={{ color: 'var(--danger)' }}>{error}</p>}
      {saved && (
        <p className="text-sm mt-3 flex items-center gap-1.5" style={{ color: 'var(--accent-text)' }}>
          <CheckCircle size={14} /> Grille enregistrée.
        </p>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button onClick={save} disabled={saving || weightSum !== 100} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </button>
        <button onClick={resetDefaults} className="btn-ghost gap-1.5">
          <RotateCcw size={14} /> Valeurs par défaut
        </button>
      </div>
    </div>
  )
}
