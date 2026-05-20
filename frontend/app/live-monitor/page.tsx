'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import MainLayout from '@/components/main-layout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Wifi, WifiOff, Shield, AlertTriangle, Zap,
  Terminal, RefreshCw, Circle, ChevronRight, Database,
  Globe, Lock, Eye, TrendingUp, Clock, CheckCircle, XCircle,
  Radio, Cpu, HardDrive, Network
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: number
  time: string
  level: 'info' | 'warn' | 'critical' | 'success' | 'debug'
  source: string
  message: string
}

interface Stats {
  total_vulns: number
  critical: number
  high: number
  medium: number
  low: number
  active_scans: number
  backend_online: boolean
  db_connected: boolean
}

interface ScanItem {
  id: number
  target_url: string
  status: string
  security_score: number | null
  critical_count: number
  high_count: number
  created_at: string
}

// ── Config ────────────────────────────────────────────────────────────────────
const API = 'http://localhost:8000'
let logCounter = 0

const LEVEL_STYLE: Record<string, string> = {
  info:     'text-red-400',
  warn:     'text-yellow-400',
  critical: 'text-red-400',
  success:  'text-green-400',
  debug:    'text-slate-500',
}

const LEVEL_BADGE: Record<string, string> = {
  info:     'bg-red-600/15 text-red-300',
  warn:     'bg-yellow-500/15 text-yellow-300',
  critical: 'bg-red-500/15 text-red-300',
  success:  'bg-green-500/15 text-green-300',
  debug:    'bg-slate-700 text-slate-400',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowStr() {
  return new Date().toLocaleTimeString('fr-FR', { hour12: false })
}

function makeLog(level: LogEntry['level'], source: string, message: string): LogEntry {
  return { id: ++logCounter, time: nowStr(), level, source, message }
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex w-2 h-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: color }} />
      <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: color }} />
    </span>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, color, icon, sub,
}: {
  label: string
  value: string | number
  color: string
  icon: React.ReactNode
  sub?: string
}) {
  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-2 backdrop-blur"
      style={{ borderColor: `${color}22` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 tracking-widest uppercase">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-slate-600">{sub}</p>}
    </div>
  )
}

