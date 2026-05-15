import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Zap, Eye, EyeOff, Shield, Briefcase, AlertCircle } from 'lucide-react'
import api from '../lib/api'
import clsx from 'clsx'

const ROLES = [
  {
    value: 'admin',
    label: 'Administrateur',
    desc: 'Gère les AOs, lance le scoring IA, consulte tous les profils',
    icon: Shield,
    color: 'brand',
  },
  {
    value: 'ao',
    label: 'AO / Partenaire',
    desc: 'Soumet des consultants avec leurs CVs pour les appels d\'offres',
    icon: Briefcase,
    color: 'emerald',
  },
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
        setForm(f => ({ ...f, email: res.data.email, role: 'ao' }))
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
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Créer un compte</h1>
          <p className="text-slate-400 text-sm mt-1">
            {inviteToken && inviteStatus === 'valid'
              ? 'Vous avez été invité à rejoindre la plateforme G-IT'
              : 'Rejoignez la plateforme G-IT'}
          </p>
        </div>

        <div className="card p-6">
          {inviteStatus === 'loading' && (
            <div className="flex items-center justify-center py-8 text-slate-400 text-sm gap-2">
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Vérification de l'invitation...
            </div>
          )}

          {inviteStatus === 'invalid' && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-3 mb-4 text-sm">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          {(inviteStatus !== 'loading') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selection — hidden when coming from an invite (role is locked to 'ao') */}
            {!inviteToken && (
              <div>
                <label className="label">Rôle</label>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map(role => {
                    const Icon = role.icon
                    const selected = form.role === role.value
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, role: role.value }))}
                        className={clsx(
                          'flex flex-col items-start gap-1.5 p-3 rounded-lg border text-left transition-all duration-150',
                          selected
                            ? role.color === 'brand'
                              ? 'border-brand-500 bg-brand-600/10'
                              : 'border-emerald-500 bg-emerald-600/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        )}
                      >
                        <Icon size={16} className={clsx(
                          selected
                            ? role.color === 'brand' ? 'text-brand-400' : 'text-emerald-400'
                            : 'text-slate-500'
                        )} />
                        <span className={clsx(
                          'text-xs font-semibold',
                          selected ? 'text-white' : 'text-slate-300'
                        )}>{role.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight">{role.desc}</span>
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
                required
              />
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
                  className="input pr-10"
                  placeholder="Min. 6 caractères"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  onClick={() => setShowPassword(p => !p)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || inviteStatus === 'invalid'}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Création...
                </span>
              ) : "Créer le compte"}
            </button>
          </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
