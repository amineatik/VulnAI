'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Shield, Mail, Lock, Eye, EyeOff, Loader, AlertCircle,
  Terminal, Wifi, Cpu, Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import axios from 'axios'
import { toast } from 'sonner'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Animated grid background ──────────────────────────────────────────────────
function CyberGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ef4444" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
    </div>
  )
}

// ── Scanning line animation ───────────────────────────────────────────────────
function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
      animate={{ top: ['0%', '100%'] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
    />
  )
}

// ── Status dots (décoratifs) ──────────────────────────────────────────────────
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
      <span className="flex items-center gap-1.5">
        <Activity size={10} className="text-purple-500/50" />
        v2.4.1
      </span>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mounted, setMounted]               = useState(false)
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [showPassword, setShowPassword]     = useState(false)
  const [loading, setLoading]               = useState(false)
  const [rememberMe, setRememberMe]         = useState(false)
  const [fieldErrors, setFieldErrors]       = useState<{ email?: string; password?: string }>({})

  useEffect(() => {
    setMounted(true)
    try {
      const savedEmail    = localStorage.getItem('savedEmail')
      const savedRemember = localStorage.getItem('rememberMe')
      if (savedEmail && savedRemember === 'true') {
        setEmail(savedEmail)
        setRememberMe(true)
      }
    } catch { /* SSR / mode privé */ }
  }, [])

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {}
    if (!email.includes('@')) errors.email = 'Email invalide'
    if (password.length < 6) errors.password = 'Mot de passe trop court'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, { email, password })
      const { access_token, user } = response.data
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('email', email)
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true')
        localStorage.setItem('savedEmail', email)
      } else {
        localStorage.removeItem('rememberMe')
        localStorage.removeItem('savedEmail')
      }
      toast.success(`Bienvenue, ${user.username} !`)
      router.push('/dashboard')
    } catch (error: any) {
      const detail = error.response?.data?.detail
      if (error.response?.status === 401) {
        toast.error('Email ou mot de passe incorrect')
        setFieldErrors({ password: 'Identifiants incorrects' })
      } else if (error.response?.status === 403) {
        toast.error('Compte désactivé. Contactez un administrateur.')
      } else if (!error.response) {
        toast.error('Serveur inaccessible. Vérifiez votre connexion.')
      } else {
        toast.error(detail || 'Erreur lors de la connexion')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
          <div className="absolute inset-1 rounded-full border-2 border-red-400/40 animate-spin" style={{ borderTopColor: 'transparent' }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] flex"
      style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
    >
      <CyberGrid />

      {/* ── Panneau gauche — branding ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative px-16">
        <ScanLine />

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: '#0a0a0a', boxShadow: '0 0 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="llg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444"/>
                      <stop offset="100%" stopColor="#f97316"/>
                    </linearGradient>
                    <filter id="lg">
                      <feGaussianBlur stdDeviation="1.5" result="b"/>
                      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#llg)" filter="url(#lg)"/>
                  <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
                  <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
                  <polygon points="32,20 39,32 32,44 25,32" fill="url(#llg)" filter="url(#lg)"/>
                  <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
                  <circle cx="32" cy="10" r="2.5" fill="#f97316" filter="url(#lg)"/>
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0a0a0a] animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">VulnGuard <span className="text-red-400">AI</span></h1>
              <p className="text-xs text-slate-500">Security Intelligence Platform</p>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-3xl font-bold text-white leading-tight mb-3">
            Protégez votre<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              infrastructure
            </span>
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-10">
            Analyse des vulnérabilités en temps réel, alertes intelligentes et rapports automatisés alimentés par l'IA.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              { icon: <Terminal size={14}/>, label: 'Scan CVE automatisé',         color: '#ef4444' },
              { icon: <Cpu size={14}/>,      label: 'Analyse IA des menaces',       color: '#a78bfa' },
              { icon: <Activity size={14}/>, label: 'Monitoring temps réel',        color: '#22c55e' },
              { icon: <Shield size={14}/>,   label: 'Rapports de sécurité détaillés', color: '#f97316' },
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

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-4 pt-8 border-t border-slate-800/60">
            {[
              { val: '200K+', label: 'CVEs indexés' },
              { val: '99.9%', label: 'Uptime' },
              { val: '<1ms',  label: 'Latence' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-lg font-bold text-red-400">{s.val}</p>
                <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Séparateur vertical ───────────────────────────────────────── */}
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-slate-700/40 to-transparent" />

      {/* ── Panneau droit — formulaire ────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 relative">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <svg width="24" height="24" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="mlg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#f97316"/>
              </linearGradient>
            </defs>
            <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#mlg)"/>
            <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
            <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
            <polygon points="32,20 39,32 32,44 25,32" fill="url(#mlg)"/>
            <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
            <circle cx="32" cy="10" r="2.5" fill="#f97316"/>
          </svg>
          <span className="text-white font-bold">VulnGuard <span className="text-red-400">AI</span></span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* Header */}
          <div className="mb-8">
            <StatusBar />
            <h2 className="text-2xl font-bold text-white mt-4 mb-1">Connexion</h2>
            <p className="text-slate-500 text-sm">Accédez à votre tableau de bord sécurité</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5" noValidate>

            {/* Email */}
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })) }}
                  autoComplete="email"
                  required
                  className={`w-full bg-slate-900/80 border text-sm text-slate-200 placeholder-slate-600 rounded-lg pl-9 pr-4 py-2.5 outline-none transition-all
                    focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20
                    ${fieldErrors.email ? 'border-red-500/60' : 'border-slate-700/60'}`}
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
                  onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })) }}
                  autoComplete="current-password"
                  required
                  className={`w-full bg-slate-900/80 border text-sm text-slate-200 placeholder-slate-600 rounded-lg pl-9 pr-10 py-2.5 outline-none transition-all
                    focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20
                    ${fieldErrors.password ? 'border-red-500/60' : 'border-slate-700/60'}`}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded accent-cyan-500 w-3 h-3"
                />
                Se souvenir de moi
              </label>
              <Link href="/forgot-password" className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden rounded-lg py-2.5 text-sm font-semibold text-white transition-all
                bg-gradient-to-r from-red-800 to-cyan-500 hover:from-red-700 hover:to-red-500
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size={14} className="animate-spin" />
                  Connexion en cours…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Shield size={14} />
                  Se connecter
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-700">ou</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Register link */}
          <p className="text-center text-xs text-slate-600">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-red-400 hover:text-red-300 font-semibold transition-colors">
              Créer un compte
            </Link>
          </p>

          {/* Bottom status */}
          <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-700">
            <Lock size={10} />
            <span>Connexion chiffrée TLS 1.3</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}