// ── Network node simulation ───────────────────────────────────────────────────
function NetworkMap({ online }: { online: boolean }) {
  const nodes = [
    { x: 50,  y: 50,  label: 'Backend',  color: online ? '#22c55e' : '#ef4444', size: 12 },
    { x: 20,  y: 80,  label: 'DB',       color: '#ef4444', size: 8  },
    { x: 80,  y: 20,  label: 'Ollama',   color: '#a78bfa', size: 8  },
    { x: 80,  y: 80,  label: 'Frontend', color: '#f97316', size: 8  },
    { x: 20,  y: 20,  label: 'Scanner',  color: '#eab308', size: 6  },
  ]
  const edges = [[0,1],[0,2],[0,3],[0,4]]
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {edges.map(([a, b], i) => (
        <line key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.size / 2 + 3} fill={`${n.color}18`} />
          <circle cx={n.x} cy={n.y} r={n.size / 2} fill={n.color} opacity={0.9} />
          <text x={n.x} y={n.y + n.size / 2 + 5} textAnchor="middle" fill="#94a3b8" fontSize="4">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function LiveMonitorPage() {
  const [logs, setLogs]           = useState<LogEntry[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [scans, setScans]         = useState<ScanItem[]>([])
  const [online, setOnline]       = useState(false)
  const [paused, setPaused]       = useState(false)
  const [tick, setTick]           = useState(0)
  const [mounted, setMounted]     = useState(false)
  const logRef                    = useRef<HTMLDivElement>(null)
  const pausedRef                 = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  pausedRef.current = paused

  const addLog = useCallback((entry: LogEntry) => {
    if (pausedRef.current) return
    setLogs(prev => {
      const next = [entry, ...prev]
      return next.slice(0, 200)
    })
  }, [])

  // ── Poll backend ─────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    // Health
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) })
      if (r.ok) {
        const d = await r.json()
        setOnline(true)
        setStats(prev => ({
          ...(prev ?? { total_vulns: 0, critical: 0, high: 0, medium: 0, low: 0, active_scans: 0 }),
          backend_online: true,
          db_connected: d.database === 'connected',
          total_vulns: d.vulnerabilities ?? prev?.total_vulns ?? 0,
        }))
        addLog(makeLog('debug', 'HEALTH', `Backend OK — ${d.vulnerabilities ?? '?'} vulns en base`))
      } else {
        setOnline(false)
        addLog(makeLog('warn', 'HEALTH', `Backend HTTP ${r.status}`))
      }
    } catch {
      setOnline(false)
      addLog(makeLog('critical', 'HEALTH', 'Backend inaccessible — connexion refusée'))
    }

    // Vuln stats
    try {
      const r = await fetch(`${API}/vulnerabilities/stats`, { signal: AbortSignal.timeout(3000) })
      if (r.ok) {
        const d = await r.json()
        setStats(prev => ({
          ...(prev ?? { backend_online: false, db_connected: false, active_scans: 0 }),
          total_vulns: d.total ?? 0,
          critical:    d.critical ?? 0,
          high:        d.high ?? 0,
          medium:      d.medium ?? 0,
          low:         d.low ?? 0,
        }))
        if (d.critical > 0)
          addLog(makeLog('critical', 'CVE-DB', `${d.critical} vulnérabilités CRITIQUES détectées en base`))
        else
          addLog(makeLog('info', 'CVE-DB', `Stats: ${d.total} total — C:${d.critical} H:${d.high} M:${d.medium} L:${d.low}`))
      }
    } catch {
      addLog(makeLog('warn', 'CVE-DB', 'Impossible de récupérer les stats de vulnérabilités'))
    }

    // Recent scans
    try {
      const r = await fetch(`${API}/scans/?limit=5`, { signal: AbortSignal.timeout(3000) })
      if (r.ok) {
        const d = await r.json()
        const items: ScanItem[] = Array.isArray(d) ? d : (d.items ?? [])
        setScans(items)
        const running = items.filter((s: ScanItem) => s.status === 'running')
        setStats(prev => prev ? { ...prev, active_scans: running.length } : prev)
        if (running.length > 0)
          addLog(makeLog('info', 'SCANNER', `${running.length} scan(s) actif(s): ${running.map((s: ScanItem) => s.target_url).join(', ')}`))
        else
          addLog(makeLog('debug', 'SCANNER', 'Aucun scan en cours'))
      }
    } catch {
      addLog(makeLog('warn', 'SCANNER', 'Impossible de récupérer les scans'))
    }

    setTick(t => t + 1)
  }, [addLog])

  useEffect(() => {
    addLog(makeLog('info', 'SYSTEM', '🚀 Live Monitor démarré — connexion au backend...'))
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [poll, addLog])

  // Événements réels basés sur les changements de stats
  const prevStatsRef = useRef<Stats | null>(null)
  useEffect(() => {
    if (!stats || !online) return
    const prev = prevStatsRef.current
    if (prev) {
      if (stats.critical > prev.critical)
        addLog(makeLog('critical', 'CVE-DB', `+${stats.critical - prev.critical} nouvelle(s) vuln. CRITIQUE(S) détectée(s)`))
      if (stats.high > prev.high)
        addLog(makeLog('warn', 'CVE-DB', `+${stats.high - prev.high} nouvelle(s) vuln. HIGH détectée(s)`))
      if (stats.active_scans > prev.active_scans)
        addLog(makeLog('info', 'SCANNER', `Nouveau scan démarré — ${stats.active_scans} scan(s) actif(s)`))
      if (stats.active_scans < prev.active_scans && prev.active_scans > 0)
        addLog(makeLog('success', 'SCANNER', `Scan terminé — ${stats.total_vulns} vulnérabilités en base`))
      if (!stats.db_connected && prev.db_connected)
        addLog(makeLog('critical', 'DB', 'Connexion base de données perdue'))
      if (stats.db_connected && !prev.db_connected)
        addLog(makeLog('success', 'DB', 'Connexion base de données rétablie'))
    }
    prevStatsRef.current = stats
  }, [stats, online, addLog])

  const clearLogs = () => setLogs([])

  // ── Render ────────────────────────────────────────────────────────────────
  const s = stats

  return (
    <MainLayout>
      <div
        className="min-h-screen bg-[#0a0a0a] text-slate-100 p-4 sm:p-5 space-y-4"
        style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <PulseDot color={online ? '#22c55e' : '#ef4444'} />
              <span className={`text-xs tracking-widest uppercase font-semibold ${online ? 'text-green-400' : 'text-red-400'}`}>
                {online ? 'Système en ligne' : 'Système hors ligne'}
              </span>
              <span className="text-xs text-slate-600">— tick #{tick}</span>
            </div>
            <h1 className="text-xl font-bold text-white">
              Live <span className="text-red-400">Monitor</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Surveillance en temps réel — rafraîchissement toutes les 5s</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                paused
                  ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {paused ? <><Circle size={10} className="fill-yellow-400 text-yellow-400" /> Reprise</> : <><Circle size={10} /> Pause</>}
            </button>
            <button
              onClick={poll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <RefreshCw size={11} /> Actualiser
            </button>
            <button
              onClick={clearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-700 bg-slate-800 text-slate-400 hover:text-red-400 transition-all"
            >
              <XCircle size={11} /> Vider
            </button>
          </div>
        </div>

        {/* ── Metric cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          <MetricCard label="Backend" value={online ? 'EN LIGNE' : 'HORS LIGNE'} color={online ? '#22c55e' : '#ef4444'} icon={<Wifi size={14} />} />
          <MetricCard label="DB" value={s?.db_connected ? 'OK' : '—'} color={s?.db_connected ? '#ef4444' : '#6b7280'} icon={<Database size={14} />} />
          <MetricCard label="Scans actifs" value={s?.active_scans ?? 0} color="#f97316" icon={<Radio size={14} />} sub="en cours" />
          <MetricCard label="Total CVEs" value={(s?.total_vulns ?? 0).toLocaleString()} color="#ef4444" icon={<Shield size={14} />} />
          <MetricCard label="Critical" value={s?.critical ?? 0} color="#ef4444" icon={<AlertTriangle size={14} />} />
          <MetricCard label="High" value={s?.high ?? 0} color="#f97316" icon={<Zap size={14} />} />
          <MetricCard label="Medium" value={s?.medium ?? 0} color="#eab308" icon={<Eye size={14} />} />
        </div>

        {/* ── Main content: terminal + network + scans ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Terminal log */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden flex flex-col" style={{ minHeight: 400 }}>
            {/* Terminal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-slate-400 ml-1">vulnai-monitor — bash</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Terminal size={11} />
                {logs.length} entrées
                {paused && <span className="text-yellow-400 font-semibold">PAUSE</span>}
              </div>
            </div>

            {/* Log stream */}
            <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 text-xs font-mono" style={{ maxHeight: 440 }}>
              <AnimatePresence initial={false}>
                {logs.map(entry => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-start gap-2 py-0.5 hover:bg-slate-800/30 px-1 rounded group"
                  >
                    <span className="text-slate-600 flex-shrink-0 tabular-nums w-16">{entry.time}</span>
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${LEVEL_BADGE[entry.level]}`}>
                      {entry.level.slice(0, 4)}
                    </span>
                    <span className="text-slate-500 flex-shrink-0 w-16 truncate">{entry.source}</span>
                    <span className={`flex-1 ${LEVEL_STYLE[entry.level]}`}>{entry.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {logs.length === 0 && (
                <div className="text-slate-600 text-center py-8">
                  En attente d&apos;événements...
                </div>
              )}
            </div>
          </div>

          {/* Right column: network map + scans */}
          <div className="flex flex-col gap-4">

            {/* Network topology */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
              <div className="flex items-center gap-2 mb-3">
                <Network size={13} className="text-red-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-widest">Topologie réseau</h3>
              </div>
              <div className="h-44">
                <NetworkMap online={online} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Backend', color: online ? '#22c55e' : '#ef4444' },
                  { label: 'DB MySQL', color: '#ef4444' },
                  { label: 'Ollama AI', color: '#a78bfa' },
                  { label: 'Frontend', color: '#f97316' },
                ].map(n => (
                  <div key={n.label} className="flex items-center gap-1.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: n.color }} />
                    <span className="text-slate-500">{n.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent scans */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={13} className="text-orange-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-widest">Scans récents</h3>
              </div>
              <div className="space-y-2">
                {scans.length === 0 ? (
                  <p className="text-slate-600 text-xs text-center py-4">
                    {online ? 'Aucun scan' : 'Backend hors ligne'}
                  </p>
                ) : scans.map(scan => (
                  <div
                    key={scan.id}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:bg-slate-800/80 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      scan.status === 'completed' ? 'bg-green-500' :
                      scan.status === 'running'   ? 'bg-red-500 animate-pulse' :
                      scan.status === 'failed'    ? 'bg-red-500' : 'bg-slate-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">
                        {scan.target_url.replace(/^https?:\/\//, '')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-600 capitalize">{scan.status}</span>
                        {scan.critical_count > 0 && (
                          <span className="text-[10px] text-red-400 font-bold">{scan.critical_count}C</span>
                        )}
                        {scan.security_score != null && (
                          <span className="text-[10px] text-slate-500">Score: {Math.round(scan.security_score)}%</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={11} className="text-slate-600 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── System status bar ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Backend',      value: online ? 'EN LIGNE' : 'HORS LIGNE', color: online ? '#22c55e' : '#ef4444', icon: <Wifi size={11} /> },
              { label: 'Base de données', value: stats?.db_connected ? 'Connectée' : 'Déconnectée', color: stats?.db_connected ? '#22c55e' : '#ef4444', icon: <Database size={11} /> },
              { label: 'Polls API',    value: mounted ? tick.toString() : '—', color: '#22c55e', icon: <TrendingUp size={11} /> },
              { label: 'Uptime',       value: mounted ? `${Math.floor(tick * 5 / 60)}m ${(tick * 5) % 60}s` : '—', color: '#f97316', icon: <Clock size={11} /> },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <span style={{ color: m.color }}>{m.icon}</span>
                <span className="text-slate-500">{m.label}</span>
                <span className="ml-auto font-bold tabular-nums" style={{ color: m.color }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
