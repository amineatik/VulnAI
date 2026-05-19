'use client'

import { useState, useEffect } from 'react'
import MainLayout from '@/components/main-layout'
import { motion } from 'framer-motion'
import {
  Shield, RefreshCw, Search, Filter,
  User, Scan, FileText, AlertTriangle, CheckCircle,
  Lock, Settings, LogIn, LogOut, Eye, Download
} from 'lucide-react'

const API = 'http://localhost:8000'

interface AuditEntry {
  id: number
  timestamp: string
  actor: string
  action: string
  resource: string
  details: string
  severity: 'info' | 'warning' | 'critical' | 'success'
  category: 'auth' | 'scan' | 'vuln' | 'report' | 'config'
}

const SEV_COLOR: Record<string, string> = {
  info:     '#ef4444',
  warning:  '#f97316',
  critical: '#ef4444',
  success:  '#22c55e',
}

const CAT_ICON: Record<string, any> = {
  auth:   LogIn,
  scan:   Scan,
  vuln:   AlertTriangle,
  report: FileText,
  config: Settings,
}

function buildAuditFromData(scans: any[], vulns: any[], _user: any): AuditEntry[] {
  const entries: AuditEntry[] = []
  let id = 1

  scans.forEach(s => {
    // Utilise le username du scan (vient de /scans/all qui joint User)
    const actor = s.username ?? `user#${s.user_id}` ?? 'System'

    if (s.status === 'completed') {
      entries.push({
        id: id++,
        timestamp: s.completed_at ?? s.created_at,
        actor,
        action: 'SCAN_COMPLETED',
        resource: s.target_url,
        details: `Score: ${s.security_score ?? 'N/A'}/100 · ${s.critical_count ?? 0} critical · ${s.high_count ?? 0} high`,
        severity: (s.critical_count ?? 0) > 0 ? 'critical' : 'success',
        category: 'scan',
      })
    } else if (s.status === 'failed') {
      entries.push({
        id: id++,
        timestamp: s.created_at,
        actor,
        action: 'SCAN_FAILED',
        resource: s.target_url,
        details: 'Le scan a échoué — vérifiez la cible',
        severity: 'warning',
        category: 'scan',
      })
    } else if (s.status === 'running') {
      entries.push({
        id: id++,
        timestamp: s.created_at,
        actor,
        action: 'SCAN_RUNNING',
        resource: s.target_url,
        details: `Type: ${s.scan_type} — en cours`,
        severity: 'info',
        category: 'scan',
      })
    }
    entries.push({
      id: id++,
      timestamp: s.created_at,
      actor,
      action: 'SCAN_STARTED',
      resource: s.target_url,
      details: `Type: ${s.scan_type}`,
      severity: 'info',
      category: 'scan',
    })
  })

  vulns.filter(v => v.status === 'fixed').forEach(v => {
    entries.push({
      id: id++,
      timestamp: v.created_at,
      actor: 'Analyst',
      action: 'VULN_FIXED',
      resource: v.cve_id ?? `Vuln #${v.id}`,
      details: v.title?.slice(0, 80) ?? 'Statut mis à jour',
      severity: 'success',
      category: 'vuln',
    })
  })

  vulns.filter(v => v.severity === 'critical' && v.status !== 'fixed').slice(0, 50).forEach(v => {
    entries.push({
      id: id++,
      timestamp: v.created_at,
      actor: 'System',
      action: 'CRITICAL_VULN_DETECTED',
      resource: v.cve_id ?? `Vuln #${v.id}`,
      details: `CVSS ${v.cvss_score ?? 'N/A'} · ${v.title?.slice(0, 60)}`,
      severity: 'critical',
      category: 'vuln',
    })
  })

  return entries
    .filter(e => e.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1)  return 'À l\'instant'
  if (m < 60) return `Il y a ${m} min`
  if (h < 24) return `Il y a ${h}h`
  return `Il y a ${d}j`
}

export default function AuditPage() {
  const [entries, setEntries]     = useState<AuditEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [sevFilter, setSevFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')

  const fetchData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

      const [scansRes, vulnsRes] = await Promise.all([
        fetch(`${API}/scans/all?limit=500`, { headers }),
        fetch(`${API}/vulnerabilities?limit=500`, { headers }),
      ])

      const sd = scansRes.ok ? await scansRes.json() : []
      const vd = vulnsRes.ok ? await vulnsRes.json() : []

      const scansArr = Array.isArray(sd) ? sd : sd.items ?? sd.results ?? []
      const vulnsArr = Array.isArray(vd) ? vd : vd.results ?? vd.items ?? []

      // Passe null comme user pour que buildAuditFromData utilise le username du scan
      setEntries(buildAuditFromData(scansArr, vulnsArr, null))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filtered = entries.filter(e => {
    const matchSev = sevFilter === 'all' || e.severity === sevFilter
    const matchCat = catFilter === 'all' || e.category === catFilter
    const matchSearch = !search || e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.resource.toLowerCase().includes(search.toLowerCase()) ||
      e.actor.toLowerCase().includes(search.toLowerCase())
    return matchSev && matchCat && matchSearch
  })

  const stats = {
    total:    entries.length,
    critical: entries.filter(e => e.severity === 'critical').length,
    warning:  entries.filter(e => e.severity === 'warning').length,
    success:  entries.filter(e => e.severity === 'success').length,
  }

  return (
    <MainLayout>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="min-h-full bg-[#0a0a0a] p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-red-400" />
              <span className="text-xs text-red-400 tracking-widest uppercase">Audit Trail</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Journal d'audit</h1>
            <p className="text-xs text-slate-500 mt-0.5">{entries.length} événements enregistrés</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs transition-all disabled:opacity-40">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Events',  value: stats.total,    color: '#ef4444' },
            { label: 'Critical',      value: stats.critical, color: '#ef4444' },
            { label: 'Warnings',      value: stats.warning,  color: '#f97316' },
            { label: 'Success',       value: stats.success,  color: '#22c55e' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs mt-1" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Action, ressource, acteur…"
              className="pl-7 pr-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-red-500/50 w-56" />
          </div>
          {['all','critical','warning','success','info'].map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${sevFilter === s ? 'bg-red-600/15 border-red-500/30 text-red-300' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <div className="w-px bg-slate-700" />
          {['all','auth','scan','vuln','report','config'].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${catFilter === c ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-700 text-slate-500 hover:text-slate-300'}`}>
              {c === 'all' ? 'All Cat.' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <RefreshCw size={16} className="text-slate-600 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-600">Aucun événement</div>
          ) : (
            filtered.slice(0, 150).map((e, i) => {
              const Icon = CAT_ICON[e.category] ?? Shield
              const color = SEV_COLOR[e.severity] ?? '#ef4444'
              return (
                <motion.div key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.008 }}
                  className="flex items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 hover:bg-slate-800/30 transition-all">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: color + '15', border: `1px solid ${color}30` }}>
                    <Icon size={12} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white font-mono">{e.action}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase" style={{ color, background: color + '15' }}>
                        {e.severity}
                      </span>
                      <span className="text-[10px] text-slate-600 uppercase tracking-widest">{e.category}</span>
                    </div>
                    <p className="text-xs text-red-400/80 mt-0.5 font-mono truncate">{e.resource}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{e.details}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400 font-medium">{e.actor}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{timeAgo(e.timestamp)}</p>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </MainLayout>
  )
}
