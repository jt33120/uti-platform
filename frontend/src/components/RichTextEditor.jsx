import { useRef, useEffect, useState, useCallback } from 'react'
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link2, Image as ImageIcon,
  Minus, Type, Palette, Highlighter, Eraser, Code, MousePointerClick,
  Loader2, Heading1, Heading2, Quote,
} from 'lucide-react'

/**
 * Éditeur de texte riche (WYSIWYG) sans dépendance externe.
 *
 * Produit du HTML à styles inline, compatible avec les clients mail.
 * - value / onChange : HTML contrôlé en sortie (non re-injecté à chaque frappe
 *   pour préserver le curseur ; ré-initialisé quand `resetKey` change).
 * - uploadImage(file) -> Promise<url> : héberge une image et renvoie son URL.
 */

const FONT_SIZES = [
  { label: 'Petit', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Grand', value: '5' },
  { label: 'Très grand', value: '6' },
]

const TEXT_COLORS = ['#111111', '#1d4ed8', '#6366f1', '#7c3aed', '#dc2626', '#ea580c', '#16a34a', '#0891b2', '#6e6e73', '#ffffff']
const HILITE_COLORS = ['#fff3bf', '#ffe3e3', '#d3f9d8', '#d0ebff', '#e5dbff', '#ffec99', 'transparent']

const GRADIENTS = [
  { label: 'Indigo', css: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
  { label: 'Violet', css: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' },
  { label: 'Océan', css: 'linear-gradient(135deg,#0ea5e9,#2563eb)' },
  { label: 'Sombre', css: 'linear-gradient(135deg,#1f2937,#111827)' },
  { label: 'Corail', css: 'linear-gradient(135deg,#fb7185,#e11d48)' },
  { label: 'Émeraude', css: 'linear-gradient(135deg,#34d399,#059669)' },
]

function Btn({ onClick, title, active, children, disabled }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      // preventDefault sur mousedown : garde la sélection dans l'éditeur.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 px-1.5 inline-flex items-center justify-center rounded-md text-sm transition-colors
        ${active ? 'bg-brand-600/30 text-brand-200' : 'text-slate-300 hover:bg-white/10'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="w-px h-5 bg-white/10 mx-0.5" />
}

// Petit menu déroulant (couleurs, dégradés, tailles…)
function Popover({ button, children, width = 'w-44' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <span ref={ref} className="relative inline-flex">
      <span onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>{button}</span>
      {open && (
        <div className={`absolute z-30 top-9 left-0 ${width} rounded-lg border border-white/10 bg-navy-800 shadow-xl p-2`}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </span>
  )
}

export default function RichTextEditor({
  value, onChange, resetKey, placeholders = [], varLabels = {},
  uploadImage, minHeight = 200,
}) {
  const editorRef = useRef(null)
  const fileRef = useRef(null)
  const savedRange = useRef(null)
  const [showSource, setShowSource] = useState(false)
  const [source, setSource] = useState(value || '')
  const [uploading, setUploading] = useState(false)

  // Init / reset du contenu (uniquement quand on change de template).
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || ''
    }
    setSource(value || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const emit = useCallback(() => {
    if (editorRef.current) onChange?.(editorRef.current.innerHTML)
  }, [onChange])

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }
  const restoreSelection = () => {
    const sel = window.getSelection()
    editorRef.current?.focus()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(cmd, false, val)
    saveSelection()
    emit()
  }

  const insertHTML = (htmlStr) => {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand('insertHTML', false, htmlStr)
    saveSelection()
    emit()
  }

  const insertVariable = (name) => insertHTML(`{${name}}`)

  const addLink = () => {
    const url = window.prompt("Lien (URL) :", 'https://')
    if (url) exec('createLink', url)
  }

  const addImageByUrl = () => {
    const url = window.prompt("URL de l'image :", 'https://')
    if (url) insertHTML(`<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px;" />`)
  }

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !uploadImage) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      if (url) insertHTML(`<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:8px;" />`)
    } catch (err) {
      window.alert("Échec de l'envoi de l'image : " + (err?.response?.data?.detail || err?.message || ''))
    } finally {
      setUploading(false)
    }
  }

  const insertButton = (css) => {
    const label = window.prompt("Texte du bouton :", 'Voir l’appel d’offres')
    if (label === null) return
    const url = window.prompt("Lien du bouton (URL ou variable comme {link}) :", '{link}')
    if (url === null) return
    insertHTML(
      `<div style="text-align:center;margin:20px 0;">` +
      `<a href="${url}" style="display:inline-block;background:${css};color:#ffffff;` +
      `text-decoration:none;font-weight:600;font-size:14px;padding:12px 26px;border-radius:10px;">` +
      `${label || 'Voir'}</a></div>`
    )
  }

  const insertDivider = () =>
    insertHTML('<hr style="border:none;border-top:1px solid #e5e5e7;margin:18px 0;" />')

  // Sync depuis l'éditeur de source HTML.
  const applySource = () => {
    if (editorRef.current) editorRef.current.innerHTML = source
    onChange?.(source)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-navy-900/40 overflow-hidden">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-white/10 bg-navy-800/60">
        {/* Blocs */}
        <Popover width="w-40" button={<Btn title="Style de texte"><Type size={15} /></Btn>}>
          {(close) => (
            <div className="flex flex-col text-left">
              {[
                { label: 'Paragraphe', cmd: 'P', icon: <Type size={14} /> },
                { label: 'Titre', cmd: 'H2', icon: <Heading1 size={14} /> },
                { label: 'Sous-titre', cmd: 'H3', icon: <Heading2 size={14} /> },
                { label: 'Citation', cmd: 'BLOCKQUOTE', icon: <Quote size={14} /> },
              ].map((b) => (
                <button key={b.cmd} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { exec('formatBlock', b.cmd); close() }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-200 hover:bg-white/10">
                  {b.icon} {b.label}
                </button>
              ))}
            </div>
          )}
        </Popover>

        <Popover width="w-36" button={<Btn title="Taille"><span className="text-xs font-semibold">A<span className="text-[9px]">A</span></span></Btn>}>
          {(close) => (
            <div className="flex flex-col text-left">
              {FONT_SIZES.map((f) => (
                <button key={f.value} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { exec('fontSize', f.value); close() }}
                  className="px-2 py-1.5 rounded-md text-sm text-slate-200 hover:bg-white/10">
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </Popover>

        <Sep />

        <Btn title="Gras" onClick={() => exec('bold')}><Bold size={15} /></Btn>
        <Btn title="Italique" onClick={() => exec('italic')}><Italic size={15} /></Btn>
        <Btn title="Souligné" onClick={() => exec('underline')}><Underline size={15} /></Btn>
        <Btn title="Barré" onClick={() => exec('strikeThrough')}><Strikethrough size={15} /></Btn>

        {/* Couleur de texte */}
        <Popover width="w-auto" button={<Btn title="Couleur du texte"><Palette size={15} /></Btn>}>
          {(close) => (
            <div className="grid grid-cols-5 gap-1.5 p-1">
              {TEXT_COLORS.map((c) => (
                <button key={c} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { exec('foreColor', c); close() }}
                  className="w-6 h-6 rounded-md border border-white/20" style={{ background: c }} title={c} />
              ))}
            </div>
          )}
        </Popover>

        {/* Surlignage */}
        <Popover width="w-auto" button={<Btn title="Surligner"><Highlighter size={15} /></Btn>}>
          {(close) => (
            <div className="grid grid-cols-4 gap-1.5 p-1">
              {HILITE_COLORS.map((c) => (
                <button key={c} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { exec('hiliteColor', c); exec('backColor', c); close() }}
                  className="w-6 h-6 rounded-md border border-white/20"
                  style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#777 0% 25%, #444 0% 50%) 50% / 8px 8px' : c }}
                  title={c === 'transparent' ? 'Aucun' : c} />
              ))}
            </div>
          )}
        </Popover>

        <Sep />

        <Btn title="Liste à puces" onClick={() => exec('insertUnorderedList')}><List size={15} /></Btn>
        <Btn title="Liste numérotée" onClick={() => exec('insertOrderedList')}><ListOrdered size={15} /></Btn>

        <Sep />

        <Btn title="Aligner à gauche" onClick={() => exec('justifyLeft')}><AlignLeft size={15} /></Btn>
        <Btn title="Centrer" onClick={() => exec('justifyCenter')}><AlignCenter size={15} /></Btn>
        <Btn title="Aligner à droite" onClick={() => exec('justifyRight')}><AlignRight size={15} /></Btn>

        <Sep />

        <Btn title="Lien" onClick={addLink}><Link2 size={15} /></Btn>

        {/* Image (URL ou upload) */}
        <Popover width="w-48" button={<Btn title="Image">{uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}</Btn>}>
          {(close) => (
            <div className="flex flex-col text-left">
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { close(); fileRef.current?.click() }}
                className="px-2 py-1.5 rounded-md text-sm text-slate-200 hover:bg-white/10 text-left">
                Importer un fichier…
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { close(); addImageByUrl() }}
                className="px-2 py-1.5 rounded-md text-sm text-slate-200 hover:bg-white/10 text-left">
                Depuis une URL…
              </button>
            </div>
          )}
        </Popover>

        {/* Bouton CTA dégradé */}
        <Popover width="w-44" button={<Btn title="Bouton (dégradé)"><MousePointerClick size={15} /></Btn>}>
          {(close) => (
            <div className="flex flex-col gap-1">
              {GRADIENTS.map((g) => (
                <button key={g.label} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { close(); insertButton(g.css) }}
                  className="px-2 py-1.5 rounded-md text-xs font-semibold text-white text-left"
                  style={{ background: g.css }}>
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </Popover>

        <Btn title="Séparateur" onClick={insertDivider}><Minus size={15} /></Btn>

        <Sep />

        <Btn title="Effacer la mise en forme" onClick={() => exec('removeFormat')}><Eraser size={15} /></Btn>
        <Btn title="Code HTML" active={showSource}
          onClick={() => { if (!showSource) setSource(editorRef.current?.innerHTML || ''); setShowSource((s) => !s) }}>
          <Code size={15} />
        </Btn>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
      </div>

      {/* Variables insérables */}
      {placeholders.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 border-b border-white/10 bg-navy-900/30">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 mr-1">Variables</span>
          {placeholders.map((name) => (
            <button key={name} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertVariable(name)}
              className="badge bg-brand-600/10 text-brand-300 border border-brand-500/20 text-[11px] hover:bg-brand-600/20 transition-colors">
              {`{${name}}`}{varLabels[name] && <span className="text-slate-500 ml-1">{varLabels[name]}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Zone d'édition / source */}
      {showSource ? (
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onBlur={applySource}
          spellCheck={false}
          className="w-full font-mono text-xs text-slate-200 bg-navy-950/60 p-3 outline-none resize-y"
          style={{ minHeight }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={saveSelection}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          className="rte-content px-4 py-3 text-[15px] leading-relaxed text-slate-100 outline-none overflow-auto"
          style={{ minHeight }}
        />
      )}
    </div>
  )
}
