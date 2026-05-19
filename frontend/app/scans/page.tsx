'use client'

import MainLayout from '@/components/main-layout'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Radar, Search, Trash2, Eye, Plus, Shield, Activity, AlertTriangle, User } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

const API = 'http://localhost:8000'

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
  created_at: string
  username: string | null
  user_id: number
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Terminé'    },
  running:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', label: 'En cours'   },
  pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'En attente' },
  failed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Échoué'     },
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.12)'  },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
}

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return <span style={{ color: '#555', fontSize: 12 }}>—</span>
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'
  return (
    <div className="relative w-8 h-8">
      <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
        <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${(score / 100) * 75.4} 75.4`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold"
        style={{ color }}>{score.toFixed(0)}</span>
    </div>
  )
}

export default function ScansPage() {
  const { user: authUser } = useAuth()
  const isAdmin = authUser?.role === 'admin'

  const [scans, setScans]           = useState<Scan[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode]     = useState<'all' | 'mine'>('all')

  const getHeaders = () => {
    const token = localStorage.getItem('token')
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  }

  const fetchScans = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/scans/all?limit=500`, { headers: getHeaders() })
      if (res.ok) {
        const data = await res.json()
        setScans(data.items ?? [])
      } else {
        setError(`Erreur ${res.status}`)
      }
    } catch (e: any) {
      setError(`Connexion impossible: ${e?.message}`)
    }
    setLoading(false)
  }

  useEffect(() => { fetchScans() }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce scan ?')) return
    const res = await fetch(`${API}/scans/${id}`, { method: 'DELETE', headers: getHeaders() })
    if (res.ok || res.status === 204) {
      setScans(prev => prev.filter(s => s.id !== id))
    }
  }

  const getTopSeverity = (scan: Scan) => {
    if (scan.critical_count > 0) return 'critical'
    if (scan.high_count > 0) return 'high'
    if (scan.medium_count > 0) return 'medium'
    return 'low'
  }

  const displayed = scans.filter(s => {
    if (viewMode === 'mine' && s.user_id !== authUser?.id) return false
    const matchSearch = s.target_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.username ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total:     scans.length,
    completed: scans.filter(s => s.status === 'completed').length,
    critical:  scans.reduce((acc, s) => acc + (s.critical_count || 0), 0),
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-6 space-y-6"
        style={{ background: '#0a0a0a', fontFamily: "'IBM Plex Mono', monospace" }}>

        <div className="relative">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <Radar size={20} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h1 className="text-lg font-bold" style={{ color: '#fff' }}>
                  Scans de l'<span style={{ color: '#ef4444' }}>équipe</span>
                </h1>
                <p className="text-xs" style={{ color: '#444' }}>Tous les scans de sécurité — {stats.total} au total</p>
              </div>
            </div>
            <Link href="/scans/new">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wider transition-all"
                style={{ background: 'linear-gradient(135deg,#b91c1c,#ef4444)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Plus size={14} /> NOUVEAU SCAN
              </button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total scans',  value: stats.total,     color: '#ef4444', Icon: Activity      },
              { label: 'Terminés',     value: stats.completed, color: '#22c55e', Icon: Shield        },
              { label: 'Critiques',    value: stats.critical,  color: '#f97316', Icon: AlertTriangle },
            ].map(({ label, value, color, Icon }) => (
              <div key={label} className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: '#111', border: '1px solid #1f1f1f' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}15` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#555' }}>{label}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="rounded-xl p-3 flex items-center gap-3 mb-4"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}>

            {/* View toggle */}
            <div className="flex gap-1 shrink-0">
              {(['all', 'mine'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={{
                    background: viewMode === m ? 'rgba(239,68,68,0.1)' : 'transparent',
                    border: viewMode === m ? '1px solid rgba(239,68,68,0.25)' : '1px solid #222',
                    color: viewMode === m ? '#ef4444' : '#555',
                    cursor: 'pointer',
                  }}>
                  {m === 'all' ? 'ÉQUIPE' : 'LES MIENS'}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-slate-700" />

            {/* Search */}
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }} />
              <input type="text" placeholder="URL ou utilisateur…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: '#111', border: '1px solid #1f1f1f',
                  color: '#e2e8f0', fontFamily: 'inherit' }} />
            </div>

            {/* Status filters */}
            <div className="flex gap-1.5">
              {['all', 'completed', 'running', 'pending', 'failed'].map(f => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={{
                    background: statusFilter === f ? 'rgba(239,68,68,0.1)' : 'transparent',
                    border: statusFilter === f ? '1px solid rgba(239,68,68,0.25)' : '1px solid #222',
                    color: statusFilter === f ? '#ef4444' : '#555',
                    cursor: 'pointer',
                  }}>
                  {f === 'all' ? 'TOUS' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/5">{error}</div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ color: '#555' }}>
              <Radar size={20} style={{ color: '#ef4444', animation: 'spin 2s linear infinite', marginRight: 8 }} />
              <span className="text-xs">Chargement…</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="rounded-2xl p-16 text-center"
              style={{ background: '#111', border: '1px solid #1f1f1f' }}>
              <Radar size={32} style={{ color: '#334155', margin: '0 auto 12px' }} />
              <p className="text-sm mb-4" style={{ color: '#444' }}>Aucun scan trouvé</p>
              <Link href="/scans/new">
                <button className="px-5 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'linear-gradient(135deg,#b91c1c,#ef4444)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  Démarrer un scan
                </button>
              </Link>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: '#111', border: '1px solid #1f1f1f' }}>

              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_80px_100px_130px_90px_70px] gap-3 px-5 py-3"
                style={{ borderBottom: '1px solid rgba(30,41,59,0.8)', background: '#0d0d0d' }}>
                {['URL', 'Auteur', 'Date', 'Score', 'Sévérité', 'Vulnérabilités', 'Statut', 'Actions'].map(h => (
                  <span key={h} className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: '#555' }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {displayed.map((scan, i) => {
                const severity  = getTopSeverity(scan)
                const sevCfg    = SEVERITY_CONFIG[severity]
                const statusCfg = STATUS_CONFIG[scan.status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: scan.status }
                const isMyScam  = scan.user_id === authUser?.id

                return (
                  <motion.div key={scan.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-[2fr_1fr_1fr_80px_100px_130px_90px_70px] gap-3 px-5 py-3.5 items-center transition-all"
                    style={{ borderBottom: '1px solid #1a1a1a' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* URL */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#e2e8f0' }}>
                        {scan.target_url}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#334155' }}>
                        {scan.scan_type === 'full' ? 'Scan Complet' : 'Scan Rapide'}
                      </p>
                    </div>

                    {/* Auteur */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User size={10} style={{ color: isMyScam ? '#a78bfa' : '#555', flexShrink: 0 }} />
                      <span className="text-[10px] truncate"
                        style={{ color: isMyScam ? '#a78bfa' : '#64748b' }}>
                        {scan.username ?? `user#${scan.user_id}`}
                        {isMyScam && ' (vous)'}
                      </span>
                    </div>

                    {/* Date */}
                    <span className="text-xs" style={{ color: '#555' }}>
                      {new Date(scan.created_at).toLocaleDateString('fr-FR')}
                    </span>

                    {/* Score */}
                    <ScoreRing score={scan.security_score} />

                    {/* Severity */}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full inline-block"
                      style={{ color: sevCfg.color, background: sevCfg.bg }}>
                      {severity.toUpperCase()}
                    </span>

                    {/* Vulns */}
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold">
                      <span style={{ color: '#ef4444' }}>{scan.critical_count}C</span>
                      <span style={{ color: '#f97316' }}>{scan.high_count}H</span>
                      <span style={{ color: '#eab308' }}>{scan.medium_count}M</span>
                      <span style={{ color: '#22c55e' }}>{scan.low_count}L</span>
                    </div>

                    {/* Status */}
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full inline-block"
                      style={{ color: statusCfg.color, background: statusCfg.bg }}>
                      {statusCfg.label}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Link href={`/scans/${scan.id}`}>
                        <button className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#555' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#555' }}>
                          <Eye size={13} />
                        </button>
                      </Link>
                      {(isAdmin || isMyScam) && (
                        <button onClick={() => handleDelete(scan.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#555' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#555' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
