'use client'

import MainLayout from '@/components/main-layout'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radar, Play, Loader, Shield, Zap, Globe,
  Clock, CheckCircle, AlertCircle, ArrowRight, Lock, Activity
} from 'lucide-react'
import { scansAPI, formatApiError } from '@/lib/api'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const SCAN_TYPES = [
  {
    id: 'basic',
    backendValue: 'full',
    name: 'Scan Rapide',
    description: 'Headers HTTP, cookies et configuration SSL',
    time: '~2 min',
    icon: Zap,
    color: '#ef4444',
    checks: ['Headers de sécurité', 'Configuration SSL/TLS', 'Cookies & sessions'],
  },
  {
    id: 'full',
    backendValue: 'full',
    name: 'Scan Complet',
    description: 'Détection approfondie avec corrélation base CVE',
    time: '~5 min',
    icon: Radar,
    color: '#a78bfa',
    checks: ['Tout du Scan Rapide', 'Corrélation CVE', 'Analyse des endpoints', 'Injection & XSS'],
  },
]

function PulseOrb({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: color }} />
      <div className="rounded-full" style={{ width: size * 0.6, height: size * 0.6, background: color }} />
    </div>
  )
}

export default function NewScanPage() {
  const router = useRouter()
  const [targetUrl, setTargetUrl] = useState('')
  const [scanType, setScanType] = useState('full')
  const [scanning, setScanning] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [step, setStep] = useState<'form' | 'launching'>('form')

  const selectedType = SCAN_TYPES.find(t => t.id === scanType) ?? SCAN_TYPES[1]

  const validateUrl = (val: string) => {
    if (!val) { setUrlError(''); return }
    try {
      new URL(val.startsWith('http') ? val : `https://${val}`)
      setUrlError('')
    } catch {
      setUrlError('URL invalide — ex: https://exemple.com')
    }
  }

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUrl.trim()) { setUrlError('Entrez une URL cible'); return }
    if (urlError) return
    setScanning(true)
    setStep('launching')
    let url = targetUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url
    try {
      const response = await scansAPI.create(url, selectedType.backendValue)
      toast.success('Scan démarré avec succès !')
      router.push(`/scans/${response.data.id}`)
    } catch (error: any) {
      const msg = formatApiError(error)
      if (error.response?.status === 422) {
        const detail = error.response?.data?.detail
        if (Array.isArray(detail)) detail.forEach((d: any) => toast.error(`Champ invalide : ${d.loc?.join('.')} — ${d.msg}`))
        else toast.error(msg || 'Données invalides')
      } else {
        toast.error(msg || 'Erreur lors du démarrage du scan')
      }
      setStep('form')
      setScanning(false)
    }
  }

  return (
    <MainLayout>
      <div
        className="min-h-screen p-6"
        style={{
          background: '#0a0a0a',
          fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace"
        }}
      >
        {/* Background grid */}
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

        {/* Ambient glow */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(56,189,248,0.05) 0%, transparent 70%)' }} />

        <div className="relative max-w-2xl mx-auto">
          <AnimatePresence mode="wait">

            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-xl animate-pulse"
                      style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Radar size={22} style={{ color: '#ef4444' }} />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight" style={{ color: '#fff' }}>
                      Nouveau <span style={{ color: '#ef4444' }}>Scan</span>
                    </h1>
                    <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Détection automatique des vulnérabilités</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <PulseOrb color="#22c55e" size={8} />
                    <span className="text-[10px] font-medium" style={{ color: '#22c55e' }}>Base CVE chargée</span>
                  </div>
                </div>

                <form onSubmit={handleStartScan} className="space-y-4">

                  {/* URL Input */}
                  <div className="rounded-2xl p-5 backdrop-blur-sm"
                    style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)' }}>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-3"
                      style={{ color: '#64748b' }}>
                      URL Cible
                    </label>
                    <div className="relative">
                      <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
                      <input
                        type="text"
                        placeholder="https://exemple.com"
                        value={targetUrl}
                        onChange={e => { setTargetUrl(e.target.value); validateUrl(e.target.value) }}
                        disabled={scanning}
                        className="w-full rounded-xl pl-9 pr-10 py-3 text-sm outline-none transition-all"
                        style={{
                          background: 'rgba(15,23,42,0.9)',
                          border: urlError
                            ? '1px solid rgba(239,68,68,0.5)'
                            : targetUrl && !urlError
                              ? '1px solid rgba(34,197,94,0.4)'
                              : '1px solid rgba(30,41,59,0.8)',
                          color: '#e2e8f0',
                          fontFamily: 'inherit',
                        }}
                      />
                      {targetUrl && !urlError && (
                        <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#22c55e' }} />
                      )}
                    </div>
                    {urlError && (
                      <p className="mt-2 text-xs flex items-center gap-1" style={{ color: '#ef4444' }}>
                        <AlertCircle size={11} /> {urlError}
                      </p>
                    )}
                    <p className="mt-2 text-xs" style={{ color: '#334155' }}>
                      Le scan analysera cette URL à la recherche de vulnérabilités connues
                    </p>
                  </div>

                  {/* Scan Type */}
                  <div className="rounded-2xl p-5 backdrop-blur-sm"
                    style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)' }}>
                    <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] mb-4"
                      style={{ color: '#64748b' }}>
                      Type de scan
                    </label>
                    <div className="space-y-3">
                      {SCAN_TYPES.map(type => {
                        const active = scanType === type.id
                        const Icon = type.icon
                        return (
                          <label key={type.id}
                            className="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all"
                            style={{
                              background: active ? `${type.color}08` : 'rgba(15,23,42,0.5)',
                              border: active ? `1px solid ${type.color}35` : '1px solid rgba(30,41,59,0.6)',
                            }}>
                            <input type="radio" name="scanType" value={type.id} checked={active}
                              onChange={() => setScanType(type.id)} disabled={scanning} className="hidden" />
                            {/* Radio dot */}
                            <div className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                              style={{ borderColor: active ? type.color : '#334155' }}>
                              {active && <div className="w-2 h-2 rounded-full" style={{ background: type.color }} />}
                            </div>
                            {/* Icon */}
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `${type.color}15` }}>
                              <Icon size={18} style={{ color: type.color }} />
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold" style={{ color: active ? '#fff' : '#94a3b8' }}>
                                  {type.name}
                                </span>
                                <span className="text-[10px] flex items-center gap-1" style={{ color: type.color }}>
                                  <Clock size={9} /> {type.time}
                                </span>
                              </div>
                              <p className="text-xs" style={{ color: '#475569' }}>{type.description}</p>
                              {active && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="flex flex-wrap gap-1.5 mt-3"
                                >
                                  {type.checks.map(c => (
                                    <span key={c} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                                      style={{
                                        border: `1px solid ${type.color}30`,
                                        color: type.color,
                                        background: `${type.color}10`
                                      }}>
                                      <CheckCircle size={8} /> {c}
                                    </span>
                                  ))}
                                </motion.div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* CVE Info */}
                  <div className="rounded-2xl p-4 flex items-start gap-3 backdrop-blur-sm"
                    style={{ background: 'rgba(8,47,73,0.3)', border: '1px solid rgba(56,189,248,0.12)' }}>
                    <Shield size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#7dd3fc' }}>Base CVE chargée</p>
                      <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
                        Le scan utilise la base de données CVE importée. Les résultats sont disponibles en temps réel.
                      </p>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={scanning || !!urlError || !targetUrl}
                    className="w-full relative overflow-hidden rounded-xl py-4 text-sm font-bold tracking-wider transition-all"
                    style={{
                      background: scanning || urlError || !targetUrl
                        ? 'rgba(30,41,59,0.5)'
                        : 'linear-gradient(135deg, #0ea5e9, #ef4444)',
                      color: scanning || urlError || !targetUrl ? '#475569' : '#fff',
                      border: 'none',
                      cursor: scanning || urlError || !targetUrl ? 'not-allowed' : 'pointer',
                      boxShadow: scanning || urlError || !targetUrl ? 'none' : '0 0 30px rgba(56,189,248,0.25)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Play size={15} />
                      DÉMARRER LE SCAN
                      <ArrowRight size={13} />
                    </span>
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'launching' && (
              <motion.div
                key="launching"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center min-h-[60vh] gap-8"
              >
                <div className="relative w-36 h-36">
                  {[0, 1, 2].map(i => (
                    <div key={i}
                      className="absolute rounded-full animate-ping"
                      style={{
                        inset: `${i * 16}px`,
                        border: `1px solid rgba(56,189,248,${0.15 + i * 0.1})`,
                        animationDelay: `${i * 0.3}s`,
                        animationDuration: '2s',
                      }} />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)' }}>
                      <Radar size={30} style={{ color: '#ef4444', animation: 'spin 3s linear infinite' }} />
                    </div>
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold" style={{ color: '#fff' }}>Initialisation du scan…</h2>
                  <p className="text-xs" style={{ color: '#475569' }}>{targetUrl}</p>
                  <p className="text-xs" style={{ color: '#ef4444' }}>{selectedType.name} · {selectedType.time}</p>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
                  <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  Connexion au moteur d'analyse…
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  )
}