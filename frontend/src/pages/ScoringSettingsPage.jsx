import { useState, useEffect } from 'react'
import api from '../lib/api'
import { SlidersHorizontal, Loader2, RotateCcw, Save, Info, CheckCircle } from 'lucide-react'
import ScoringPriorities, { DEFAULT_STARS } from '../components/ScoringPriorities'

// Pilotage de la grille de scoring (AI Act Art. 13/17 — transparence & gestion
// des modifications). L'importance des critères est notée en étoiles (1-5) ;
// les poids sont dérivés et normalisés automatiquement, donc plus de contrainte
// « somme = 100 » à la main. Le scoring reste déterministe et explicable.
export default function ScoringSettingsPage() {
  const [stars, setStars] = useState(DEFAULT_STARS)
  const [thresholds, setThresholds] = useState({ seniority_full_years: 8, reco_fort_min: 75, reco_moyen_min: 50 })
  const [defaults, setDefaults] = useState(null)
  const [meta, setMeta] = useState({ grid_version: '', is_custom: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/scoring-config')
      .then(r => {
        const d = r.data
        setStars(d.stars || DEFAULT_STARS)
        setThresholds({
          seniority_full_years: d.seniority_full_years,
          reco_fort_min: d.reco_fort_min,
          reco_moyen_min: d.reco_moyen_min,
        })
        setDefaults(d.defaults)
        setMeta({ grid_version: d.grid_version, is_custom: d.is_custom })
      })
      .catch(e => setError(e.response?.data?.detail || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [])

  const touch = () => setSaved(false)
  const onStars = (s) => { setStars(s); touch() }
  const onThresholds = (t) => { setThresholds(t); touch() }

  const fortInvalid = thresholds.reco_fort_min <= thresholds.reco_moyen_min

  const save = async () => {
    setError(''); setSaving(true); setSaved(false)
    try {
      await api.put('/scoring-config', { stars, ...thresholds })
      setMeta(m => ({ ...m, is_custom: true }))
      setSaved(true)
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    if (!defaults) return
    setStars(defaults.stars)
    setThresholds({
      seniority_full_years: defaults.seniority_full_years,
      reco_fort_min: defaults.reco_fort_min,
      reco_moyen_min: defaults.reco_moyen_min,
    })
    setSaved(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-faint)' }} /></div>
  }

  return (
    <div className="animate-slide-up max-w-2xl">
      <div className="flex items-center gap-2.5 mb-1">
        <SlidersHorizontal size={18} style={{ color: 'var(--accent-text)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Réglages du matching IA</h1>
      </div>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Notez l'importance de chaque critère avec des étoiles — les poids se
        calculent et s'équilibrent tout seuls. Le scoring reste <strong>déterministe
        et explicable</strong>. Grille v{meta.grid_version}.
      </p>

      <div className="card p-4 mb-4 flex gap-3" style={{ borderColor: 'var(--border)' }}>
        <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-text)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Conformité AI Act : toute modification est <strong>journalisée</strong> (Art. 12)
          et s'applique aux scorings suivants. Ces valeurs servent de défaut — chaque AO
          peut affiner ses propres priorités.
        </p>
      </div>

      <div className="card p-5">
        <ScoringPriorities
          stars={stars}
          onStarsChange={onStars}
          thresholds={thresholds}
          onThresholdsChange={onThresholds}
        />
      </div>

      {error && <p className="text-sm mt-3" style={{ color: 'var(--danger)' }}>{error}</p>}
      {saved && (
        <p className="text-sm mt-3 flex items-center gap-1.5" style={{ color: 'var(--accent-text)' }}>
          <CheckCircle size={14} /> Grille enregistrée.
        </p>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button onClick={save} disabled={saving || fortInvalid} className="btn-primary">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </button>
        <button onClick={resetDefaults} className="btn-ghost gap-1.5">
          <RotateCcw size={14} /> Valeurs par défaut
        </button>
      </div>
    </div>
  )
}
