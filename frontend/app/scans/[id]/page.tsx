'use client'

import MainLayout from '@/components/main-layout'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, AlertTriangle, CheckCircle, Clock, Globe, ArrowLeft,
  RefreshCw, ChevronDown, ChevronUp, ExternalLink, Copy, Check,
  Zap, AlertCircle, Info, Target, Lock, Activity, Download
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { scansAPI } from '@/lib/api'
import { toast } from 'sonner'
import { formatApiError } from '@/lib/api'

interface Vulnerability {
  id: number
  title: string
  description: string
  severity: string
  cvss_score: string | number
  endpoint: string
  remediation: string
  status: string
  cve_id?: string
}

interface ScanDetail {
  id: number
  target_url: string
  scan_type: string
  status: string
  security_score: number | null
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  info_count: number
  created_at: string
  started_at?: string
  completed_at?: string
}

const severityConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  critical: {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    icon: <AlertTriangle size={14} />,
    label: 'CRITICAL',
  },
  high: {
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.25)',
    icon: <Zap size={14} />,
    label: 'HIGH',
  },
  medium: {
    color: '#eab308',
    bg: 'rgba(234,179,8,0.08)',
    border: 'rgba(234,179,8,0.25)',
    icon: <AlertCircle size={14} />,
    label: 'MEDIUM',
  },
  low: {
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.25)',
    icon: <CheckCircle size={14} />,
    label: 'LOW',
  },
  info: {
    color: '#ef4444',
    bg: 'rgba(56,189,248,0.08)',
    border: 'rgba(56,189,248,0.25)',
    icon: <Info size={14} />,
    label: 'INFO',
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}
const stagger = { show: { transition: { staggerChildren: 0.07 } } }

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'
  const r = 38
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg width="112" height="112" viewBox="0 0 112 112" className="absolute inset-0 -rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="56" cy="56" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="relative text-center">
        <p className="text-2xl font-bold text-white leading-none">{score}</p>
        <p className="text-xs mt-0.5" style={{ color }}>/ 100</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; dot: string }> = {
    completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', dot: '#22c55e' },
    running:   { color: '#ef4444', bg: 'rgba(56,189,248,0.12)', dot: '#ef4444' },
    pending:   { color: '#eab308', bg: 'rgba(234,179,8,0.12)',  dot: '#eab308' },
    failed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  dot: '#ef4444' },
  }
  const c = cfg[status] ?? cfg.pending
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ color: c.color, background: c.bg }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c.dot }} />
      {status.toUpperCase()}
    </span>
  )
}

