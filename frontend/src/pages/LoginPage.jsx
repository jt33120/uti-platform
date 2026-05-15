import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Identifiants incorrects')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[360px]">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo.jpeg" alt="UTI Group" className="h-8 w-8 rounded object-cover" />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tightest text-[var(--text)]">UTI Group</div>
            <div className="text-[11px] text-[var(--text-faint)]">Plateforme Partenaires</div>
          </div>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tightest text-[var(--text)] mb-1">Se connecter</h1>
        <p className="text-[13px] text-[var(--text-muted)] mb-6">
          Accédez à votre espace partenaire
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="vous@example.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">Mot de passe</label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-9"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
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
            disabled={loading}
            className="btn-primary w-full justify-center !h-10"
          >
            {loading ? 'Connexion...' : (
              <span className="flex items-center gap-1.5">
                Se connecter <ArrowRight size={14} strokeWidth={2} />
              </span>
            )}
          </button>
        </form>

        <p className="text-center text-[13px] text-[var(--text-muted)] mt-6">
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-medium text-[var(--text)] hover:underline underline-offset-2">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}
