'use client'

// app/profile/page.tsx
// Affiche les VRAIES données : utilisateur connecté (JWT) + vrais scans depuis la DB

import MainLayout from '@/components/main-layout'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  User, Mail, Shield, Edit3, Camera, Save, X,
  Award, Activity, Target, Clock, CheckCircle, Star,
  RefreshCw, AlertCircle, Globe, Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}
const stagger = { show: { transition: { staggerChildren: 0.07 } } }

// ── Types ─────────────────────────────────────────────────────────────────────
interface Scan {
  id: number
  target_url: string
  scan_type: string
  status: string
  security_score: number | null
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  created_at: string | null
  completed_at: string | null
}

interface VulnStats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)   return 'À l\'instant'
  if (mins  < 60)  return `Il y a ${mins} min`
  if (hours < 24)  return `Il y a ${hours}h`
  if (days  < 30)  return `Il y a ${days} jour${days > 1 ? 's' : ''}`
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

function statusColor(s: string): string {
  switch (s) {
    case 'completed': return '#22c55e'
    case 'running':   return '#a78bfa'
    case 'failed':    return '#ef4444'
    default:          return '#6b7280'
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case 'completed': return 'Terminé'
    case 'running':   return 'En cours'
    case 'failed':    return 'Échoué'
    case 'pending':   return 'En attente'
    default:          return s
  }
}

