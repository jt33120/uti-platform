import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Shield, Briefcase, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import clsx from 'clsx'

const ROLES = [
  { value: 'admin', label: 'Administrateur', desc: 'Gère les AOs et le scoring IA', icon: Shield },
  { value: 'ao', label: 'Partenaire', desc: 'Soumet des consultants', icon: Briefcase },
]

export default function RegisterPage() {
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [form, setForm] = useState({ email: '', password: '', name: '', role: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [inviteStatus, setInviteStatus] = useState(inviteToken ? 'loading' : null)

  useEffect(() => {
    if (!inviteToken) return
    api.get(`/invitations/validate/${inviteToken}`)
      .then(res => {
        setForm(f => ({ ...f, email: res.data.email, name: res.data.name || '', role: 'ao' }))
        setInviteStatus('valid')
      })
      .catch(err => {
        setInviteStatus('invalid')
        setError(err.response?.data?.detail || "Lien d'invitation invalide ou expiré.")
      })
  }, [inviteToken])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.role) { setError('Veuillez sélectionner un rôle'); return }
    if (form.password.length < 6) { setError('Mot de passe trop court (min 6 caractères)'); return }
    setError('')
    try {
      await register(form.email, form.password, form.name, form.role, inviteToken)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'inscription')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2.5 mb-8">
          <img src="/logo.jpeg" alt="UTI Group" className="h-8 w-8 rounded object-cover" />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tightest text-[var(--text)]">UTI Group</div>
            <div className="text-[11px] text-[var(--text-faint)]">Plateforme Partenaires</div>
          </div>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tightest text-[var(--text)] mb-1">Créer un compte</h1>
        <p className="text-[13px] text-[var(--text-muted)] mb-6">
          {inviteToken && inviteStatus === 'valid'
            ? 'Vous avez été invité à rejoindre la plateforme'
            : 'Rejoignez la plateforme UTI Group'}
        </p>

        {inviteStatus === 'loading' && (
          <div className="flex items-center justify-center py-8 text-[13px] gap-2 text-[var(--text-muted)]">
            <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text)' }} />
            Vérification de l'invitation...
          </div>
        )}

        {inviteStatus === 'invalid' && (
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2.5 mb-4 text-[13px]"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {inviteStatus !== 'loading' && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!inviteToken && (
              <div>
                <label className="label">Rôle</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => {
                    const Icon = role.icon
                    const selected = form.role === role.value
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, role: role.value }))}
                        className="flex flex-col items-start gap-1 p-2.5 rounded-md text-left transition-colors"
                        style={{
                          background: selected ? 'var(--surface-2)' : 'var(--surface)',
                          border: `1px solid ${selected ? 'var(--text)' : 'var(--border)'}`,
                        }}
                      >
                        <Icon size={14} strokeWidth={1.75} className="text-[var(--text)]" />
                        <span className="text-[12px] font-semibold text-[var(--text)]">{role.label}</span>
                        <span className="text-[10.5px] text-[var(--text-faint)] leading-tight">{role.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="label">Nom complet</label>
              <input
                type="text"
                className="input"
                placeholder="Jean Dupont"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                readOnly={!!inviteToken && inviteStatus === 'valid'}
                required
              />
              {inviteToken && inviteStatus === 'valid' && (
                <p className="text-[11px] text-[var(--text-faint)] mt-1">
                  Nom défini par l'administrateur de la plateforme.
                </p>
              )}
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="vous@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                readOnly={!!inviteToken}
                required
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-9"
                  placeholder="Min. 6 caractères"
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

            {error && inviteStatus !== 'invalid' && (
              <div
                className="text-[13px] rounded-md px-3 py-2"
                style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || inviteStatus === 'invalid'}
              className="btn-primary w-full justify-center !h-10"
            >
              {loading ? 'Création...' : 'Créer le compte'}
            </button>
          </form>
        )}

        <p className="text-center text-[13px] text-[var(--text-muted)] mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-[var(--text)] hover:underline underline-offset-2">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
