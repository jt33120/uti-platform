import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Supabase sends the recovery token in the URL hash:
  // /reset-password#access_token=XXX&refresh_token=YYY&type=recovery
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    const type = params.get('type')
    if (token && type === 'recovery') {
      setAccessToken(token)
    } else {
      setError("Lien de réinitialisation invalide. Veuillez refaire une demande.")
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { access_token: accessToken, new_password: password })
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[360px]">
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo.jpeg" alt="UTI Group" className="h-8 w-8 rounded object-cover" />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tightest text-[var(--text)]">UTI Group</div>
            <div className="text-[11px] text-[var(--text-faint)]">Plateforme Partenaires</div>
          </div>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tightest text-[var(--text)] mb-1">
          Nouveau mot de passe
        </h1>
        <p className="text-[13px] text-[var(--text-muted)] mb-6">
          Choisissez un nouveau mot de passe pour votre compte.
        </p>

        {done ? (
          <div className="space-y-4">
            <div
              className="flex items-start gap-3 rounded-md px-4 py-3 text-[13px]"
              style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
            >
              <CheckCircle size={15} className="shrink-0 mt-0.5" />
              <span>Mot de passe mis à jour. Redirection vers la connexion...</span>
            </div>
            <Link to="/login" className="btn-ghost w-full justify-center flex items-center gap-1.5">
              <ArrowLeft size={14} /> Se connecter
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="label">Nouveau mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-9"
                  placeholder="Min. 6 caractères"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  disabled={!accessToken}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]"
                  onClick={() => setShowPassword(p => !p)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-[13px] rounded-md px-3 py-2"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !accessToken}
              className="btn-primary w-full justify-center !h-10"
            >
              {loading ? 'Enregistrement...' : 'Mettre à jour le mot de passe'}
            </button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mt-2"
            >
              <ArrowLeft size={13} /> Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
