import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Map as MapIcon, Loader2, Wifi, MapPinOff, LocateFixed } from 'lucide-react'

const FRANCE_CENTER = [46.6, 2.45]
const FRANCE_ZOOM = 6

const COLORS = {
  consultant: '#6366f1', // indigo
  onsite: '#10b981',     // emerald
  hybrid: '#f59e0b',     // amber
}

const WORK_MODE_LABEL = { onsite: 'Sur site', hybrid: 'Hybride', remote: 'Remote' }

function LegendDot({ color }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
}

export default function CartePage() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState({ consultants: [], aos: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showConsultants, setShowConsultants] = useState(true)
  const [showAos, setShowAos] = useState(true)
  const [backfilling, setBackfilling] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return api.get('/map/points')
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erreur de chargement de la carte'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const placedAos = useMemo(
    () => (data.aos || []).filter(a => a.latitude != null && a.longitude != null),
    [data.aos]
  )
  // Hors carte = sans coordonnées. On distingue le vrai remote des fiches
  // simplement pas encore géocodées (qui ont une localisation).
  const offMapAos = useMemo(
    () => (data.aos || []).filter(a => a.latitude == null || a.longitude == null),
    [data.aos]
  )
  // Fiches géocodables a posteriori (localisation connue, pas remote, pas placées).
  const geocodableCount = useMemo(
    () => offMapAos.filter(a => a.work_mode !== 'remote' && a.location).length,
    [offMapAos]
  )

  const runBackfill = async () => {
    setBackfilling(true)
    setError('')
    try {
      await api.post('/map/backfill')
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Échec du géocodage des fiches manquantes')
    } finally {
      setBackfilling(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-faint)' }} /></div>
  }

  return (
    <div className="animate-slide-up">
      <div className="flex items-center gap-2.5 mb-1">
        <MapIcon size={18} style={{ color: 'var(--accent-text)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Carte</h1>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        Consultants (par ville) et appels d'offres (par localisation) sur le territoire.
      </p>

      {/* Filtres + légende */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-[12px]">
        <button onClick={() => setShowConsultants(v => !v)}
          className="badge" style={{ opacity: showConsultants ? 1 : 0.4, background: 'var(--surface-2)', color: 'var(--text)' }}>
          <LegendDot color={COLORS.consultant} /> Consultants ({data.consultants.length})
        </button>
        <button onClick={() => setShowAos(v => !v)}
          className="badge" style={{ opacity: showAos ? 1 : 0.4, background: 'var(--surface-2)', color: 'var(--text)' }}>
          <LegendDot color={COLORS.onsite} /> AO placés ({placedAos.length})
        </button>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
          <LegendDot color={COLORS.hybrid} /> Hybride
        </span>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 card overflow-hidden" style={{ height: '70vh', padding: 0 }}>
          <MapContainer center={FRANCE_CENTER} zoom={FRANCE_ZOOM} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {showConsultants && data.consultants.map(c => (
              <CircleMarker key={`c-${c.id}`} center={[c.latitude, c.longitude]} radius={7}
                pathOptions={{ color: COLORS.consultant, fillColor: COLORS.consultant, fillOpacity: 0.7, weight: 1 }}>
                <Popup>
                  <div className="text-[13px] font-semibold">{c.name}</div>
                  {c.city && <div className="text-[12px] text-slate-500">{c.city}</div>}
                  {c.skills && <div className="text-[11px] text-slate-500 mt-1">{c.skills}</div>}
                  {c.tjm && <div className="text-[11px] text-slate-500">TJM {c.tjm} €/j</div>}
                </Popup>
              </CircleMarker>
            ))}

            {showAos && placedAos.map(a => {
              const color = a.work_mode === 'hybrid' ? COLORS.hybrid : COLORS.onsite
              return (
                <CircleMarker key={`a-${a.id}`} center={[a.latitude, a.longitude]} radius={8}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.65, weight: a.work_mode === 'hybrid' ? 3 : 1 }}>
                  <Popup>
                    <div className="text-[13px] font-semibold">{a.title}</div>
                    {a.clients?.name && <div className="text-[12px] text-slate-500">{a.clients.name}</div>}
                    {a.location && <div className="text-[11px] text-slate-500 mt-1">{a.location}</div>}
                    <div className="text-[11px] text-slate-500">{WORK_MODE_LABEL[a.work_mode] || '—'}</div>
                    <Link to={`/aos/${a.id}`} className="text-[12px] text-indigo-600 underline">Ouvrir l'AO →</Link>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        {/* AO hors carte : vrais remote + fiches pas encore géocodées */}
        <div className="card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
            <Wifi size={13} /> Hors carte ({offMapAos.length})
          </h2>

          {isAdmin && geocodableCount > 0 && (
            <button
              onClick={runBackfill}
              disabled={backfilling}
              className="w-full mb-3 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              title="Géocoder les fiches qui ont une localisation mais pas encore de point sur la carte"
            >
              {backfilling
                ? <><Loader2 size={13} className="animate-spin" /> Géolocalisation…</>
                : <><LocateFixed size={13} /> Géolocaliser {geocodableCount} fiche{geocodableCount > 1 ? 's' : ''}</>}
            </button>
          )}

          {offMapAos.length === 0 ? (
            <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Aucun.</p>
          ) : (
            <ul className="space-y-2">
              {offMapAos.map(a => {
                const remote = a.work_mode === 'remote'
                return (
                  <li key={a.id}>
                    <Link to={`/aos/${a.id}`} className="block rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">
                      <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{a.title}</div>
                      <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                        {a.clients?.name ? `${a.clients.name} · ` : ''}
                        {remote
                          ? <><Wifi size={10} /> Remote</>
                          : <><MapPinOff size={10} /> Non géolocalisé{a.location ? ` · ${a.location}` : ''}</>}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
