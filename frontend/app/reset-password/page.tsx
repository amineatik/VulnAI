'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, Loader, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'

const API = 'http://localhost:8000'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    const t = searchParams.get('token') ?? ''
    if (!t) setError('Lien invalide — aucun token trouvé')
    setToken(t)
  }, [searchParams])

  const strength = (() => {
    let s = 0
    if (password.length >= 8) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()
  const strengthColor = ['#ef4444','#f97316','#eab308','#22c55e'][strength - 1] ?? '#334155'
  const strengthLabel = ['Faible','Moyen','Bon','Fort'][strength - 1] ?? ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 8)  { setError('Minimum 8 caractères'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      })
      if (res.ok) {
        setDone(true)
        setTimeout(() => router.push('/login'), 3000)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail ?? 'Erreur lors de la réinitialisation')
      }
    } catch {
      setError('Serveur inaccessible')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      <div className="fixed inset-0 pointer-events-none opacity-[0.03]">
        <svg className="w-full h-full">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ef4444" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#0a0a0a', boxShadow: '0 0 16px rgba(239,68,68,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <svg width="34" height="34" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="rplg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#f97316"/>
                </linearGradient>
                <filter id="rpg"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#rplg)" filter="url(#rpg)"/>
              <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
              <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
              <polygon points="32,20 39,32 32,44 25,32" fill="url(#rplg)" filter="url(#rpg)"/>
              <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
              <circle cx="32" cy="10" r="2.5" fill="#f97316" filter="url(#rpg)"/>
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-white">Vuln<span className="text-red-400">Guard</span></p>
            <p className="text-[10px] text-slate-600 tracking-widest">AI · SECURITY PLATFORM</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Mot de passe réinitialisé !</h2>
              <p className="text-xs text-slate-400">Redirection vers la connexion…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white mb-1">Nouveau mot de passe</h1>
                <p className="text-xs text-slate-500">Choisis un mot de passe sécurisé pour ton compte.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nouveau mot de passe */}
                <div>
                  <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input type={showPwd ? 'text' : 'password'} value={password}
                      onChange={e => { setPassword(e.target.value); setError('') }}
                      placeholder="••••••••" required
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/60 transition-all" />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                      {showPwd ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-slate-600">Force :</span>
                        <span className="text-[10px] font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
                      </div>
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(strength/4)*100}%`, background: strengthColor }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirmation */}
                <div>
                  <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Confirmer</label>
                  <div className="relative">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input type={showConfirm ? 'text' : 'password'} value={confirm}
                      onChange={e => { setConfirm(e.target.value); setError('') }}
                      placeholder="••••••••" required
                      className={`w-full pl-9 pr-10 py-2.5 rounded-lg bg-slate-800/80 border text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/60 transition-all ${
                        confirm && password === confirm ? 'border-green-500/50' : 'border-slate-700'
                      }`} />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                      {showConfirm ? <EyeOff size={13}/> : <Eye size={13}/>}
                    </button>
                  </div>
                  {confirm && password === confirm && (
                    <p className="mt-1.5 text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle size={10}/> Mots de passe identiques
                    </p>
                  )}
                </div>

                {error && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle size={11}/> {error}
                  </p>
                )}

                <button type="submit" disabled={loading || !token}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#0ea5e9,#ef4444)' }}>
                  {loading
                    ? <><Loader size={14} className="animate-spin"/> Réinitialisation…</>
                    : <><Lock size={14}/> Réinitialiser le mot de passe</>}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={12}/> Retour à la connexion
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
