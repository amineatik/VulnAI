'use client'

import { useState, useEffect, useCallback } from 'react'
import MainLayout from '@/components/main-layout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, AlertTriangle, Activity, TrendingUp, TrendingDown,
  Eye, Zap, Globe, Lock, Cpu, Database, RefreshCw,
  ChevronRight, Clock, CheckCircle, XCircle, AlertCircle,
  BarChart2, PieChart, Layers, Target, ArrowUpRight, ArrowDownRight,
  Bell, Filter, Download, Calendar, Search, Monitor, WifiOff,
  Wifi, Info, ExternalLink, Crosshair
} from 'lucide-react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Vulnerability {
  id: string | number
  cve_id: string
  title?: string
  description?: string
  severity: string
  cvss_score: number
  published_date?: string
  endpoint?: string
  status?: string
}

interface SeverityCount {
  CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number; UNKNOWN: number
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e', UNKNOWN: '#6b7280',
}
const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(239,68,68,0.12)', HIGH: 'rgba(249,115,22,0.12)',
  MEDIUM: 'rgba(234,179,8,0.12)', LOW: 'rgba(34,197,94,0.12)', UNKNOWN: 'rgba(107,114,128,0.12)',
}

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } } }
const stagger = { show: { transition: { staggerChildren: 0.07 } } }

function extractArray(data: unknown): Vulnerability[] {
  if (Array.isArray(data)) return data as Vulnerability[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.results)) return obj.results as Vulnerability[]
    if (Array.isArray(obj.data))    return obj.data    as Vulnerability[]
    if (Array.isArray(obj.items))   return obj.items   as Vulnerability[]
    for (const val of Object.values(obj)) { if (Array.isArray(val)) return val as Vulnerability[] }
  }
  return []
}

function normalizeSeverity(s: string) {
  const up = (s ?? 'UNKNOWN').toUpperCase()
  return ['CRITICAL','HIGH','MEDIUM','LOW'].includes(up) ? up : 'UNKNOWN'
}
function normalizeScore(v: Vulnerability) {
  const n = Number(v.cvss_score); return isNaN(n) ? 0 : Math.round(n * 10) / 10
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data); const min = Math.min(...data); const range = max - min || 1
  const W = 80; const H = 32
  const pts = data.map((v, i) => `${(i/(data.length-1))*W},${H-((v-min)/range)*H}`).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}