function VulnCard({ vuln, index }: { vuln: Vulnerability; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const sev = vuln.severity?.toLowerCase() || 'info'
  const cfg = severityConfig[sev] || severityConfig.info

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:brightness-110 transition-all"
      >
        <div className="flex-shrink-0 p-1.5 rounded-lg" style={{ background: `${cfg.color}20`, color: cfg.color }}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ color: cfg.color, background: `${cfg.color}15` }}>
              {cfg.label}
            </span>
            {vuln.cve_id && (
              <span className="text-xs text-red-400 font-mono">{vuln.cve_id}</span>
            )}
            {vuln.cvss_score && (
              <span className="text-xs text-slate-400">CVSS {vuln.cvss_score}</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white mt-1 truncate">{vuln.title}</p>
          {vuln.endpoint && (
            <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">{vuln.endpoint}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-slate-500">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: cfg.border }}>
          <div className="pt-3">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Description</p>
            <p className="text-sm text-slate-300 leading-relaxed">{vuln.description || '—'}</p>
          </div>

          {vuln.endpoint && (
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Endpoint affecté</p>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700 font-mono">
                <Globe size={12} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs text-red-300 truncate flex-1">{vuln.endpoint}</span>
                <button onClick={() => copyToClipboard(vuln.endpoint)}
                  className="flex-shrink-0 text-slate-500 hover:text-white transition-colors">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}

          {vuln.remediation && (
            <div className="p-3 rounded-lg bg-green-950/30 border border-green-900/40">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Shield size={11} /> Remédiation recommandée
              </p>
              <p className="text-xs text-slate-300 leading-relaxed">{vuln.remediation}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              vuln.status === 'open'
                ? 'bg-red-500/15 text-red-400'
                : vuln.status === 'fixed'
                ? 'bg-green-500/15 text-green-400'
                : 'bg-slate-500/15 text-slate-400'
            }`}>
              {vuln.status?.toUpperCase() || 'OPEN'}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default function ScanDetailPage() {
  const params = useParams()
  const scanId = params?.id as string

  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterSev, setFilterSev] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [scanRes, vulnRes] = await Promise.all([
        scansAPI.get(Number(scanId)),
        scansAPI.getVulnerabilities(Number(scanId)),
      ])
      setScan(scanRes.data as unknown as ScanDetail)
      setVulns((vulnRes.data || []) as unknown as Vulnerability[])
    } catch (error) {
      if (!silent) toast.error(formatApiError(error))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [scanId])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh si le scan est en cours
  useEffect(() => {
    if (scan?.status === 'running' || scan?.status === 'pending') {
      setAutoRefresh(true)
      const interval = setInterval(() => fetchData(true), 3000)
      return () => clearInterval(interval)
    } else {
      setAutoRefresh(false)
    }
  }, [scan?.status, fetchData])

  const filteredVulns = vulns.filter(v =>
    filterSev === 'all' || v.severity?.toLowerCase() === filterSev
  )

  const sevGroups = ['critical', 'high', 'medium', 'low', 'info']
  const severityCounts: Record<string, number> = {
    critical: scan?.critical_count || 0,
    high: scan?.high_count || 0,
    medium: scan?.medium_count || 0,
    low: scan?.low_count || 0,
    info: scan?.info_count || 0,
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-red-400/40 animate-spin"
              style={{ borderTopColor: 'transparent' }} />
            <Shield className="absolute inset-0 m-auto text-red-400" size={24} />
          </div>
          <p className="text-slate-400 text-sm tracking-widest uppercase animate-pulse">Chargement du scan…</p>
        </div>
      </MainLayout>
    )
  }

  if (!scan) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
          <AlertTriangle size={48} className="text-red-400" />
          <p className="text-white font-semibold">Scan introuvable</p>
          <p className="text-slate-500 text-sm">Ce scan n'existe pas ou a été supprimé.</p>
          <Link href="/scans"
            className="mt-2 px-4 py-2 rounded-lg bg-red-600/15 text-red-400 border border-red-500/30 text-sm hover:bg-red-600/25 transition-all">
            ← Retour aux scans
          </Link>
        </div>
      </MainLayout>
    )
  }

  const scoreVal = scan.security_score != null ? Math.round(scan.security_score) : null
  const scoreColor = scoreVal != null
    ? (scoreVal >= 80 ? '#22c55e' : scoreVal >= 60 ? '#eab308' : scoreVal >= 40 ? '#f97316' : '#ef4444')
    : '#6b7280'

  const totalVulns = (scan.critical_count || 0) + (scan.high_count || 0) +
    (scan.medium_count || 0) + (scan.low_count || 0) + (scan.info_count || 0)

  return (
    <MainLayout>
      <div
        style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
        className="min-h-screen bg-[#0a0a0a] text-slate-100 p-6 space-y-6"
      >
        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-4">
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <Link href="/scans"
              className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 transition-colors text-sm">
              <ArrowLeft size={14} /> Retour
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-400 text-sm">Scan #{scan.id}</span>
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400 tracking-widest uppercase">Scan Report</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight break-all">{scan.target_url}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={scan.status} />
                <span className="text-xs text-slate-500 font-mono">
                  {scan.scan_type.toUpperCase()} · #{scan.id}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(scan.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs transition-all disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing || autoRefresh ? 'animate-spin' : ''} />
                {autoRefresh ? 'Live...' : 'Refresh'}
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs transition-all">
                <Download size={12} /> Export
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Score + Stats */}
        <motion.div initial="hidden" animate="show" variants={stagger}>
          <motion.div variants={fadeUp}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Score card */}
            <div className="sm:col-span-2 lg:col-span-1 rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex items-center gap-4 backdrop-blur">
              {scoreVal != null ? (
                <>
                  <ScoreRing score={scoreVal} />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Security Score</p>
                    <p className="text-sm font-semibold" style={{ color: scoreColor }}>
                      {scoreVal >= 80 ? '✅ Bon' : scoreVal >= 60 ? '⚠️ Moyen' : scoreVal >= 40 ? '🔶 Risqué' : '🔴 Critique'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3 text-slate-500">
                  <Activity size={24} />
                  <span className="text-sm">Score en calcul…</span>
                </div>
              )}
            </div>

            {/* Severity counts */}
            {['critical', 'high', 'medium'].map(sev => {
              const cfg = severityConfig[sev]
              const count = severityCounts[sev]
              return (
                <div key={sev} className="rounded-xl border bg-slate-900/60 p-5 backdrop-blur flex items-center gap-4"
                  style={{ borderColor: count > 0 ? cfg.border : 'rgba(255,255,255,0.06)' }}>
                  <div className="p-2.5 rounded-xl" style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{count}</p>
                    <p className="text-xs mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                  </div>
                </div>
              )
            })}
          </motion.div>

          {/* Mini summary bar */}
          <motion.div variants={fadeUp}
            className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Distribution des vulnérabilités ({totalVulns} total)
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="text-yellow-400">{scan.medium_count}M</span>
                <span className="text-green-400">{scan.low_count}L</span>
                <span className="text-red-400">{scan.info_count}I</span>
              </div>
            </div>
            {totalVulns > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                {sevGroups.map(sev => {
                  const cnt = severityCounts[sev]
                  if (!cnt) return null
                  const pct = (cnt / totalVulns) * 100
                  return (
                    <motion.div
                      key={sev}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' as const }}
                      className="h-full rounded-sm"
                      title={`${sev}: ${cnt}`}
                      style={{ background: severityConfig[sev]?.color }}
                    />
                  )
                })}
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Vulnerabilities */}
        <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-4">
          <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Target size={14} className="text-red-400" />
              Vulnérabilités détectées
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs">{filteredVulns.length}</span>
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              {['all', ...sevGroups].map(f => {
                const cnt = f === 'all' ? totalVulns : severityCounts[f]
                if (f !== 'all' && !cnt) return null
                const cfg = f !== 'all' ? severityConfig[f] : null
                return (
                  <button key={f}
                    onClick={() => setFilterSev(f)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
                    style={filterSev === f ? {
                      background: cfg ? cfg.bg : 'rgba(56,189,248,0.12)',
                      color: cfg ? cfg.color : '#ef4444',
                      borderColor: cfg ? cfg.border : 'rgba(56,189,248,0.3)',
                    } : {
                      background: 'transparent',
                      color: '#64748b',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}>
                    {f === 'all' ? 'Tous' : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f !== 'all' && ` (${cnt})`}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {scan.status === 'running' || scan.status === 'pending' ? (
            <motion.div variants={fadeUp}
              className="rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-5 h-5 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                <p className="text-red-300 font-semibold text-sm">Scan en cours…</p>
              </div>
              <p className="text-slate-500 text-xs">Les résultats apparaîtront automatiquement.</p>
            </motion.div>
          ) : filteredVulns.length === 0 ? (
            <motion.div variants={fadeUp}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <CheckCircle size={36} className="text-green-400 mx-auto mb-3" />
              <p className="text-white font-semibold">Aucune vulnérabilité détectée</p>
              <p className="text-slate-500 text-sm mt-1">
                {filterSev !== 'all' ? `Aucune vulnérabilité de niveau ${filterSev}.` : 'Ce scan est propre.'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              {filteredVulns.map((v, i) => (
                <VulnCard key={v.id} vuln={v} index={i} />
              ))}
            </div>
          )}
        </motion.div>

        {/* Timeline */}
        {scan.status === 'completed' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <Clock size={14} className="text-purple-400" /> Timeline du scan
              </h3>
              <div className="flex flex-col sm:flex-row gap-4 text-xs">
                {[
                  { label: 'Créé', val: scan.created_at, color: '#ef4444' },
                  { label: 'Démarré', val: scan.started_at, color: '#a78bfa' },
                  { label: 'Terminé', val: scan.completed_at, color: '#22c55e' },
                ].map(t => t.val && (
                  <div key={t.label} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <div>
                      <p className="text-slate-500">{t.label}</p>
                      <p className="text-slate-300 font-mono">{new Date(t.val).toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </MainLayout>
  )
}