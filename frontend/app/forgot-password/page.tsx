'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft, Loader, CheckCircle, AlertCircle } from 'lucide-react'

const API = 'http://localhost:8000'

function DragonLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="flg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef4444"/>
          <stop offset="100%" stopColor="#f97316"/>
        </linearGradient>
        <filter id="fg">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#flg)" filter="url(#fg)"/>
      <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
      <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
      <polygon points="32,20 39,32 32,44 25,32" fill="url(#flg)" filter="url(#fg)"/>
      <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
      <circle cx="32" cy="10" r="2.5" fill="#f97316" filter="url(#fg)"/>
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const [devToken, setDevToken] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setSent(true)
        // En dev : afficher le lien directement
        if (d.dev_token) setDevToken(d.dev_token)
      } else {
        setError(d.detail ?? 'Erreur lors de l\'envoi')
      }
    } catch {
      setError('Serveur inaccessible — vérifiez que le backend est démarré')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Grid bg */}
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

        {/* Logo Geometric Dragon */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#0a0a0a', boxShadow: '0 0 16px rgba(239,68,68,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <DragonLogo size={34} />
          </div>
          <div>
            <p className="text-base font-bold text-white">Vuln<span className="text-red-400">Guard</span></p>
            <p className="text-[10px] text-slate-600 tracking-widest">AI · SECURITY PLATFORM</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          {!sent ? (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white mb-1">Mot de passe oublié</h1>
                <p className="text-xs text-slate-500">Entre ton email — on t'envoie un lien de réinitialisation.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      placeholder="ton@email.com"
                      required
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/60 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle size={11} /> {error}
                  </p>
                )}

                <button type="submit" disabled={loading || !email}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)' }}>
                  {loading
                    ? <><Loader size={14} className="animate-spin" /> Envoi en cours…</>
                    : <><Mail size={14} /> Envoyer le lien</>}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Email envoyé !</h2>
              <p className="text-xs text-slate-400 leading-relaxed mb-1">
                Si <span className="text-red-400">{email}</span> est enregistré,<br />
                un lien de réinitialisation a été envoyé.
              </p>
              <p className="text-[10px] text-slate-600 mb-4">Le lien expire dans 1 heure.</p>

              {/* Lien direct en mode dev */}
              {devToken && (
                <div className="mt-4 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 text-left">
                  <p className="text-[10px] text-orange-400 mb-2 uppercase tracking-wider">Mode développement</p>
                  <Link
                    href={`/reset-password?token=${devToken}`}
                    className="text-xs text-orange-300 hover:text-orange-200 underline break-all"
                  >
                    Cliquer ici pour réinitialiser →
                  </Link>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-4">Vérifie aussi ton dossier <span className="text-slate-400">Spam</span>.</p>
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft size={12} /> Retour à la connexion
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
