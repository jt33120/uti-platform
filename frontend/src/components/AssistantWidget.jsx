import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { Sparkles, X, Minus, Send, Loader2, ArrowRight } from 'lucide-react'

// Role-aware starter suggestions. The assistant only ever *prepares* actions
// (navigate + pre-fill) — it never submits anything on the user's behalf.
const SUGGESTIONS = {
  admin: [
    "Créer un appel d'offres",
    'Ajouter un consultant',
    'Voir les partenaires',
  ],
  ao: [
    'Ajouter un consultant à mon vivier',
    "Voir les appels d'offres",
    'Voir mes clients',
  ],
}

function Bubble({ m, onAction }) {
  const isUser = m.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className="px-3 py-2 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap"
          style={
            isUser
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'var(--surface-2)', color: 'var(--text)' }
          }
        >
          {m.content}
        </div>
        {m.action?.path && (
          <button
            onClick={() => onAction(m.action)}
            className="mt-1.5 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--accent)' }}
          >
            <span className="truncate">{m.action.cta || 'Ouvrir la page'}</span>
            <ArrowRight size={13} className="shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function AssistantWidget() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([]) // { role, content, action? }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!user) return null

  const role = isAdmin ? 'admin' : 'ao'

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)
    try {
      const { data } = await api.post('/assistant/chat', {
        messages: next.map(m => ({ role: m.role, content: m.content })),
        page: location.pathname,
      })
      setMessages(m => [...m, { role: 'assistant', content: data.reply, action: data.action }])
    } catch {
      setMessages(m => [...m, {
        role: 'assistant',
        content: "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
        action: null,
      }])
    } finally {
      setLoading(false)
    }
  }

  // Navigate + pre-fill. Crucially, this never submits the target form —
  // the user always reviews and confirms the final action themselves.
  const runAction = (action) => {
    if (!action?.path) return
    navigate(action.path, { state: { assistantPrefill: action.prefill || undefined } })
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 h-12 px-4 rounded-full transition-transform hover:scale-[1.03]"
          style={{
            backgroundColor: 'var(--action-bg)',
            backgroundImage: 'var(--btn-sheen)',
            color: 'var(--action-text)',
            boxShadow: 'var(--btn-inset), 0 4px 14px rgba(10,10,10,0.25)',
          }}
        >
          <Sparkles size={18} strokeWidth={2} />
          <span className="text-[13px] font-semibold">Assistant</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-40 flex flex-col rounded-xl overflow-hidden shadow-2xl"
          style={{
            width: 'min(380px, calc(100vw - 2rem))',
            height: 'min(600px, calc(100vh - 3rem))',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 h-12 shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <Sparkles size={15} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--text)] leading-tight">Assistant</div>
              <div className="text-[10px] text-[var(--text-faint)] leading-tight">Vous guide · ne valide jamais à votre place</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Réduire"
              className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Minus size={15} strokeWidth={2} />
            </button>
            <button
              onClick={() => { setOpen(false); setMessages([]) }}
              aria-label="Fermer"
              className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div
                  className="px-3 py-2.5 rounded-lg text-[13px] leading-relaxed"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                >
                  Bonjour {user.name?.split(' ')[0]} 👋<br />
                  Je peux vous emmener sur la bonne page et pré-remplir des formulaires.
                  Je ne soumets jamais rien — vous gardez toujours la main.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(SUGGESTIONS[role] || []).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="px-2.5 py-1.5 rounded-full text-[12px] transition-colors"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => <Bubble key={i} m={m} onAction={runAction} />)}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-3 py-2 rounded-lg flex items-center gap-2 text-[13px]"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                >
                  <Loader2 size={13} className="animate-spin" /> …
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Demandez-moi de vous guider…"
                className="input resize-none py-2 max-h-28"
                style={{ minHeight: '38px' }}
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Envoyer"
                className="btn-primary h-[38px] px-3 shrink-0"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
