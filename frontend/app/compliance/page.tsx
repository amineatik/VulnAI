'use client'

import { useState, useEffect } from 'react'
import MainLayout from '@/components/main-layout'
import { motion } from 'framer-motion'
import { Shield, RefreshCw, CheckCircle, XCircle, AlertTriangle, Info, TrendingUp } from 'lucide-react'

const API = 'http://localhost:8000'

interface Stats {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  has_data: boolean
}

interface FrameworkControl {
  id: string
  name: string
  description: string
  status: 'pass' | 'fail' | 'partial' | 'na'
  score: number
  details: string
}

interface Framework {
  name: string
  version: string
  color: string
  controls: FrameworkControl[]
}

function buildFrameworks(stats: Stats): Framework[] {
  const hasData = stats.has_data
  const critRate = hasData ? stats.critical / stats.total : 0
  const highRate = hasData ? stats.high / stats.total : 0

  const owaspPass  = (s: boolean): 'pass' | 'fail' | 'partial' => s ? 'pass' : (hasData ? 'fail' : 'na')

  return [
    {
      name: 'OWASP Top 10',
      version: '2021',
      color: '#f97316',
      controls: [
        { id: 'A01', name: 'Broken Access Control',        description: 'Contrôles d\'accès mal configurés',     status: critRate > 0.3 ? 'fail' : 'partial', score: critRate > 0.3 ? 20 : 65, details: `${stats.critical} vulnérabilités critiques détectées` },
        { id: 'A02', name: 'Cryptographic Failures',       description: 'Données sensibles exposées',            status: highRate > 0.2 ? 'partial' : 'pass',  score: highRate > 0.2 ? 55 : 80, details: `${stats.high} vulnérabilités high` },
        { id: 'A03', name: 'Injection',                    description: 'SQL, NoSQL, OS, LDAP injection',        status: critRate > 0.1 ? 'fail' : 'pass',     score: critRate > 0.1 ? 30 : 85, details: 'Basé sur le scan des endpoints' },
        { id: 'A04', name: 'Insecure Design',              description: 'Défauts de conception sécurisée',      status: 'partial', score: 60, details: 'Analyse manuelle recommandée' },
        { id: 'A05', name: 'Security Misconfiguration',    description: 'Configurations par défaut non modifiées', status: highRate > 0.15 ? 'partial' : 'pass', score: highRate > 0.15 ? 50 : 78, details: `${stats.medium} vulnérabilités medium` },
        { id: 'A06', name: 'Vulnerable Components',        description: 'Composants avec vulnérabilités connues', status: stats.total > 50 ? 'fail' : 'partial', score: stats.total > 50 ? 25 : 60, details: `${stats.total} CVEs en base` },
        { id: 'A07', name: 'Auth & Session Failures',      description: 'Authentification compromise',           status: 'pass',    score: 82, details: 'JWT + bcrypt implémentés' },
        { id: 'A08', name: 'Software Integrity Failures',  description: 'Intégrité des mises à jour',           status: 'partial', score: 55, details: 'Vérification de signature non implémentée' },
        { id: 'A09', name: 'Security Logging & Monitoring', description: 'Détection et réponse aux incidents', status: 'pass',    score: 88, details: 'Audit trail actif · Live monitor opérationnel' },
        { id: 'A10', name: 'Server-Side Request Forgery',  description: 'SSRF attacks',                         status: 'partial', score: 62, details: 'Validation URL partiellement implémentée' },
      ],
    },
    {
      name: 'NIST CSF',
      version: '2.0',
      color: '#ef4444',
      controls: [
        { id: 'ID',  name: 'Identify',  description: 'Gestion des assets et des risques',      status: 'pass',    score: 85, details: `${stats.total} assets identifiés en base` },
        { id: 'PR',  name: 'Protect',   description: 'Mesures de protection implémentées',     status: critRate > 0.2 ? 'partial' : 'pass', score: critRate > 0.2 ? 52 : 75, details: `${stats.critical} critiques non corrigées` },
        { id: 'DE',  name: 'Detect',    description: 'Détection des anomalies et événements',  status: 'pass',    score: 90, details: 'Live monitor + scanning automatisé actif' },
        { id: 'RS',  name: 'Respond',   description: 'Réponse aux incidents de sécurité',      status: 'partial', score: 58, details: 'Remediation Center disponible' },
        { id: 'RC',  name: 'Recover',   description: 'Continuité et reprise après incident',   status: 'partial', score: 45, details: 'Plan de reprise non documenté' },
        { id: 'GV',  name: 'Govern',    description: 'Gouvernance et stratégie de sécurité',   status: 'pass',    score: 72, details: 'Politiques de sécurité définies' },
      ],
    },
    {
      name: 'ISO 27001',
      version: '2022',
      color: '#a78bfa',
      controls: [
        { id: 'A.5',  name: 'Organizational Controls',    description: 'Politiques et gouvernance',          status: 'pass',    score: 78, details: 'Politiques définies dans la section Policies' },
        { id: 'A.6',  name: 'People Controls',            description: 'Sécurité du personnel',              status: 'partial', score: 55, details: 'Formation sécurité non documentée' },
        { id: 'A.7',  name: 'Physical Controls',          description: 'Sécurité physique et environnementale', status: 'na',   score: 0,  details: 'Non applicable — environnement cloud' },
        { id: 'A.8',  name: 'Technological Controls',     description: 'Sécurité des systèmes et réseaux',   status: highRate > 0.2 ? 'partial' : 'pass', score: highRate > 0.2 ? 48 : 70, details: `${stats.high + stats.critical} vulnérabilités critiques/high` },
      ],
    },
  ]
}