// ── Score circle ──────────────────────────────────────────────────────────────
function ScoreCircle({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-600 text-xs">—</span>
  const color = score >= 8 ? '#22c55e' : score >= 5 ? '#eab308' : '#ef4444'
  return (
    <span className="text-sm font-bold tabular-nums" style={{ color }}>
      {score.toFixed(1)}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, token, logout } = useAuth()

  const [editing, setEditing]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [scans,   setScans]     = useState<Scan[]>([])
  const [vulnStats, setVulnStats] = useState<VulnStats>({ total: 0, critical: 0, high: 0, medium: 0, low: 0 })
  const [loadingScans, setLoadingScans] = useState(true)

  // Bio locale uniquement (pas encore dans le backend)
  const [bio, setBio] = useState(
    'Spécialiste en sécurité offensive et défensive. Passionné par la détection de vulnérabilités et la threat intelligence.'
  )
  const [draftBio, setDraftBio] = useState(bio)

  // ── Charger les vrais scans depuis l'API ──────────────────────────────────
  const loadScans = useCallback(async () => {
    setLoadingScans(true)
    try {
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const scansRes = await fetch(`${API}/scans/?limit=500`, { headers })

      if (scansRes.ok) {
        const data = await scansRes.json()
        const items: Scan[] = Array.isArray(data) ? data : data.items ?? data.results ?? []
        setScans(items)
        // Calcul des stats depuis les scans personnels
        setVulnStats({
          total:    items.reduce((a, s) => a + (s.critical_count||0) + (s.high_count||0) + (s.medium_count||0) + (s.low_count||0), 0),
          critical: items.reduce((a, s) => a + (s.critical_count || 0), 0),
          high:     items.reduce((a, s) => a + (s.high_count     || 0), 0),
          medium:   items.reduce((a, s) => a + (s.medium_count   || 0), 0),
          low:      items.reduce((a, s) => a + (s.low_count      || 0), 0),
        })
      }
    } catch (e) {
      console.error('Erreur chargement scans :', e)
    } finally {
      setLoadingScans(false)
    }
  }, [token])

  useEffect(() => { loadScans() }, [loadScans])

  // ── Sauvegarder la bio (local seulement pour l'instant) ───────────────────
  const handleSave = async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 400)) // simulation
    setBio(draftBio)
    setEditing(false)
    setSaving(false)
    toast.success('Profil mis à jour')
  }

  const handleCancel = () => {
    setDraftBio(bio)
    setEditing(false)
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const completedScans = scans.filter(s => s.status === 'completed').length
  const totalVulns     = vulnStats.total

  // Calcul temps actif estimé (nb scans × 10 min en moyenne)
  const activeHours = Math.max(1, Math.round((scans.length * 10) / 60))

  const statCards = [
    { label: 'Scans lancés',     value: scans.length,              icon: <Target size={16} />,   color: '#ef4444' },
    { label: 'CVEs analysés',    value: totalVulns.toLocaleString(), icon: <Activity size={16} />, color: '#f97316' },
    { label: 'Scans terminés',   value: completedScans,             icon: <CheckCircle size={16}/>, color: '#22c55e' },
    { label: 'Temps estimé',     value: `${activeHours}h`,          icon: <Clock size={16} />,    color: '#f97316' },
  ]

  // Badges dynamiques selon les vraies stats
  const badges = [
    { label: 'First Scan',      color: '#ef4444', earned: scans.length >= 1,              desc: '1er scan lancé'         },
    { label: 'Critical Hunter', color: '#ef4444', earned: vulnStats.critical >= 1,        desc: '1 CVE critique trouvé'  },
    { label: 'CVE Master',      color: '#f97316', earned: totalVulns >= 100,              desc: '100 CVEs analysés'       },
    { label: '10 Scans',        color: '#22c55e', earned: scans.length >= 10,             desc: '10 scans complétés'     },
    { label: 'High Analyst',    color: '#f97316', earned: vulnStats.high >= 10,           desc: '10 CVEs high trouvés'   },
    { label: 'Top Analyst',     color: '#eab308', earned: completedScans >= 5,            desc: '5 scans terminés'       },
  ]

  const initials = user?.username?.charAt(0).toUpperCase() ?? '?'

  return (
    <MainLayout>
      <div
        style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace", background:'#0a0a0a' }}
        className="min-h-screen text-slate-100 p-4 sm:p-6 space-y-5"
      >
        <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-4xl mx-auto space-y-5">

          {/* Header */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#ef4444' }} />
              <span className="text-xs tracking-widest uppercase" style={{ color:'#ef4444' }}>Mon Compte</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              My <span style={{ color:'#ef4444' }}>Profile</span>
            </h1>
          </motion.div>

          {/* Profile card ── données RÉELLES ───────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="rounded-2xl overflow-hidden" style={{ background:'#111', border:'1px solid #1f1f1f' }}>

            {/* Cover gradient */}
            <div className="h-28 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1a0000 0%, #2d0a0a 50%, #0a0a0a 100%)' }}>
              <div className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg,transparent,transparent 30px,rgba(239,68,68,0.06) 30px,rgba(239,68,68,0.06) 31px),' +
                    'repeating-linear-gradient(90deg,transparent,transparent 30px,rgba(239,68,68,0.06) 30px,rgba(239,68,68,0.06) 31px)',
                }}
              />
              {/* Rôle badge en haut à droite */}
              {user && (
                <div className="absolute top-4 right-4">
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', color:'#fca5a5' }}>
                    {user.role === 'admin' ? '👑 Admin' : '🛡️ ' + user.role}
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              <div className="flex items-end justify-between -mt-12 mb-5 flex-wrap gap-3">
                {/* Avatar avec initiale réelle */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl border-4 border-[#0a0a0a] flex items-center justify-center text-white text-2xl font-bold shadow-xl select-none" style={{ background:'linear-gradient(135deg,#7f1d1d,#ef4444)' }}>
                    {initials}
                  </div>
                  {editing && (
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow transition-colors" style={{ background:'#ef4444' }}>
                      <Camera size={11} />
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={handleSave} disabled={saving}
                        className="text-xs gap-1.5" style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444' }}>
                        {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                        {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleCancel}
                        className="text-slate-400 hover:text-white text-xs gap-1.5">
                        <X size={11} /> Annuler
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setEditing(true)}
                      className="bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs gap-1.5">
                      <Edit3 size={11} /> Modifier bio
                    </Button>
                  )}
                </div>
              </div>

              {/* Infos réelles */}
              {user ? (
                <div>
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <h2 className="text-xl font-bold text-white">{user.username}</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                      {user.role}
                    </span>
                    {user.is_active && (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Actif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap mb-4">
                    <span className="flex items-center gap-1.5">
                      <Mail size={12} /> {user.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Shield size={12} /> VulnGuard Team
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      ID #{user.id}
                    </span>
                  </div>

                  {/* Bio — éditable */}
                  {editing ? (
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Bio</label>
                      <textarea
                        value={draftBio}
                        onChange={e => setDraftBio(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl p-3 text-sm text-slate-200 resize-none focus:outline-none transition-colors" style={{ background:'#1a1a1a', border:'1px solid #333' }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">{bio}</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <AlertCircle size={14} /> Non connecté
                </div>
              )}
            </div>
          </motion.div>

          {/* Stats réelles ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statCards.map((s, i) => (
              <div key={i}
                className="rounded-xl p-4 flex flex-col gap-2 transition-all" style={{ background:'#111', border:'1px solid #1f1f1f' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor='rgba(239,68,68,0.2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor='#1f1f1f'}>
                <div className="p-1.5 rounded-lg w-fit" style={{ background: `${s.color}15`, color: s.color }}>
                  {s.icon}
                </div>
                {loadingScans ? (
                  <div className="h-8 w-12 bg-slate-800 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-white tabular-nums">{s.value}</p>
                )}
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Vrais scans récents ─────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="rounded-xl p-5" style={{ background:'#111', border:'1px solid #1f1f1f' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Globe size={13} style={{ color:'#ef4444' }} /> Scans récents
              </h3>
              <button
                onClick={loadScans}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw size={11} className={loadingScans ? 'animate-spin' : ''} /> Rafraîchir
              </button>
            </div>

            {loadingScans ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-slate-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : scans.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <Globe size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun scan effectué pour le moment</p>
                <p className="text-xs mt-1">Lancez votre premier scan depuis la page Scans</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scans.slice(0, 8).map(scan => (
                  <div key={scan.id}
                    className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ background:'rgba(255,255,255,0.02)', border:'1px solid #1a1a1a' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}>

                    {/* Status dot */}
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: statusColor(scan.status),
                        boxShadow: scan.status === 'running' ? `0 0 6px ${statusColor(scan.status)}` : 'none',
                      }}
                    />

                    {/* URL */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{scan.target_url}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span
                          className="font-medium"
                          style={{ color: statusColor(scan.status) }}
                        >
                          {statusLabel(scan.status)}
                        </span>
                        <span>·</span>
                        <span>{scan.scan_type}</span>
                        <span>·</span>
                        <Calendar size={9} />
                        <span>{timeAgo(scan.created_at)}</span>
                      </p>
                    </div>

                    {/* Score + vulns */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {scan.status === 'completed' && (
                        <div className="flex items-center gap-1.5 text-xs">
                          {scan.critical_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold tabular-nums">
                              {scan.critical_count}C
                            </span>
                          )}
                          {scan.high_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 tabular-nums">
                              {scan.high_count}H
                            </span>
                          )}
                          {scan.medium_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 tabular-nums">
                              {scan.medium_count}M
                            </span>
                          )}
                        </div>
                      )}
                      <ScoreCircle score={scan.security_score} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Badges dynamiques ─────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Star size={13} className="text-yellow-400" /> Badges & Achievements
              <span className="text-xs text-slate-500 font-normal ml-1">
                ({badges.filter(b => b.earned).length}/{badges.length})
              </span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {badges.map((b, i) => (
                <div key={i}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                    b.earned
                      ? 'border-slate-700 bg-slate-800/60'
                      : 'border-slate-800/50 bg-slate-900/30 opacity-35 grayscale'
                  }`}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: b.earned ? `${b.color}20` : 'rgba(255,255,255,0.03)',
                      color: b.earned ? b.color : '#374151',
                    }}
                  >
                    {b.earned ? <CheckCircle size={16} /> : <Award size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{b.label}</p>
                    <p className="text-[10px] text-slate-500 truncate">{b.earned ? '✓ ' + b.desc : b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </motion.div>
      </div>
    </MainLayout>
  )
}