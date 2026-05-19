'use client'

import { useState, useEffect, useCallback } from 'react'
import MainLayout from '@/components/main-layout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, AlertTriangle, Shield, Loader2,
  RefreshCw, ChevronDown, X, Eye, Crosshair
} from 'lucide-react'
import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Vulnerability {
  id: number
  cve_id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  cvss_score: string | number
  remediation?: string
  status?: string
  created_at?: string
}

interface Stats {
  total: number; critical: number; high: number; medium: number; low: number; has_data: boolean
}

const SEV = {
  critical: { label:'CRITICAL', color:'#ef4444', bg:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.2)', badgeBg:'rgba(239,68,68,0.15)', barColor:'#ef4444' },
  high:     { label:'HIGH',     color:'#f97316', bg:'rgba(249,115,22,0.06)', border:'rgba(249,115,22,0.15)', badgeBg:'rgba(249,115,22,0.12)', barColor:'#f97316' },
  medium:   { label:'MEDIUM',   color:'#eab308', bg:'rgba(234,179,8,0.06)', border:'rgba(234,179,8,0.15)', badgeBg:'rgba(234,179,8,0.12)', barColor:'#eab308' },
  low:      { label:'LOW',      color:'#22c55e', bg:'rgba(34,197,94,0.05)', border:'rgba(34,197,94,0.15)', badgeBg:'rgba(34,197,94,0.12)', barColor:'#22c55e' },
}
const getSev = (s?: string) => SEV[(s?.toLowerCase() as keyof typeof SEV) ?? 'low'] ?? SEV.low