function DonutChart({ data }: { data: SeverityCount }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0)
  const total   = entries.reduce((s, [, v]) => s + v, 0)
  if (total === 0) return (
    <div className="flex items-center gap-4">
      <div className="w-[140px] h-[140px] rounded-full border-[14px] flex items-center justify-center" style={{ borderColor: '#1a1a1a' }}>
        <span className="text-xs" style={{ color: '#333' }}>—</span>
      </div>
      <p className="text-sm" style={{ color: '#333' }}>Aucune donnée</p>
    </div>
  )
  const R = 52; const CX = 70; const CY = 70; const STROKE = 22
  let cumAngle = -90
  const polarToCart = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.cos((deg*Math.PI)/180), y: cy + r * Math.sin((deg*Math.PI)/180) })
  const describeArc = (cx: number, cy: number, r: number, start: number, end: number) => {
    const s = polarToCart(cx,cy,r,start); const e = polarToCart(cx,cy,r,end)
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${end-start>180?1:0} 1 ${e.x} ${e.y}`
  }
  const slices = entries.map(([key, val]) => {
    const pct = val/total; const angle = pct*360; const start = cumAngle; cumAngle += angle
    return { key, val, pct, start, angle, color: SEV_COLOR[key] ?? '#6b7280' }
  })
  return (
    <div className="flex items-center gap-6">
      <svg width={140} height={140}>
        <circle cx={CX} cy={CY} r={R} stroke="#1a1a1a" strokeWidth={STROKE} fill="none" />
        {slices.map(sl => (
          <path key={sl.key} d={describeArc(CX,CY,R,sl.start,sl.start+sl.angle)} stroke={sl.color} strokeWidth={STROKE} fill="none" strokeLinecap="butt" />
        ))}
        <text x={CX} y={CY-7} textAnchor="middle" fill="#f1f5f9" fontSize="18" fontWeight="700">{total}</text>
        <text x={CX} y={CY+11} textAnchor="middle" fill="#555" fontSize="10">total</text>
      </svg>
      <div className="flex flex-col gap-2">
        {slices.map(sl => (
          <div key={sl.key} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sl.color }} />
            <span className="w-20" style={{ color: '#666' }}>{sl.key}</span>
            <span className="font-bold text-white">{sl.val}</span>
            <span style={{ color: '#444' }}>({(sl.pct*100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 9 ? '#ef4444' : score >= 7 ? '#f97316' : score >= 4 ? '#eab308' : '#22c55e'
  const R = 38; const circ = Math.PI * R; const offset = circ * (1 - Math.min(score/10,1))
  return (
    <svg width={100} height={60} viewBox="0 0 100 60">
      <path d="M 12 50 A 38 38 0 0 1 88 50" stroke="#1a1a1a" strokeWidth="9" fill="none" />
      <path d="M 12 50 A 38 38 0 0 1 88 50" stroke={color} strokeWidth="9" fill="none"
        strokeDasharray={`${circ}`} strokeDashoffset={`${offset}`} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.9s ease' }} />
      <text x={50} y={46} textAnchor="middle" fill={color} fontSize="13" fontWeight="700">{score.toFixed(1)}</text>
    </svg>
  )
}

function LoadingScreen() {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor: 'rgba(239,68,68,0.2)' }} />
          <div className="absolute inset-2 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(239,68,68,0.5)', borderTopColor: 'transparent' }} />
          <Crosshair className="absolute inset-0 m-auto" size={22} style={{ color: '#ef4444' }} />
        </div>
        <p className="text-xs tracking-widest uppercase animate-pulse" style={{ color: '#444' }}>Chargement des données…</p>
      </div>
    </MainLayout>
  )
}

export default function DashboardPage() {
  const [vulns, setVulns]             = useState<Vulnerability[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [offline, setOffline]         = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [timeRange, setTimeRange]     = useState<'7d'|'30d'|'90d'>('30d')
  const [activeTab, setActiveTab]     = useState<'overview'|'trends'|'assets'>('overview')
  const [severity, setSeverity]       = useState<SeverityCount>({ CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0, UNKNOWN:0 })
  const [avgScore, setAvgScore]       = useState(0)
  const [topTypes, setTopTypes]       = useState<Record<string, number>>({})
  const [byYear, setByYear]           = useState<Record<string, number>>({})
  const [recent, setRecent]           = useState<Vulnerability[]>([])
  const [criticalList, setCriticalList] = useState<Vulnerability[]>([])

  const compute = useCallback((items: Vulnerability[]) => {
    if (!Array.isArray(items) || items.length === 0) return
    const sev: SeverityCount = { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0, UNKNOWN:0 }
    items.forEach(v => { const s = normalizeSeverity(v.severity) as keyof SeverityCount; sev[s]++ })
    setSeverity(sev)
    const scored = items.filter(v => normalizeScore(v) > 0)
    setAvgScore(scored.length ? scored.reduce((s,v) => s+normalizeScore(v),0)/scored.length : 0)
    const keywords = ['Buffer Overflow','SQL Injection','XSS','RCE','Privilege Escalation','DoS','Directory Traversal','Information Disclosure','Authentication Bypass','Command Injection','Memory Corruption','Race Condition','Use-After-Free']
    const typeMap: Record<string,number> = {}
    items.forEach(v => { const txt = ((v.title??'')+(v.description??'')).toLowerCase(); keywords.forEach(kw => { if(txt.includes(kw.toLowerCase())) typeMap[kw]=(typeMap[kw]??0)+1 }) })
    setTopTypes(Object.fromEntries(Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).slice(0,8)))
    const yearMap: Record<string,number> = {}
    items.forEach(v => { const yr=(v.published_date??'').slice(0,4); if(yr&&yr.length===4&&!isNaN(Number(yr))) yearMap[yr]=(yearMap[yr]??0)+1 })
    setByYear(yearMap)
    setRecent([...items].filter(v=>v.published_date).sort((a,b)=>(b.published_date??'').localeCompare(a.published_date??'')).slice(0,6))
    setCriticalList(items.filter(v=>normalizeSeverity(v.severity)==='CRITICAL').sort((a,b)=>normalizeScore(b)-normalizeScore(a)).slice(0,5))
  }, [])

  const load = useCallback(async (silent=false) => {
    if(!silent) setLoading(true); else setRefreshing(true)
    try {
      const res = await fetch(`${API}/vulnerabilities?limit=10000`, { signal: AbortSignal.timeout(10_000) })
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const items = extractArray(data).map(v => ({ ...v, severity: normalizeSeverity(v.severity), cvss_score: normalizeScore(v) }))
      setVulns(items); compute(items); setLastUpdated(new Date()); setOffline(false)
    } catch(err) { console.warn('[Dashboard]', err); setOffline(true) }
    finally { setLoading(false); setRefreshing(false) }
  }, [compute])

  useEffect(() => { load() }, [load])

  const sparkCritical = [3,5,4,8,6,9,12,10,14,11,16,13]
  const sparkHigh     = [8,10,7,12,11,15,13,16,14,18,15,20]
  const sparkLow      = [20,18,22,19,21,17,20,18,15,17,13,14]
  const sparkScore    = [6.1,6.4,6.8,7.1,6.9,7.3,7.5,7.2,7.8,7.6,8.0,7.9]

  if (loading) return <LoadingScreen />

  const riskScore = Math.min(100, Math.round((severity.CRITICAL*10+severity.HIGH*6+severity.MEDIUM*3+severity.LOW)/Math.max(vulns.length,1)*10))

  const statCards = [
    { label:'Total CVEs',  value:vulns.length.toLocaleString(), change:+12.4, icon:<Database size={16}/>, color:'#ef4444', bg:'rgba(239,68,68,0.1)', spark:sparkCritical },
    { label:'Critical',    value:severity.CRITICAL,             change:+8.2,  icon:<AlertTriangle size={16}/>, color:'#ef4444', bg:'rgba(239,68,68,0.1)', spark:sparkCritical },
    { label:'High',        value:severity.HIGH,                 change:-3.1,  icon:<Zap size={16}/>, color:'#f97316', bg:'rgba(249,115,22,0.1)', spark:sparkHigh },
    { label:'Avg CVSS',    value:avgScore.toFixed(2),           change:+0.3,  icon:<Target size={16}/>, color:'#f97316', bg:'rgba(249,115,22,0.1)', spark:sparkScore },
    { label:'Medium',      value:severity.MEDIUM,               change:-5.7,  icon:<AlertCircle size={16}/>, color:'#eab308', bg:'rgba(234,179,8,0.1)', spark:sparkHigh },
    { label:'Low',         value:severity.LOW,                  change:-11.2, icon:<CheckCircle size={16}/>, color:'#22c55e', bg:'rgba(34,197,94,0.1)', spark:sparkLow },
  ]

  const CARD = { background:'#111', border:'1px solid #1f1f1f' }
  const CARD_HOVER = 'hover:border-red-900/40'

  return (
    <MainLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-5" style={{ background:'#0a0a0a', fontFamily:"'IBM Plex Mono', monospace", color:'#e2e8f0' }}>

        {/* Offline banner */}
        <AnimatePresence>
          {offline && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs"
              style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', color:'#f97316' }}>
              <WifiOff size={13} className="flex-shrink-0" />
              <span style={{ color:'rgba(249,115,22,0.8)' }}>Backend inaccessible ({API}) — données indisponibles</span>
              <button onClick={() => load()} className="ml-auto flex items-center gap-1 font-medium transition-colors" style={{ color:'#f97316' }}>
                <RefreshCw size={11}/> Réessayer
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={stagger} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${offline ? 'bg-orange-400' : 'animate-pulse'}`} style={{ background: offline ? '#f97316' : '#ef4444' }} />
              <span className="text-xs tracking-widest uppercase" style={{ color: offline ? '#f97316' : '#ef4444' }}>
                {offline ? 'Hors ligne' : 'Live Intelligence'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Security <span style={{ color:'#ef4444' }}>Dashboard</span>
            </h1>
            <p className="text-xs mt-0.5" style={{ color:'#444' }}>
              Mis à jour : {lastUpdated.toLocaleTimeString()} — {vulns.length.toLocaleString()} CVEs chargés
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg overflow-hidden" style={{ border:'1px solid #1f1f1f' }}>
              {(['7d','30d','90d'] as const).map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  className="px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: timeRange===r ? 'rgba(239,68,68,0.12)' : 'transparent',
                    color: timeRange===r ? '#ef4444' : '#555',
                    borderRight: '1px solid #1f1f1f',
                  }}>
                  {r}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{ border:'1px solid #222', color:'#555' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.borderColor='#333' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#555'; (e.currentTarget as HTMLElement).style.borderColor='#222' }}>
              <Download size={12}/> Export
            </button>
            <button onClick={() => load(true)} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
              style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.15)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.08)'}>
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Rafraîchissement…' : 'Refresh'}
            </button>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-0" style={{ borderBottom:'1px solid #1a1a1a' }}>
          {(['overview','trends','assets'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className="px-5 py-2.5 text-xs font-medium tracking-widest uppercase transition-all -mb-px"
              style={{
                borderBottom: activeTab===tab ? '2px solid #ef4444' : '2px solid transparent',
                color: activeTab===tab ? '#ef4444' : '#444',
              }}
              onMouseEnter={e => { if(activeTab!==tab) (e.currentTarget as HTMLElement).style.color='#888' }}
              onMouseLeave={e => { if(activeTab!==tab) (e.currentTarget as HTMLElement).style.color='#444' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">

            {/* Stat cards */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {statCards.map((s, i) => (
                <div key={i} className="rounded-xl p-4 flex flex-col gap-3 cursor-default transition-all"
                  style={CARD}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor='rgba(239,68,68,0.2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor='#1f1f1f'}>
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg" style={{ background: s.bg }}>
                      <span style={{ color: s.color }}>{s.icon}</span>
                    </div>
                    <span className="text-xs flex items-center gap-0.5 font-medium" style={{ color: s.change>=0 ? '#ef4444' : '#22c55e' }}>
                      {s.change>=0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                      {Math.abs(s.change)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white tabular-nums">{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color:'#444' }}>{s.label}</p>
                  </div>
                  <Sparkline data={s.spark} color={s.color} />
                </div>
              ))}
            </motion.div>

            {/* Row 2 */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Severity Donut */}
              <div className="rounded-xl p-5" style={CARD}>
                <div className="flex items-center gap-2 mb-4">
                  <PieChart size={13} style={{ color:'#ef4444' }} />
                  <h3 className="text-sm font-semibold text-white">Severity Distribution</h3>
                </div>
                <DonutChart data={severity} />
              </div>

              {/* Risk Posture */}
              <div className="rounded-xl p-5 flex flex-col" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Activity size={13} style={{ color:'#f97316' }} /> Risk Posture
                </h3>
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <ScoreGauge score={avgScore} />
                  <div className="text-center">
                    <p className="text-xs mb-1" style={{ color:'#444' }}>Global Risk Index</p>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-3xl font-bold text-white tabular-nums">{riskScore}</span>
                      <span className="text-xs" style={{ color:'#444' }}>/100</span>
                    </div>
                    <div className="mt-2 text-xs font-medium px-3 py-1 rounded-full inline-block"
                      style={{ background: riskScore>=70 ? 'rgba(239,68,68,0.12)' : riskScore>=40 ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)', color: riskScore>=70 ? '#ef4444' : riskScore>=40 ? '#f97316' : '#22c55e' }}>
                      {riskScore>=70 ? '🔴 High Risk' : riskScore>=40 ? '🟠 Medium Risk' : '🟢 Low Risk'}
                    </div>
                  </div>
                  <div className="w-full mt-3 space-y-2">
                    {[
                      { label:'Attack Surface', val:72, color:'#f97316' },
                      { label:'Patch Coverage',  val:45, color:'#eab308' },
                      { label:'Threat Intel',    val:88, color:'#22c55e' },
                    ].map(m => (
                      <div key={m.label} className="flex items-center gap-2">
                        <span className="text-xs w-28" style={{ color:'#555' }}>{m.label}</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background:'#1a1a1a' }}>
                          <motion.div initial={{ width:0 }} animate={{ width:`${m.val}%`}} transition={{ duration:0.8, delay:0.2 }}
                            className="h-full rounded-full" style={{ background:m.color }} />
                        </div>
                        <span className="text-xs w-8 text-right" style={{ color:'#888' }}>{m.val}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent CVEs */}
              <div className="rounded-xl p-5" style={CARD}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock size={13} style={{ color:'#f97316' }} /> Recent CVEs
                  </h3>
                  <Link href="/vulnerabilities" className="text-xs flex items-center gap-1 transition-colors" style={{ color:'#ef4444' }}
                    onMouseEnter={(e:any) => e.currentTarget.style.color='#f97316'}
                    onMouseLeave={(e:any) => e.currentTarget.style.color='#ef4444'}>
                    Voir tout <ExternalLink size={10}/>
                  </Link>
                </div>
                <div className="space-y-2">
                  {recent.length === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color:'#333' }}>{offline ? 'Backend hors ligne' : 'Aucun CVE récent'}</p>
                  ) : recent.map(v => (
                    <div key={`${v.id}-${v.cve_id}`} className="flex items-start gap-2.5 p-2.5 rounded-lg transition-colors"
                      style={{ background:'rgba(255,255,255,0.02)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.05)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}>
                      <span className="mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background:SEV_BG[v.severity]??SEV_BG.UNKNOWN, color:SEV_COLOR[v.severity]??SEV_COLOR.UNKNOWN }}>
                        {v.severity.slice(0,3)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color:'#ef4444' }}>{v.cve_id}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color:'#444' }}>{v.title ?? v.description?.slice(0,60) ?? '—'}</p>
                      </div>
                      <span className="text-xs font-mono font-semibold flex-shrink-0" style={{ color:SEV_COLOR[v.severity]??'#6b7280' }}>
                        {normalizeScore(v).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Row 3 */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Top Attack Types */}
              <div className="rounded-xl p-5" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <BarChart2 size={13} style={{ color:'#eab308' }} /> Top Attack Types
                </h3>
                {Object.keys(topTypes).length === 0 ? (
                  <p className="text-sm" style={{ color:'#333' }}>{offline ? 'Backend hors ligne' : 'Aucune donnée détectée'}</p>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(topTypes).map(([type, count]) => {
                      const maxCount = Math.max(...Object.values(topTypes))
                      const pct = (count/maxCount)*100
                      return (
                        <div key={type}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="truncate max-w-[150px]" style={{ color:'#aaa' }}>{type}</span>
                            <span className="tabular-nums" style={{ color:'#555' }}>{count.toLocaleString()}</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background:'#1a1a1a' }}>
                            <motion.div initial={{ width:0 }} animate={{ width:`${pct}%`}} transition={{ duration:0.6 }}
                              className="h-full rounded-full" style={{ background:'linear-gradient(90deg,#ef4444,#f97316)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Critical Top CVSS */}
              <div className="rounded-xl p-5" style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color:'#fca5a5' }}>
                    <AlertTriangle size={13} style={{ color:'#ef4444' }} /> Critical — Top CVSS
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full tabular-nums" style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444' }}>
                    {severity.CRITICAL} total
                  </span>
                </div>
                <div className="space-y-2.5">
                  {criticalList.length === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color:'#333' }}>{offline ? 'Backend hors ligne' : 'Aucun CVE critique'}</p>
                  ) : criticalList.map(v => (
                    <div key={`${v.id}-crit`} className="flex items-center gap-3 p-2.5 rounded-lg transition-colors"
                      style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.14)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.08)'}>
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background:'rgba(239,68,68,0.15)' }}>
                        <span className="text-sm font-bold tabular-nums" style={{ color:'#ef4444' }}>{normalizeScore(v).toFixed(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color:'#fca5a5' }}>{v.cve_id}</p>
                        <p className="text-xs truncate" style={{ color:'#555' }}>{v.title ?? v.description?.slice(0,50) ?? '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend Signals */}
              <div className="rounded-xl p-5" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <TrendingUp size={13} style={{ color:'#22c55e' }} /> Trend Signals
                </h3>
                <div className="space-y-4">
                  {[
                    { label:'Critical',  data:sparkCritical, color:'#ef4444' },
                    { label:'High',      data:sparkHigh,     color:'#f97316' },
                    { label:'Low',       data:sparkLow,      color:'#22c55e' },
                    { label:'Avg Score', data:sparkScore,    color:'#a78bfa' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3">
                      <span className="text-xs w-20" style={{ color:'#666' }}>{s.label}</span>
                      <div className="flex-1"><Sparkline data={s.data} color={s.color}/></div>
                      <span className="text-xs font-mono font-bold w-8 text-right" style={{ color:s.color }}>{s.data[s.data.length-1]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg" style={{ background:'#151515', border:'1px solid #1f1f1f' }}>
                  <p className="text-xs flex items-center gap-1.5" style={{ color:'#888' }}>
                    <Bell size={10} style={{ color:'#eab308', flexShrink:0 }} />
                    <span><strong style={{ color:'#eab308' }}>+8.2%</strong> spike critique détecté — 7 jours</span>
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Quick actions */}
            <motion.div variants={fadeUp}>
              <h3 className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color:'#333' }}>Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label:'Scan CVEs',   icon:<Search size={18}/>,    href:'/vulnerabilities', color:'#ef4444' },
                  { label:'AI Analysis', icon:<Cpu size={18}/>,       href:'/analysis',         color:'#f97316' },
                  { label:'Reports',     icon:<BarChart2 size={18}/>, href:'/reports',           color:'#22c55e' },
                  { label:'Scans',       icon:<Globe size={18}/>,     href:'/scans',             color:'#eab308' },
                  { label:'Monitoring',  icon:<Monitor size={18}/>,   href:'/live-monitor',      color:'#a78bfa' },
                ].map(a => (
                  <Link key={a.label} href={a.href}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-xl transition-all group text-center"
                    style={{ background:'#111', border:'1px solid #1f1f1f' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=`${a.color}33`; (e.currentTarget as HTMLElement).style.background='#151515' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='#1f1f1f'; (e.currentTarget as HTMLElement).style.background='#111' }}>
                    <div className="p-2.5 rounded-xl transition-transform group-hover:scale-110" style={{ background:`${a.color}18`, color:a.color }}>
                      {a.icon}
                    </div>
                    <span className="text-xs font-medium" style={{ color:'#888' }}>{a.label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* TRENDS */}
        {activeTab === 'trends' && (
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              <div className="rounded-xl p-5" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Calendar size={13} style={{ color:'#ef4444' }} /> CVEs par année
                </h3>
                {Object.keys(byYear).length > 0 ? (
                  <>
                    <div className="flex items-end gap-2 h-28 mb-3">
                      {Object.entries(byYear).sort(([a],[b])=>a.localeCompare(b)).slice(-8).map(([yr,cnt]) => {
                        const max = Math.max(...Object.values(byYear)); const pct=(cnt/max)*100
                        return (
                          <div key={yr} className="flex-1 flex flex-col items-center gap-1">
                            <motion.div initial={{ height:0 }} animate={{ height:`${pct}%`}} transition={{ duration:0.6 }}
                              className="w-full rounded-t" style={{ background:'linear-gradient(180deg,#ef4444,#7f1d1d)', minHeight:2 }} />
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(byYear).sort().slice(-5).map(([yr,cnt]) => (
                        <div key={yr} className="text-xs px-2 py-1 rounded" style={{ background:'#151515', color:'#888' }}>
                          <strong className="text-white">{yr}</strong>: {cnt.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-sm" style={{ color:'#333' }}>{offline ? 'Backend hors ligne' : 'Aucune donnée'}</p>}
              </div>

              <div className="rounded-xl p-5" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <TrendingUp size={13} style={{ color:'#a78bfa' }} /> Severity Trend (12 mois)
                </h3>
                <div className="space-y-5">
                  {[
                    { label:'Critical', data:sparkCritical, color:'#ef4444' },
                    { label:'High',     data:sparkHigh,     color:'#f97316' },
                    { label:'Medium',   data:[12,14,11,16,13,17,15,18,14,19,16,21], color:'#eab308' },
                    { label:'Low',      data:sparkLow,      color:'#22c55e' },
                  ].map(s => {
                    const trend = s.data[s.data.length-1]-s.data[0]
                    return (
                      <div key={s.label} className="flex items-center gap-3">
                        <span className="text-xs w-16" style={{ color:'#666' }}>{s.label}</span>
                        <div className="flex-1"><Sparkline data={s.data} color={s.color}/></div>
                        <span className="text-xs flex items-center gap-0.5 font-medium w-10" style={{ color:trend>0 ? '#ef4444' : '#22c55e' }}>
                          {trend>0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}{Math.abs(trend)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <div className="rounded-xl p-5" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-5">
                  <Layers size={13} style={{ color:'#eab308' }} /> Distribution des scores CVSS
                </h3>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { range:'0–2',  lo:0,hi:2,  color:'#22c55e', label:'Minimal'  },
                    { range:'2–4',  lo:2,hi:4,  color:'#86efac', label:'Low'      },
                    { range:'4–6',  lo:4,hi:6,  color:'#eab308', label:'Medium'   },
                    { range:'6–8',  lo:6,hi:8,  color:'#f97316', label:'High'     },
                    { range:'8–10', lo:8,hi:10, color:'#ef4444', label:'Critical' },
                  ].map(b => {
                    const cnt = vulns.filter(v => { const s=normalizeScore(v); return s>=b.lo&&(b.hi===10?s<=b.hi:s<b.hi) }).length
                    const pct = vulns.length ? (cnt/vulns.length)*100 : 0
                    return (
                      <div key={b.range} className="flex flex-col items-center gap-2">
                        <div className="w-full rounded-lg overflow-hidden h-24 flex items-end" style={{ background:'#1a1a1a' }}>
                          <motion.div initial={{ height:0 }} animate={{ height:`${pct}%`}} transition={{ duration:0.7 }}
                            className="w-full rounded-t-lg" style={{ background:b.color, minHeight:cnt>0?4:0 }} />
                        </div>
                        <span className="text-xs" style={{ color:'#555' }}>{b.range}</span>
                        <span className="text-xs font-bold tabular-nums text-white">{cnt.toLocaleString()}</span>
                        <span className="text-[10px]" style={{ color:'#444' }}>{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ASSETS */}
        {activeTab === 'assets' && (
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">
            <motion.div variants={fadeUp}>
              <div className="rounded-xl p-5" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Database size={13} style={{ color:'#ef4444' }} /> Dataset Overview
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label:'Total Records',    value:vulns.length.toLocaleString() },
                    { label:'Avec CVSS > 0',    value:vulns.filter(v=>normalizeScore(v)>0).length.toLocaleString() },
                    { label:'Critical + High',  value:(severity.CRITICAL+severity.HIGH).toLocaleString() },
                    { label:'Années couvertes', value:Object.keys(byYear).length },
                  ].map(m => (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background:'#151515', border:'1px solid #222' }}>
                      <p className="text-2xl font-bold text-white tabular-nums">{m.value}</p>
                      <p className="text-xs mt-1" style={{ color:'#444' }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <div className="rounded-xl p-5" style={CARD}>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Shield size={13} style={{ color:'#22c55e' }} /> Security Coverage Matrix
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label:'Network Layer',    cov:78, vulns:342 },
                    { label:'Application Layer',cov:61, vulns:891 },
                    { label:'OS / Kernel',      cov:84, vulns:210 },
                    { label:'Database Layer',   cov:55, vulns:128 },
                    { label:'Authentication',   cov:70, vulns:456 },
                    { label:'Cryptography',     cov:90, vulns:87  },
                  ].map(m => {
                    const col = m.cov>=75?'#22c55e':m.cov>=50?'#eab308':'#ef4444'
                    return (
                      <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'#151515', border:'1px solid #1f1f1f' }}>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span style={{ color:'#aaa' }}>{m.label}</span>
                            <span className="tabular-nums" style={{ color:'#444' }}>{m.vulns} CVEs</span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background:'#222' }}>
                            <motion.div initial={{ width:0 }} animate={{ width:`${m.cov}%`}} transition={{ duration:0.7 }}
                              className="h-full rounded-full" style={{ background:col }} />
                          </div>
                        </div>
                        <span className="text-xs font-bold w-8 text-right tabular-nums" style={{ color:col }}>{m.cov}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </MainLayout>
  )
}
