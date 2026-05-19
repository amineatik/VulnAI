'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Shield, Mail, Lock, User, Eye, EyeOff, Loader,
  AlertCircle, CheckCircle, Terminal, Activity, Cpu, Wifi
} from 'lucide-react'
import axios from 'axios'
import { toast } from 'sonner'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const strengthColors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
const strengthLabels = ['Faible', 'Moyen', 'Bon', 'Fort']

// ── Animated grid background ──────────────────────────────────────────────────
function CyberGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ef4444" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid2)" />
      </svg>
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-red-600/5 rounded-full blur-3xl" />
    </div>
  )
}

function StatusBar() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-600 font-mono">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        SYSTEM ONLINE
      </span>
      <span className="flex items-center gap-1.5">
        <Wifi size={10} className="text-red-500/50" />
        ENCRYPTED
      </span>
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername]             = useState('')
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]     = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [loading, setLoading]               = useState(false)
  const [agreedToTerms, setAgreedToTerms]   = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [fieldErrors, setFieldErrors]       = useState<Record<string, string>>({})
  const [inviteToken, setInviteToken]       = useState('')
  const [inviteRole, setInviteRole]         = useState('')

  useEffect(() => {
    const token = searchParams.get('token') ?? ''
    const invEmail = searchParams.get('email') ?? ''
    if (token) setInviteToken(token)
    if (invEmail) setEmail(invEmail)
  }, [searchParams])

  const calculatePasswordStrength = (pass: string) => {
    let strength = 0
    if (pass.length >= 8) strength++
    if (/[A-Z]/.test(pass)) strength++
    if (/[0-9]/.test(pass)) strength++
    if (/[^A-Za-z0-9]/.test(pass)) strength++
    setPasswordStrength(strength)
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (username.trim().length < 3)           errors.username        = 'Minimum 3 caractères'
    if (!email.includes('@') || !email.includes('.')) errors.email   = 'Email invalide'
    if (password.length < 8)                  errors.password        = 'Minimum 8 caractères'
    if (password !== confirmPassword)         errors.confirmPassword = 'Les mots de passe ne correspondent pas'
    if (!agreedToTerms)                       errors.terms           = 'Vous devez accepter les conditions'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/auth/register`, {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        invite_token: inviteToken,
      })
      if (res.data?.role && res.data.role !== 'user') {
        setInviteRole(res.data.role)
      }
      const roleMsg = inviteRole && inviteRole !== 'user' ? ` avec le rôle ${inviteRole.toUpperCase()}` : ''
      toast.success(`Compte créé${roleMsg} ! Redirection…`)
      setTimeout(() => router.push('/login'), 1500)
    } catch (error: any) {
      const detail = error.response?.data?.detail
      if (error.response?.status === 400) {
        if (detail?.includes('Email')) {
          setFieldErrors(p => ({ ...p, email: 'Cet email est déjà utilisé' }))
        } else if (detail?.includes('username') || detail?.includes('utilisateur')) {
          setFieldErrors(p => ({ ...p, username: "Ce nom d'utilisateur est déjà pris" }))
        } else {
          toast.error(detail || 'Données invalides')
        }
      } else if (!error.response) {
        toast.error('Serveur inaccessible. Vérifiez votre connexion.')
      } else {
        toast.error(detail || "Erreur lors de l'inscription")
      }
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword

  // ── Shared input class ──────────────────────────────────────────────────────
  const inputCls = (hasError: boolean) =>
    `w-full bg-slate-900/80 border text-sm text-slate-200 placeholder-slate-600 rounded-lg py-2.5 outline-none transition-all
     focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20
     ${hasError ? 'border-red-500/60' : 'border-slate-700/60'}`

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] flex"
      style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
    >
      <CyberGrid />

      {/* ── Panneau gauche — branding ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-2/5 flex-col items-center justify-center relative px-12">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-xs"
        >
          <div className="flex items-center gap-3 mb-10">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: '#0a0a0a', boxShadow: '0 0 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="rlg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444"/>
                      <stop offset="100%" stopColor="#f97316"/>
                    </linearGradient>
                    <filter id="rg">
                      <feGaussianBlur stdDeviation="1.5" result="b"/>
                      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#rlg)" filter="url(#rg)"/>
                  <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
                  <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
                  <polygon points="32,20 39,32 32,44 25,32" fill="url(#rlg)" filter="url(#rg)"/>
                  <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
                  <circle cx="32" cy="10" r="2.5" fill="#f97316" filter="url(#rg)"/>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0a0a0a] animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">VulnGuard <span className="text-red-400">AI</span></h1>
              <p className="text-xs text-slate-500">Security Intelligence Platform</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white leading-tight mb-3">
            Rejoignez la<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              révolution sécurité
            </span>
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            Créez votre compte et commencez à analyser vos vulnérabilités en quelques secondes.
          </p>

          <div className="space-y-3">
            {[
              { icon: <Terminal size={14}/>, label: 'Scan CVE automatisé',       color: '#ef4444' },
              { icon: <Cpu size={14}/>,      label: 'Analyse IA des menaces',     color: '#a78bfa' },
              { icon: <Activity size={14}/>, label: 'Monitoring temps réel',      color: '#22c55e' },
              { icon: <Shield size={14}/>,   label: 'Rapports détaillés',         color: '#f97316' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${f.color}14`, color: f.color }}>
                  {f.icon}
                </div>
                <span className="text-slate-400">{f.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-slate-700/40 to-transparent" />

      {/* ── Panneau droit — formulaire ────────────────────────────────── */}
      <div className="w-full lg:w-3/5 flex flex-col items-center justify-center p-8 overflow-y-auto">

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <svg width="24" height="24" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rmlg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#f97316"/>
              </linearGradient>
            </defs>
            <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#rmlg)"/>
            <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
            <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
            <polygon points="32,20 39,32 32,44 25,32" fill="url(#rmlg)"/>
            <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
            <circle cx="32" cy="10" r="2.5" fill="#f97316"/>
          </svg>
          <span className="text-white font-bold">VulnGuard <span className="text-red-400">AI</span></span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm py-6"
        >
          <div className="mb-6">
            <StatusBar />
            <h2 className="text-2xl font-bold text-white mt-4 mb-1">Créer un compte</h2>
            <p className="text-slate-500 text-sm">Commencez gratuitement dès aujourd'hui</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4" noValidate>

            {/* Username */}
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Nom d'utilisateur</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder="mon_pseudo"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: '' })) }}
                  autoComplete="username"
                  required
                  className={`${inputCls(!!fieldErrors.username)} pl-9 pr-4`}
                />
              </div>
              {fieldErrors.username && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.username}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })) }}
                  autoComplete="email"
                  required
                  className={`${inputCls(!!fieldErrors.email)} pl-9 pr-4`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Mot de passe</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    calculatePasswordStrength(e.target.value)
                    setFieldErrors(p => ({ ...p, password: '' }))
                  }}
                  autoComplete="new-password"
                  required
                  className={`${inputCls(!!fieldErrors.password)} pl-9 pr-10`}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.password}
                </p>
              )}
              {/* Barre de force */}
              {password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600">Force :</span>
                    <span className="text-xs font-semibold" style={{ color: strengthColors[passwordStrength - 1] ?? '#6b7280' }}>
                      {strengthLabels[passwordStrength - 1] ?? ''}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(passwordStrength / 4) * 100}%`,
                        background: strengthColors[passwordStrength - 1] ?? '#6b7280'
                      }}
                    />
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {[
                      { rule: password.length >= 8,           label: '8 caractères min' },
                      { rule: /[A-Z]/.test(password),         label: 'Une majuscule' },
                      { rule: /[0-9]/.test(password),         label: 'Un chiffre' },
                      { rule: /[^A-Za-z0-9]/.test(password),  label: 'Caractère spécial' },
                    ].map(r => (
                      <span key={r.label} className={`text-xs flex items-center gap-1 ${r.rule ? 'text-green-500' : 'text-slate-600'}`}>
                        {r.rule ? <CheckCircle size={9}/> : <AlertCircle size={9}/>}
                        {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirmation */}
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: '' })) }}
                  autoComplete="new-password"
                  required
                  className={`${inputCls(!!fieldErrors.confirmPassword)} pl-9 pr-10 ${
                    passwordsMatch ? 'border-green-500/40' : ''
                  }`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showConfirm ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.confirmPassword}
                </p>
              )}
              {passwordsMatch && (
                <p className="mt-1.5 text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle size={11} /> Les mots de passe correspondent
                </p>
              )}
            </div>

            {/* CGU */}
            <div>
              <label className="flex items-start gap-2.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={e => { setAgreedToTerms(e.target.checked); setFieldErrors(p => ({ ...p, terms: '' })) }}
                  className="mt-0.5 accent-cyan-500 w-3 h-3 flex-shrink-0"
                />
                <span>
                  J'accepte les{' '}
                  <Link href="/terms" className="text-red-400 hover:text-red-300 underline underline-offset-2">
                    Conditions d'utilisation
                  </Link>
                </span>
              </label>
              {fieldErrors.terms && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.terms}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all mt-1
                bg-gradient-to-r from-red-800 to-cyan-500 hover:from-red-700 hover:to-red-500
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size={14} className="animate-spin" />
                  Création du compte…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Shield size={14} />
                  Créer mon compte
                </span>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-700">ou</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <p className="text-center text-xs text-slate-600">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-red-400 hover:text-red-300 font-semibold transition-colors">
              Se connecter
            </Link>
          </p>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-700">
            <Lock size={10} />
            <span>Connexion chiffrée TLS 1.3</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}