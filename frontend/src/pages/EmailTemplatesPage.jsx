import { useState, useEffect } from 'react'
import api from '../lib/api'
import RichTextEditor from '../components/RichTextEditor'
import { Mail, Loader2, Save, RotateCcw, CheckCircle, Eye } from 'lucide-react'

// Valeurs d'exemple pour l'aperçu (les vraies seront injectées à l'envoi).
const SAMPLE = {
  title: 'Tech Lead Big Data',
  client: 'AGIRC SAD',
  reference: 'AO-2026-014',
  location: 'Paris / hybride',
  deadline: '2026-07-15',
  link: 'https://plateforme.groupement-it.com/aos/abc',
}

const VAR_LABELS = {
  title: "Titre de l'AO",
  client: 'Client',
  reference: 'Référence',
  location: 'Localisation',
  deadline: 'Date limite',
  link: "Lien de l'AO",
}

const escapeHtml = (s) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const looksHtml = (s) => /<[a-zA-Z!/][^>]*>/.test(s || '')

// Corps texte (legacy) → HTML, pour pré-remplir l'éditeur visuel.
const plainToHtml = (text) =>
  escapeHtml(text)
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')

const toEditorHtml = (body) => (looksHtml(body) ? body : plainToHtml(body))

const applyVars = (str, values) => {
  let out = str || ''
  Object.keys(values).forEach((k) => { out = out.replaceAll(`{${k}}`, values[k] ?? '') })
  return out
}

async function uploadImage(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await api.post('/email-templates/upload-image', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return r.data.url
}

// Aperçu fidèle : reproduit la coquille de l'email réel (logo, titre, CTA).
function EmailPreview({ subject, bodyHtml }) {
  const renderedBody = applyVars(bodyHtml, SAMPLE)
  return (
    <div className="rounded-lg overflow-hidden border border-white/10" style={{ background: '#f5f5f7' }}>
      <div className="px-3 py-2 text-[11px]" style={{ background: '#e9e9ec', color: '#57606a' }}>
        <span className="font-semibold" style={{ color: '#1d1d1f' }}>Objet :</span> {applyVars(subject, SAMPLE)}
      </div>
      <div className="p-4">
        <div className="mx-auto" style={{ maxWidth: 520, background: '#fff', border: '1px solid #e5e5e7', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px 6px' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6e6e73', fontWeight: 600 }}>
              Groupement-IT
            </div>
            <h1 style={{ fontSize: 22, margin: '6px 0 0', fontWeight: 600, color: '#111' }}>{SAMPLE.title}</h1>
          </div>
          <div className="email-preview" style={{ padding: '14px 28px 22px' }}
               dangerouslySetInnerHTML={{ __html: renderedBody }} />
          <div style={{ textAlign: 'center', padding: '0 28px 26px' }}>
            <span style={{ display: 'inline-block', background: '#111', color: '#fff', fontWeight: 600, fontSize: 14, padding: '12px 24px', borderRadius: 8 }}>
              Voir l'appel d'offres
            </span>
          </div>
          <div style={{ padding: '14px 28px', borderTop: '1px solid #e5e5e7', fontSize: 12, color: '#86868b' }}>
            Vous recevez cet email car vous êtes partenaire référencé sur ce client.
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ tpl, onSaved }) {
  const [subject, setSubject] = useState(tpl.subject)
  const [body, setBody] = useState(() => toEditorHtml(tpl.body))
  const [version, setVersion] = useState(0) // force la ré-init de l'éditeur
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const initialBody = toEditorHtml(tpl.body)
  const dirty = subject !== tpl.subject || body !== initialBody
  const touch = () => setSaved(false)

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await api.put(`/email-templates/${tpl.key}`, { subject, body, format: 'html' })
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
      setBody(toEditorHtml(tpl.default_body))
      setVersion((v) => v + 1)
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
               onChange={(e) => { setSubject(e.target.value); touch() }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <label className="label">Corps du message</label>
          <RichTextEditor
            value={body}
            resetKey={`${tpl.key}-${version}`}
            onChange={(html) => { setBody(html); touch() }}
            placeholders={tpl.placeholders || []}
            varLabels={VAR_LABELS}
            uploadImage={uploadImage}
            minHeight={300}
          />
        </div>

        {/* Aperçu fidèle */}
        <div>
          <p className="label flex items-center gap-1">
            <Eye size={12} /> Aperçu (valeurs d'exemple — remplacées à l'envoi)
          </p>
          <EmailPreview subject={subject} bodyHtml={body} />
        </div>
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
      .then((r) => setTemplates(r.data.templates || []))
      .catch((e) => setError(e.response?.data?.detail || 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div className="animate-slide-up w-full">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Mail size={20} className="text-brand-400" /> Templates Mails
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Éditeur visuel complet : mise en forme, couleurs, images, boutons…
          Les variables entre accolades sont remplacées automatiquement à l'envoi.
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
          {templates.map((tpl) => (
            <TemplateCard key={tpl.key} tpl={tpl} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  )
}
