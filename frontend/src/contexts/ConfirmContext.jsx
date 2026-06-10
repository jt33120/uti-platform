import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

// In-app confirmation dialog replacing the native window.confirm() — visible,
// themed, and not auto-dismissed by automation. Usage:
//   const confirm = useConfirm()
//   if (!(await confirm({ title, message, confirmLabel: 'Supprimer', danger: true }))) return
const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setState({
        title: opts.title || 'Confirmer',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'Confirmer',
        cancelLabel: opts.cancelLabel || 'Annuler',
        danger: opts.danger ?? true,
      })
    })
  }, [])

  const close = useCallback((val) => {
    resolver.current?.(val)
    resolver.current = null
    setState(null)
  }, [])

  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => close(false)}
        >
          <div className="card p-5 w-full max-w-[400px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-5">
              {state.danger && (
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                     style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                  <AlertTriangle size={17} strokeWidth={2} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{state.title}</h2>
                {state.message && (
                  <p className="text-[13px] mt-1 leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
                    {state.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => close(false)} className="btn-ghost">{state.cancelLabel}</button>
              <button onClick={() => close(true)} className={state.danger ? 'btn-danger' : 'btn-primary'} autoFocus>
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