function VulnModal({ vuln, onClose }: { vuln: Vulnerability; onClose: () => void }) {
  const cfg   = getSev(vuln.severity)
  const score = parseFloat(String(vuln.cvss_score)) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background:'#111', border:`1px solid ${cfg.border}` }}>

        <div className="p-5 flex items-start justify-between gap-4" style={{ borderBottom:`1px solid ${cfg.border}` }}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background:cfg.badgeBg, color:cfg.color }}>{cfg.label}</span>
              {vuln.cve_id && (
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color:'#ef4444', background:'rgba(239,68,68,0.08)' }}>{vuln.cve_id}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">{vuln.title}</h2>
          </div>
          <button onClick={onClose} className="transition-colors mt-1" style={{ color:'#555' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#fff'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#555'}>
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {score > 0 && (
            <div>
              <p className="text-xs mb-1 uppercase tracking-wide" style={{ color:'#555' }}>Score CVSS</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold" style={{ color:cfg.color }}>{score.toFixed(1)}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background:'#1a1a1a' }}>
                  <div className="h-full transition-all rounded-full" style={{ width:`${(score/10)*100}%`, background:cfg.barColor }} />
                </div>
                <span className="text-xs" style={{ color:'#444' }}>/10</span>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs mb-1 uppercase tracking-wide" style={{ color:'#555' }}>Description</p>
            <p className="text-sm leading-relaxed" style={{ color:'#aaa' }}>{vuln.description || 'Aucune description disponible.'}</p>
          </div>
          {vuln.remediation && (
            <div className="p-3 rounded-lg" style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)' }}>
              <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color:'#22c55e' }}>🔧 Remédiation recommandée</p>
              <p className="text-sm" style={{ color:'#aaa' }}>{vuln.remediation}</p>
            </div>
          )}
          {vuln.status && (
            <div>
              <p className="text-xs mb-1 uppercase tracking-wide" style={{ color:'#555' }}>Statut</p>
              <span className="text-xs px-2 py-1 rounded font-medium"
                style={{
                  background: vuln.status==='fixed' ? 'rgba(34,197,94,0.12)' : vuln.status==='ignored' ? '#1a1a1a' : 'rgba(239,68,68,0.12)',
                  color: vuln.status==='fixed' ? '#22c55e' : vuln.status==='ignored' ? '#555' : '#ef4444',
                }}>
                {vuln.status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function VulnerabilitiesPage() {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([])
  const [filteredVulns, setFilteredVulns]     = useState<Vulnerability[]>([])
  const [searchTerm, setSearchTerm]           = useState('')
  const [stats, setStats]   = useState<Stats>({ total:0, critical:0, high:0, medium:0, low:0, has_data:false })
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string|null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<string|null>(null)
  const [selectedVuln, setSelectedVuln]     = useState<Vulnerability|null>(null)
  const [page, setPage]     = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 50

  const loadData = useCallback(async (reset=true) => {
    if(reset) { setLoading(true); setError(null); setPage(0) }
    try {
      const skip = reset ? 0 : page * LIMIT
      const [vulnsRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/vulnerabilities/`, { params:{ skip, limit:LIMIT } }),
        axios.get(`${API_BASE}/vulnerabilities/stats`),
      ])
      const vulnsData: Vulnerability[] = vulnsRes.data?.results ?? vulnsRes.data ?? []
      const statsData: Stats = statsRes.data ?? {}
      setVulnerabilities(reset ? vulnsData : prev => [...prev,...vulnsData])
      setStats(statsData)
      setHasMore(vulnsData.length === LIMIT)
      if(!reset) setPage(p => p+1)
    } catch(err: any) {
      const msg = err.response?.data?.detail || err.message || 'Erreur inconnue'
      setError(`Impossible de joindre le backend : ${msg}`)
    } finally { setLoading(false) }
  }, [page])

  useEffect(() => { loadData(true) }, [])

  useEffect(() => {
    let list = [...vulnerabilities]
    if(selectedSeverity) list = list.filter(v => v.severity?.toLowerCase()===selectedSeverity)
    if(searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(v => v.title?.toLowerCase().includes(q) || v.cve_id?.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q))
    }
    setFilteredVulns(list)
  }, [searchTerm, vulnerabilities, selectedSeverity])

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96" style={{ background:'#0a0a0a' }}>
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor:'rgba(239,68,68,0.2)' }} />
              <div className="absolute inset-1 rounded-full border-2 animate-spin" style={{ borderColor:'rgba(239,68,68,0.5)', borderTopColor:'transparent' }} />
              <Crosshair className="absolute inset-0 m-auto" size={16} style={{ color:'#ef4444' }} />
            </div>
            <p className="font-medium" style={{ color:'#555' }}>Chargement de la base CVE...</p>
            <p className="text-sm mt-1" style={{ color:'#333' }}>Connexion à {API_BASE}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  const CARD = { background:'#111', border:'1px solid #1f1f1f' }

  return (
    <MainLayout>
      <div className="p-6 space-y-6 min-h-screen" style={{ background:'#0a0a0a', fontFamily:"'IBM Plex Mono', monospace" }}>
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>

          {/* Header */}
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#ef4444' }} />
                <span className="text-xs tracking-widest uppercase" style={{ color:'rgba(239,68,68,0.7)' }}>CVE Database</span>
              </div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Crosshair size={22} style={{ color:'#ef4444' }} />
                Vulnerability <span style={{ color:'#ef4444' }}>Database</span>
              </h2>
              <p className="mt-1 text-sm" style={{ color:'#444' }}>
                {stats.has_data ? `${stats.total.toLocaleString()} vulnérabilités CVE indexées` : 'Base CVE — aucune donnée importée'}
              </p>
            </div>
            <button onClick={() => loadData(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
              style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.14)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.08)'}>
              <RefreshCw className="w-4 h-4"/> Actualiser
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {/* Total */}
            <div className="rounded-xl p-4 text-center transition-all" style={CARD}>
              <div className="text-2xl mb-1">📊</div>
              <div className="text-2xl font-bold text-white">{stats.total || vulnerabilities.length}</div>
              <div className="text-xs mt-0.5" style={{ color:'#444' }}>Total CVEs</div>
            </div>
            {(['critical','high','medium','low'] as const).map(sev => {
              const cfg   = SEV[sev]
              const count = stats[sev]
              const active = selectedSeverity === sev
              return (
                <button key={sev} onClick={() => setSelectedSeverity(active ? null : sev)}
                  className="rounded-xl p-4 text-center transition-all hover:scale-105"
                  style={{ background: active ? cfg.bg : '#111', border: active ? `1px solid ${cfg.border}` : '1px solid #1f1f1f',
                    outline: active ? `2px solid ${cfg.color}33` : 'none' }}>
                  <div className="text-2xl font-bold" style={{ color:cfg.color }}>{count}</div>
                  <div className="text-xs mt-0.5 font-semibold" style={{ color:cfg.color }}>{cfg.label}</div>
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-4 h-4" style={{ color:'#444' }} />
            <input
              placeholder="Rechercher par CVE-ID, titre ou description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-32 py-2.5 rounded-lg text-sm transition-all focus:outline-none"
              style={{ background:'#111', border:'1px solid #222', color:'#e2e8f0' }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor='rgba(239,68,68,0.4)'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor='#222'}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 transition-colors" style={{ color:'#444' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#fff'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#444'}>
                <X className="w-4 h-4"/>
              </button>
            )}
            {selectedSeverity && (
              <button onClick={() => setSelectedSeverity(null)}
                className="absolute right-8 top-2 text-xs px-2 py-1 rounded flex items-center gap-1"
                style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                {selectedSeverity.toUpperCase()} <X className="w-3 h-3"/>
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl p-4 mb-4" style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2 mb-1" style={{ color:'#ef4444' }}>
                <AlertTriangle className="w-4 h-4"/>
                <span className="font-semibold text-sm">Erreur de connexion backend</span>
              </div>
              <p className="text-sm" style={{ color:'#888' }}>{error}</p>
              <p className="text-xs mt-1" style={{ color:'#555' }}>
                Vérifiez que FastAPI tourne sur <code style={{ color:'#ef4444' }}>{API_BASE}</code>
              </p>
              <button onClick={() => loadData(true)} className="mt-3 px-4 py-1.5 rounded-lg text-sm"
                style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>
                Réessayer
              </button>
            </div>
          )}

          {/* Count */}
          <div className="text-xs mb-3" style={{ color:'#444' }}>
            {filteredVulns.length} résultat{filteredVulns.length!==1?'s':''}
            {selectedSeverity && ` · filtre : ${selectedSeverity.toUpperCase()}`}
            {searchTerm && ` · recherche : "${searchTerm}"`}
          </div>

          {/* Results */}
          {filteredVulns.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={CARD}>
              <Crosshair className="mx-auto mb-4" size={48} style={{ color:'#222' }} />
              <h3 className="text-lg font-semibold text-white mb-2">Aucune vulnérabilité trouvée</h3>
              <p className="text-sm" style={{ color:'#444' }}>
                {searchTerm ? `Aucun résultat pour "${searchTerm}"` : !stats.has_data ? 'Importez des données CVE depuis le backend' : 'Aucune correspondance avec les filtres actifs'}
              </p>
              {!stats.has_data && (
                <div className="mt-4 p-3 rounded-lg inline-block text-left" style={{ background:'#151515', border:'1px solid #222' }}>
                  <p className="text-xs mb-1" style={{ color:'#555' }}>Commande pour importer des CVE :</p>
                  <code className="text-xs" style={{ color:'#22c55e' }}>cd backend && python import_cve_data.py</code>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredVulns.map((vuln, i) => {
                    const cfg   = getSev(vuln.severity)
                    const score = parseFloat(String(vuln.cvss_score)) || 0
                    return (
                      <motion.div key={vuln.id}
                        initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, scale:0.95 }}
                        transition={{ delay:Math.min(i*0.02,0.3) }}
                        onClick={() => setSelectedVuln(vuln)}
                        className="rounded-xl p-5 cursor-pointer group"
                        style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, transition:'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=cfg.color+'55'; (e.currentTarget as HTMLElement).style.background=cfg.bg.replace('0.08','0.12').replace('0.06','0.1').replace('0.05','0.09') }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor=cfg.border; (e.currentTarget as HTMLElement).style.background=cfg.bg }}>

                        {/* Card header */}
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {vuln.cve_id && (
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color:'#ef4444', background:'rgba(239,68,68,0.08)' }}>
                                  {vuln.cve_id}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">
                              {vuln.title || vuln.cve_id}
                            </h3>
                          </div>
                          <span className="px-2 py-0.5 rounded text-xs font-bold shrink-0" style={{ background:cfg.badgeBg, color:cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>

                        {/* CVSS */}
                        {score > 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs" style={{ color:'#555' }}>CVSS</span>
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background:'rgba(0,0,0,0.3)' }}>
                              <div className="h-full rounded-full" style={{ width:`${(score/10)*100}%`, background:cfg.barColor }} />
                            </div>
                            <span className="text-xs font-bold" style={{ color:cfg.color }}>{score.toFixed(1)}</span>
                          </div>
                        )}

                        <p className="text-xs line-clamp-2 mb-3 leading-relaxed" style={{ color:'#666' }}>
                          {vuln.description || 'Aucune description disponible.'}
                        </p>

                        <div className="flex items-center justify-between">
                          {vuln.remediation ? (
                            <span className="text-xs" style={{ color:'#22c55e' }}>🔧 Remédiation disponible</span>
                          ) : <span/>}
                          <span className="text-xs flex items-center gap-1 transition-colors" style={{ color:'#444' }}>
                            <Eye className="w-3 h-3"/> Voir détails
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              {hasMore && (
                <div className="text-center mt-6">
                  <button onClick={() => loadData(false)}
                    className="flex items-center gap-2 mx-auto px-6 py-2 rounded-lg text-sm transition-all"
                    style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.18)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.1)'}>
                    <ChevronDown className="w-4 h-4"/> Charger plus de vulnérabilités
                  </button>
                </div>
              )}

              <p className="text-center text-xs mt-4" style={{ color:'#333' }}>
                {filteredVulns.length} / {vulnerabilities.length} vulnérabilités affichées
              </p>
            </>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedVuln && <VulnModal vuln={selectedVuln} onClose={() => setSelectedVuln(null)}/>}
      </AnimatePresence>
    </MainLayout>
  )
}
