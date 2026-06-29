import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import { Mail, Loader2, Save, RotateCcw, CheckCircle, Info } from 'lucide-react'

// Valeurs d'exemple pour l'aperçu (les vraies seront injectées à l'envoi).
const SAMPLE = {
  title: "Tech Lead Big Data",
  client: "AGIRC SAD",
  reference: "AO-2026-014",
  location: "Paris / hybride",
  deadline: "2026-07-15",
  link: "https://plateforme.groupement-it.com/aos/…",
}

const VAR_LABELS = {
  title: "Titre de l'AO",
  client: "Client",
  reference: "Référence",
  location: "Localisation",
  deadline: "Date limite",
  link: "Lien de l'AO",
}

function applyVars(str, values) {
  let out = str || ''
  Object.keys(values).forEach(k => { out = out.replaceAll(`{${k}}`, values[k] || '') })
  return out
}

function TemplateCard({ tpl, onSaved }) {
  const [subject, setSubject] = useState(tpl.subject)
  const [body, setBody] = useState(tpl.body)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)

  const dirty = subject !== tpl.subject || body !== tpl.body
  const touch = () => { setSaved(false) }

  // Insère une variable à la position du curseur dans le corps.
  const insertVar = (name) => {
    const token = `{${name}}`
    const el = bodyRef.current
    if (!el) { setBody(b => b + token); touch(); return }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next); touch()
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await api.put(`/email-templates/${tpl.key}`, { subject, body })
      setSaved(true)
      onSaved?.()
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await api.delete(`/email-templates/${tpl.key}`)
      setSubject(tpl.default_subject)
      setBody(tpl.default_body)
      setSaved(true)
      onSaved?.()
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors de la réinitialisation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Mail size={15} className="text-brand-400" /> {tpl.label}
        </h2>
        {tpl.is_custom
          ? <span className="badge bg-violet-500/10 text-violet-300 border border-violet-500/20 text-[10px]">Personnalisé</span>
          : <span className="badge bg-white/5 text-slate-400 text-[10px]">Par défaut</span>}
      </div>

      <div>
        <label className="label">Objet de l'email</label>
        <input className="input" value={subject}
               onChange={e => { setSubject(e.target.value); touch() }} />
      </div>

      <div>
        <label className="label">Corps du message</label>
        <textarea ref={bodyRef} className="input min-h-[120px] resize-y leading-relaxed"
                  value={body} onChange={e => { setBody(e.target.value); touch() }} />
      </div>

      {/* Variables insérables */}
      <div>
        <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1">
          <Info size={11} /> Cliquez pour insérer une variable (remplacée automatiquement à l'envoi) :
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(tpl.placeholders || []).map(name => (
            <button key={name} type="button" onClick={() => insertVar(name)}
              className="badge bg-brand-600/10 text-brand-300 border border-brand-500/20 text-[11px] hover:bg-brand-600/20 transition-colors">
              {`{${name}}`} <span className="text-slate-500 ml-1">{VAR_LABELS[name]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Aperçu */}
      <div className="rounded-lg border border-white/10 bg-navy-900/40 p-3">
        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Aperçu</p>
        <p className="text-sm font-semibold text-white mb-1">{applyVars(subject, SAMPLE)}</p>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{applyVars(body, SAMPLE)}</p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {saved && !dirty && (
          <span className="text-xs text-emerald-400 inline-flex items-center gap-1 mr-auto">
            <CheckCircle size={13} /> Enregistré
          </span>
        )}
        <button onClick={reset} disabled={saving}
                className="btn-ghost text-sm gap-1.5" title="Revenir au texte par défaut">
          <RotateCcw size={14} /> Réinitialiser
        </button>
        <button onClick={save} disabled={saving || !dirty} className="btn-primary text-sm gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
        </button>
      </div>
    </div>
  )
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    api.get('/email-templates')
      .then(r => setTemplates(r.data.templates || []))
      .catch(e => setError(e.response?.data?.detail || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div className="animate-slide-up max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Mail size={20} className="text-brand-400" /> Templates Mails
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Personnalisez l'objet et le texte des emails envoyés automatiquement aux partenaires.
          Les variables entre accolades sont remplacées à l'envoi.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={22} className="animate-spin text-brand-400" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
      ) : (
        <div className="space-y-5">
          {templates.map(tpl => (
            <TemplateCard key={tpl.key} tpl={tpl} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  )
}
