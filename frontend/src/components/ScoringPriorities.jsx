import { useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import StarRating from './StarRating'

// Les 4 axes du scoring, libellés non-techs + libellé court pour le radar.
export const CRITERIA = [
  { key: 'competences', label: 'Compétences techniques', short: 'Compétences' },
  { key: 'seniorite', label: 'Séniorité', short: 'Séniorité' },
  { key: 'contexte', label: 'Contexte / domaine', short: 'Contexte' },
  { key: 'tjm', label: 'Compatibilité TJM', short: 'TJM' },
]

// Étoiles par défaut = grille historique 40/20/20/20.
export const DEFAULT_STARS = { competences: 4, seniorite: 2, contexte: 2, tjm: 2 }

// Miroir exact de services.scoring.stars_to_weights (somme garantie = 100).
export function starsToWeights(stars) {
  const s = {}
  CRITERIA.forEach(({ key }) => {
    const v = parseInt(stars?.[key], 10)
    s[key] = Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : 3
  })
  const total = CRITERIA.reduce((a, { key }) => a + s[key], 0) || 1
  const raw = {}
  const floor = {}
  CRITERIA.forEach(({ key }) => { raw[key] = (s[key] / total) * 100; floor[key] = Math.floor(raw[key]) })
  const remainder = 100 - CRITERIA.reduce((a, { key }) => a + floor[key], 0)
  const order = [...CRITERIA].sort((a, b) => (raw[b.key] - floor[b.key]) - (raw[a.key] - floor[a.key]))
  for (let i = 0; i < remainder; i++) floor[order[i].key] += 1
  return floor
}

function PriorityRadar({ weights }) {
  const data = CRITERIA.map(({ key, short }) => ({ axis: short, value: weights[key] }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} outerRadius="68%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
        <Radar dataKey="value" stroke="var(--accent-text)" fill="var(--accent-text)" fillOpacity={0.22} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function NumberField({ label, hint, value, onChange, min, max }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[13px]" style={{ color: 'var(--text)' }}>{label}</div>
        {hint && <div className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{hint}</div>}
      </div>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
        className="input w-20 text-right"
      />
    </div>
  )
}

/**
 * Bloc « Priorités de matching » réutilisable (réglages globaux + par-AO).
 * `stars`/`onStarsChange` pilotent l'importance ; les seuils (avancés) sont
 * optionnels via `thresholds`/`onThresholdsChange`.
 */
export default function ScoringPriorities({ stars, onStarsChange, thresholds, onThresholdsChange }) {
  const [advOpen, setAdvOpen] = useState(false)
  const weights = starsToWeights(stars)
  const setStar = (key) => (n) => onStarsChange({ ...stars, [key]: n })
  const fortError = thresholds && thresholds.reco_fort_min <= thresholds.reco_moyen_min

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-center">
        <div className="space-y-3.5">
          {CRITERIA.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px]" style={{ color: 'var(--text)' }}>{label}</div>
                <div className="text-[11px] tabular" style={{ color: 'var(--text-faint)' }}>
                  {weights[key]} % du score
                </div>
              </div>
              <StarRating value={stars?.[key] ?? 0} onChange={onStarsChange ? setStar(key) : undefined} />
            </div>
          ))}
        </div>
        <div className="rounded-lg" style={{ background: 'var(--surface-2)' }}>
          <PriorityRadar weights={weights} />
        </div>
      </div>

      {thresholds && onThresholdsChange && (
        <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => setAdvOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            <SlidersHorizontal size={13} />
            Réglages avancés (seuils &amp; séniorité)
            <ChevronDown size={13} className="transition-transform" style={{ transform: advOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {advOpen && (
            <div className="mt-3 space-y-3">
              <NumberField
                label="Séniorité cible" hint="années d'XP pour le score séniorité maximal"
                value={thresholds.seniority_full_years} min={1} max={40}
                onChange={(v) => onThresholdsChange({ ...thresholds, seniority_full_years: v })}
              />
              <NumberField
                label="Seuil recommandation FORT" hint="score ≥ pour une reco forte"
                value={thresholds.reco_fort_min} min={0} max={100}
                onChange={(v) => onThresholdsChange({ ...thresholds, reco_fort_min: v })}
              />
              <NumberField
                label="Seuil recommandation MOYEN" hint="score ≥ pour une reco moyenne"
                value={thresholds.reco_moyen_min} min={0} max={100}
                onChange={(v) => onThresholdsChange({ ...thresholds, reco_moyen_min: v })}
              />
              {fortError && (
                <p className="text-[12px]" style={{ color: 'var(--danger)' }}>
                  Le seuil FORT doit être strictement supérieur au seuil MOYEN.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
