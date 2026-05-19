'use client'

import { useState, useEffect } from 'react'
import MainLayout from '@/components/main-layout'
import { motion } from 'framer-motion'
import { Globe, RefreshCw, Shield, AlertTriangle, CheckCircle, Zap, Target, ExternalLink, Search, User } from 'lucide-react'

const API = 'http://localhost:8000'

interface ScanTarget {
  url: string
  domain: string
  lastScan: string | null
  completedAt: string | null
  status: string
  score: number | null
  critical: number
  high: number
  medium: number
  low: number
  totalVulns: number
  scanCount: number
  lastScannedBy: string | null
  scanners: string[]
}

function scoreColor(s: number | null): string {
  if (s === null) return '#6b7280'
  if (s >= 80) return '#22c55e'
  if (s >= 60) return '#eab308'
  if (s >= 40) return '#f97316'
  return '#ef4444'
}

function scoreLabel(s: number | null): string {
  if (s === null) return 'Unknown'
  if (s >= 80) return 'Secure'
  if (s >= 60) return 'Moderate'
  if (s >= 40) return 'Risky'
  return 'Critical'
}

function hostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Jamais'
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Hier'
  return `Il y a ${d}j`
}

export default function AttackSurfacePage() {
  const [targets, setTargets] = useState<ScanTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [sort, setSort]       = useState<'score' | 'vulns' | 'date'>('score')

  const fetchData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      // Récupère tous les scans de toute l'équipe
      const res = await fetch(`${API}/scans/all?limit=1000`, { headers })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      const scans: any[] = Array.isArray(data) ? data : data.items ?? data.results ?? []

      // Grouper par domaine
      const map = new Map<string, ScanTarget>()
      scans.forEach(s => {
        const domain = hostname(s.target_url ?? '')
        const existing = map.get(domain)
        const completed = s.status === 'completed'
        const scanner: string = s.username ?? `user#${s.user_id}`

        if (!existing) {
          map.set(domain, {
            url:           s.target_url,
            domain,
            lastScan:      s.created_at,
            completedAt:   completed ? (s.completed_at ?? s.created_at) : null,
            status:        s.status,
            score:         completed ? s.security_score : null,
            critical:      s.critical_count ?? 0,
            high:          s.high_count     ?? 0,
            medium:        s.medium_count   ?? 0,
            low:           s.low_count      ?? 0,
            totalVulns:    (s.critical_count ?? 0) + (s.high_count ?? 0) + (s.medium_count ?? 0) + (s.low_count ?? 0),
            scanCount:     1,
            lastScannedBy: scanner,
            scanners:      [scanner],
          })
        } else {
          existing.scanCount++
          if (!existing.scanners.includes(scanner)) existing.scanners.push(scanner)
          // Garde le scan complété le plus récent
          if (completed && s.security_score !== null) {
            const isNewer = !existing.completedAt || (s.completed_at ?? '') > existing.completedAt
            if (isNewer) {
              existing.score        = s.security_score
              existing.completedAt  = s.completed_at ?? s.created_at
              existing.lastScan     = s.created_at
              existing.status       = s.status
              existing.critical     = s.critical_count ?? 0
              existing.high         = s.high_count     ?? 0
              existing.medium       = s.medium_count   ?? 0
              existing.low          = s.low_count      ?? 0
              existing.totalVulns   = existing.critical + existing.high + existing.medium + existing.low
              existing.lastScannedBy = scanner
            }
          }
        }
      })

      let arr = Array.from(map.values())
      if (sort === 'score') arr.sort((a, b) => (a.score ?? 101) - (b.score ?? 101))
      else if (sort === 'vulns') arr.sort((a, b) => b.totalVulns - a.totalVulns)
      else arr.sort((a, b) => (b.lastScan ?? '').localeCompare(a.lastScan ?? ''))

      setTargets(arr)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [sort])

  const filtered = targets.filter(t =>
    !search || t.domain.toLowerCase().includes(search.toLowerCase()) || t.url.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total:      targets.length,
    critical:   targets.filter(t => t.score !== null && t.score < 40).length,
    risky:      targets.filter(t => t.score !== null && t.score >= 40 && t.score < 60).length,
    secure:     targets.filter(t => t.score !== null && t.score >= 80).length,
    totalVulns: targets.reduce((a, t) => a + t.totalVulns, 0),
  }

  return (
    <MainLayout>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="min-h-full bg-[#0a0a0a] p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe size={14} className="text-red-400" />
              <span className="text-xs text-red-400 tracking-widest uppercase">Attack Surface</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Surface d'attaque</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {targets.length} cible{targets.length > 1 ? 's' : ''} identifiée{targets.length > 1 ? 's' : ''} · {stats.totalVulns} vulnérabilités totales
            </p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs transition-all disabled:opacity-40">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cibles totales', value: stats.total,    color: '#ef4444', icon: Target        },
            { label: 'Score critique', value: stats.critical,  color: '#ef4444', icon: AlertTriangle },
            { label: 'Risquées',       value: stats.risky,     color: '#f97316', icon: Zap           },
            { label: 'Sécurisées',     value: stats.secure,    color: '#22c55e', icon: CheckCircle   },
          ].map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + '15' }}>
                  <Icon size={14} style={{ color: s.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher domaine…"
              className="pl-7 pr-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-500/50 w-52" />
          </div>
          <span className="text-xs text-slate-600">Trier par :</span>
          {(['score','vulns','date'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${sort === s ? 'bg-red-600/15 border-red-500/30 text-red-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
              {s === 'score' ? 'Score' : s === 'vulns' ? 'Vulnérabilités' : 'Dernier scan'}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <RefreshCw size={20} className="text-slate-600 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center text-xs text-slate-600">
            {targets.length === 0 ? 'Aucun scan effectué — lancez votre premier scan' : 'Aucun résultat'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((t, i) => {
              const color = scoreColor(t.score)
              const label = scoreLabel(t.score)
              return (
                <motion.div key={t.domain}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 hover:bg-slate-900/70 transition-all">

                  {/* Domain header */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Globe size={14} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{t.domain}</p>
                        <p className="text-xs text-slate-600 truncate">{t.scanCount} scan{t.scanCount > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{ color, background: color + '15', border: `1px solid ${color}30` }}>
                      {label}
                    </span>
                  </div>

                  {/* Score ring + vulns */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      <svg viewBox="0 0 56 56" className="-rotate-90 w-full h-full">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                        <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 22}`}
                          strokeDashoffset={`${2 * Math.PI * 22 * (1 - (t.score ?? 0) / 100)}`} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold" style={{ color }}>{t.score ?? '?'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 flex-1">
                      {[
                        { label: 'Critical', value: t.critical, color: '#ef4444' },
                        { label: 'High',     value: t.high,     color: '#f97316' },
                        { label: 'Medium',   value: t.medium,   color: '#eab308' },
                        { label: 'Low',      value: t.low,      color: '#22c55e' },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                          <span className="text-xs text-slate-500">{s.label}</span>
                          <span className="text-xs font-bold text-white ml-auto">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer — traçabilité */}
                  <div className="pt-3 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User size={10} className="text-slate-600" />
                        <span className="text-[11px] text-slate-500">
                          {t.scanners.slice(0, 2).join(', ')}
                          {t.scanners.length > 2 && ` +${t.scanners.length - 2}`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600">{timeAgo(t.lastScan)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        t.status === 'completed' ? 'text-green-400 bg-green-500/10' :
                        t.status === 'running'   ? 'text-red-400 bg-red-600/10'  :
                        t.status === 'failed'    ? 'text-red-400 bg-red-500/10'    :
                        'text-slate-500 bg-slate-800'
                      }`}>{t.status}</span>
                      <a href={t.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-red-500 hover:text-red-300 transition-colors">
                        Visiter →
                      </a>
                    </div>
                  </div>

                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
