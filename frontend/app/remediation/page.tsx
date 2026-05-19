'use client'

import { useState, useEffect } from 'react'
import MainLayout from '@/components/main-layout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, Clock, AlertTriangle, Zap, RefreshCw,
  Search, TrendingUp, Shield, Target
} from 'lucide-react'

const API = 'http://localhost:8000'

interface Vuln {
  id: number
  cve_id: string | null
  title: string
  description: string | null
  severity: string
  cvss_score: string | null
  status: string
  endpoint: string | null
  remediation: string | null
  scan_id: number | null
  created_at: string | null
}

const SEV_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: 'Critical' },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.08)', label: 'High'     },
  medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.08)',  label: 'Medium'   },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  label: 'Low'      },
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  open:        { color: '#ef4444', label: 'Open',        icon: AlertTriangle },
  in_progress: { color: '#f97316', label: 'In Progress', icon: Clock        },
  fixed:       { color: '#22c55e', label: 'Fixed',       icon: CheckCircle  },
  ignored:     { color: '#6b7280', label: 'Ignored',     icon: Shield       },
}

const PRIORITY = ['critical', 'high', 'medium', 'low']

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Hier'
  return `Il y a ${d}j`
}

export default function RemediationPage() {
  const [vulns, setVulns]           = useState<Vuln[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [sevFilter, setSevFilter]   = useState('all')
  const [statFilter, setStatFilter] = useState('all')
  const [updating, setUpdating]     = useState<number | null>(null)

  const fetchVulns = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      const res = await fetch(`${API}/vulnerabilities?limit=500`, { headers })
      if (res.ok) {
        const data = await res.json()
        const list: Vuln[] = Array.isArray(data) ? data : data.results ?? data.items ?? []
        list.sort((a, b) => PRIORITY.indexOf(a.severity) - PRIORITY.indexOf(b.severity))
        setVulns(list)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchVulns() }, [])

  const updateStatus = async (id: number, status: string) => {
    setUpdating(id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/vulnerabilities/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      })
      if (res.ok) setVulns(prev => prev.map(v => v.id === id ? { ...v, status } : v))
    } catch {}
    setUpdating(null)
  }

  const filtered = vulns.filter(v => {
    const matchSev    = sevFilter  === 'all' || v.severity === sevFilter
    const matchStat   = statFilter === 'all' || v.status   === statFilter
    const matchSearch = !search ||
      (v.cve_id ?? '').toLowerCase().includes(search.toLowerCase()) ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.endpoint ?? '').toLowerCase().includes(search.toLowerCase())
    return matchSev && matchStat && matchSearch
  })

  const stats = {
    total:       vulns.length,
    open:        vulns.filter(v => v.status === 'open').length,
    in_progress: vulns.filter(v => v.status === 'in_progress').length,
    fixed:       vulns.filter(v => v.status === 'fixed').length,
    critical:    vulns.filter(v => v.severity === 'critical' && v.status === 'open').length,
  }
  const fixRate = stats.total > 0 ? Math.round((stats.fixed / stats.total) * 100) : 0

  return (
    <MainLayout>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="min-h-full bg-[#0a0a0a] p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target size={14} className="text-red-400" />
              <span className="text-xs text-red-400 tracking-widest uppercase">Remediation Center</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Suivi des corrections</h1>
            <p className="text-xs text-slate-500 mt-0.5">{stats.total} vulnérabilités · {fixRate}% corrigées</p>
          </div>
          <button onClick={fetchVulns} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs transition-all disabled:opacity-40">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Open',          value: stats.open,        color: '#ef4444', icon: AlertTriangle },
            { label: 'In Progress',   value: stats.in_progress, color: '#f97316', icon: Clock        },
            { label: 'Fixed',         value: stats.fixed,       color: '#22c55e', icon: CheckCircle  },
            { label: 'Critical Open', value: stats.critical,    color: '#ef4444', icon: Zap          },
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

        {/* Progress */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Progression globale</span>
            <span className="text-xs font-bold text-red-400">{fixRate}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${fixRate}%` }} transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-red-700 to-green-500 rounded-full" />
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[
              { label: 'Open',        count: stats.open,        color: '#ef4444' },
              { label: 'In Progress', count: stats.in_progress, color: '#f97316' },
              { label: 'Fixed',       count: stats.fixed,       color: '#22c55e' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[11px] text-slate-500">{s.label}: <span className="text-white font-bold">{s.count}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="CVE, titre, endpoint…"
              className="pl-7 pr-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-500/50 w-56" />
          </div>
          {(['all','critical','high','medium','low'] as const).map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${sevFilter === s ? 'bg-red-600/15 border-red-500/30 text-red-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
              {s === 'all' ? 'All Severity' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="w-px bg-slate-700" />
          {(['all','open','in_progress','fixed','ignored'] as const).map(s => (
            <button key={s} onClick={() => setStatFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${statFilter === s ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
              {s === 'all' ? 'All Status' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-widest">
            <div className="col-span-1">Sév</div>
            <div className="col-span-3">CVE / Titre</div>
            <div className="col-span-3 hidden lg:block">Endpoint</div>
            <div className="col-span-2 hidden md:block">Description</div>
            <div className="col-span-1">CVSS</div>
            <div className="col-span-2">Statut</div>
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <RefreshCw size={16} className="text-slate-600 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-600">
              {vulns.length === 0 ? 'Aucune vulnérabilité — lancez un scan pour commencer' : 'Aucun résultat'}
            </div>
          ) : (
            <AnimatePresence>
              {filtered.slice(0, 200).map((v, i) => {
                const sev  = SEV_CONFIG[v.severity]  ?? SEV_CONFIG.low
                const stat = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.open
                const StatIcon = stat.icon
                return (
                  <motion.div key={v.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.005, 0.3) }}
                    className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/20 transition-all items-center text-xs">

                    <div className="col-span-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{ color: sev.color, background: sev.bg }}>
                        {v.severity.slice(0, 4)}
                      </span>
                    </div>

                    <div className="col-span-3 min-w-0">
                      <p className="text-red-400 font-mono text-[11px] truncate">
                        {v.cve_id ?? `ID-${v.id}`}
                      </p>
                      <p className="text-slate-300 truncate mt-0.5">{v.title}</p>
                      {v.created_at && (
                        <p className="text-[10px] text-slate-600 mt-0.5">{timeAgo(v.created_at)}</p>
                      )}
                    </div>

                    <div className="col-span-3 hidden lg:block min-w-0">
                      <p className="text-slate-500 truncate text-[11px]">
                        {v.endpoint ?? '—'}
                      </p>
                    </div>

                    <div className="col-span-2 hidden md:block min-w-0">
                      <p className="text-slate-600 truncate text-[11px]">
                        {v.description?.slice(0, 60) ?? v.remediation?.slice(0, 60) ?? '—'}
                      </p>
                    </div>

                    <div className="col-span-1">
                      <span className="text-white font-bold">{v.cvss_score ?? '—'}</span>
                      {v.cvss_score && <span className="text-slate-600">/10</span>}
                    </div>

                    <div className="col-span-2">
                      <select
                        value={v.status}
                        disabled={updating === v.id}
                        onChange={e => updateStatus(v.id, e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-red-500/50 cursor-pointer disabled:opacity-50"
                        style={{ color: stat.color }}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="fixed">Fixed</option>
                        <option value="ignored">Ignored</option>
                      </select>
                    </div>

                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        {filtered.length > 200 && (
          <p className="text-xs text-slate-600 text-center">
            Affichage de 200 résultats sur {filtered.length} — utilisez les filtres pour affiner
          </p>
        )}

      </div>
    </MainLayout>
  )
}