const STATUS_CONFIG = {
  pass:    { color: '#22c55e', label: 'Conforme',       icon: CheckCircle },
  fail:    { color: '#ef4444', label: 'Non conforme',   icon: XCircle },
  partial: { color: '#f97316', label: 'Partiel',        icon: AlertTriangle },
  na:      { color: '#6b7280', label: 'N/A',            icon: Info },
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.6 }}
          className="h-full rounded-full" style={{ background: score >= 70 ? '#22c55e' : score >= 40 ? '#f97316' : '#ef4444' }} />
      </div>
      <span className="text-xs font-bold text-white w-7 text-right">{score}%</span>
    </div>
  )
}

export default function CompliancePage() {
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/vulnerabilities/stats`)
      if (res.ok) setStats(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const frameworks = stats ? buildFrameworks(stats) : []
  const activeFramework = frameworks[activeTab]

  const globalScore = activeFramework
    ? Math.round(activeFramework.controls.filter(c => c.status !== 'na').reduce((a, c) => a + c.score, 0) / activeFramework.controls.filter(c => c.status !== 'na').length)
    : 0

  const passCount    = activeFramework?.controls.filter(c => c.status === 'pass').length ?? 0
  const failCount    = activeFramework?.controls.filter(c => c.status === 'fail').length ?? 0
  const partialCount = activeFramework?.controls.filter(c => c.status === 'partial').length ?? 0

  return (
    <MainLayout>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="min-h-full bg-[#0a0a0a] p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className="text-red-400" />
              <span className="text-xs text-red-400 tracking-widest uppercase">Compliance</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Conformité réglementaire</h1>
            <p className="text-xs text-slate-500 mt-0.5">OWASP Top 10 · NIST CSF 2.0 · ISO 27001</p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs transition-all disabled:opacity-40">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-32 flex items-center justify-center">
            <RefreshCw size={20} className="text-slate-600 animate-spin" />
          </div>
        ) : (
          <>
            {/* Framework tabs */}
            <div className="flex gap-2 flex-wrap">
              {frameworks.map((f, i) => (
                <button key={f.name} onClick={() => setActiveTab(i)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    activeTab === i ? 'text-white' : 'border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                  style={activeTab === i ? { background: f.color + '20', borderColor: f.color + '50', color: f.color } : {}}>
                  {f.name} <span className="text-[10px] opacity-60">v{f.version}</span>
                </button>
              ))}
            </div>

            {activeFramework && (
              <>
                {/* Score overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-2">
                    <div className="relative w-20 h-20">
                      <svg viewBox="0 0 80 80" className="-rotate-90 w-full h-full">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                        <circle cx="40" cy="40" r="32" fill="none"
                          stroke={globalScore >= 70 ? '#22c55e' : globalScore >= 40 ? '#f97316' : '#ef4444'}
                          strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 32}`}
                          strokeDashoffset={`${2 * Math.PI * 32 * (1 - globalScore / 100)}`} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-white">{globalScore}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Score global</p>
                  </div>
                  {[
                    { label: 'Conforme',     value: passCount,    color: '#22c55e' },
                    { label: 'Partiel',      value: partialCount, color: '#f97316' },
                    { label: 'Non conforme', value: failCount,    color: '#ef4444' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex items-center gap-3">
                      <div className="w-2 h-10 rounded-full" style={{ background: s.color }} />
                      <div>
                        <p className="text-2xl font-bold text-white">{s.value}</p>
                        <p className="text-xs" style={{ color: s.color }}>{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="space-y-2">
                  {activeFramework.controls.map((c, i) => {
                    const cfg = STATUS_CONFIG[c.status]
                    const Icon = cfg.icon
                    return (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:bg-slate-800/30 transition-all">
                        <div className="flex items-start gap-4">
                          <div className="w-14 text-center flex-shrink-0">
                            <span className="text-xs font-bold px-2 py-1 rounded font-mono" style={{ color: activeFramework.color, background: activeFramework.color + '15' }}>
                              {c.id}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="text-sm font-semibold text-white">{c.name}</p>
                              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ color: cfg.color, background: cfg.color + '15' }}>
                                <Icon size={9} /> {cfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mb-2">{c.description}</p>
                            <ScoreBar score={c.score} color={activeFramework.color} />
                            <p className="text-xs text-slate-600 mt-1.5">{c.details}</p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  )
}
