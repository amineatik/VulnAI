'use client'

import MainLayout from '@/components/main-layout'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Download, Trash2, Plus, Shield,
  Calendar, Target, AlertTriangle, CheckCircle,
  FileDown, Loader, X
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Report {
  id: number
  name: string
  target: string
  date: string
  vulns: number
  score: number
  format: 'PDF' | 'JSON' | 'CSV'
  status: 'ready' | 'generating'
  critical: number
  high: number
  medium: number
}

const API = 'http://localhost:8000'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  return '#ef4444'
}

// ─── Real download functions ──────────────────────────────────────────────────

function downloadJSON(report: Report) {
  const payload = {
    report_id:   report.id,
    name:        report.name,
    target:      report.target,
    date:        report.date,
    score:       report.score,
    total_vulns: report.vulns,
    breakdown: {
      critical: report.critical,
      high:     report.high,
      medium:   report.medium,
      low:      report.vulns - report.critical - report.high - report.medium,
    },
    generated_at: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `${slugify(report.name)}.json`)
}

function downloadCSV(report: Report) {
  const rows = [
    ['Champ', 'Valeur'],
    ['Rapport',        report.name],
    ['Cible',          report.target],
    ['Date',           report.date],
    ['Score',          report.score],
    ['Total vulnérabilités', report.vulns],
    ['Critiques',      report.critical],
    ['High',           report.high],
    ['Medium',         report.medium],
    ['Low',            report.vulns - report.critical - report.high - report.medium],
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${slugify(report.name)}.csv`)
}

async function downloadPDF(report: Report) {
  // Dynamic import so jsPDF is only loaded on demand
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W  = 210
  const sc = scoreColor(report.score)

  // ── Background ──────────────────────────────────────────────────────────
  doc.setFillColor(7, 13, 26)
  doc.rect(0, 0, W, 297, 'F')

  // ── Header band ─────────────────────────────────────────────────────────
  doc.setFillColor(13, 24, 41)
  doc.rect(0, 0, W, 40, 'F')

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('VulnAI — Rapport de Sécurité', 15, 16)

  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.text(report.name, 15, 24)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 15, 30)

  // Score badge
  const sc_rgb = hexToRgb(sc)
  doc.setFillColor(sc_rgb.r, sc_rgb.g, sc_rgb.b)
  doc.roundedRect(W - 45, 8, 30, 18, 3, 3, 'F')
  doc.setFontSize(20)
  doc.setTextColor(7, 13, 26)
  doc.setFont('helvetica', 'bold')
  doc.text(`${report.score}`, W - 31, 20, { align: 'center' })
  doc.setFontSize(8)
  doc.text('/ 100', W - 22, 24)

  // ── Meta section ────────────────────────────────────────────────────────
  let y = 52
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(10, y - 6, W - 20, 28, 3, 3, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('CIBLE', 20, y + 2)
  doc.setTextColor(226, 232, 240)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(report.target, 20, y + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('DATE', 90, y + 2)
  doc.setTextColor(226, 232, 240)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(new Date(report.date).toLocaleDateString('fr-FR'), 90, y + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('TOTAL VULNÉRABILITÉS', 150, y + 2)
  doc.setTextColor(226, 232, 240)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(String(report.vulns), 150, y + 9)

  // ── Severity breakdown ───────────────────────────────────────────────────
  y += 38
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(226, 232, 240)
  doc.text('Répartition des vulnérabilités', 15, y)

  y += 8
  const severities = [
    { label: 'CRITICAL', count: report.critical, color: '#ef4444' },
    { label: 'HIGH',     count: report.high,     color: '#f97316' },
    { label: 'MEDIUM',   count: report.medium,   color: '#eab308' },
    { label: 'LOW',      count: report.vulns - report.critical - report.high - report.medium, color: '#22c55e' },
  ]

  const barW = (W - 30) / severities.length - 4
  severities.forEach((s, i) => {
    const x = 15 + i * (barW + 4)
    const rgb = hexToRgb(s.color)
    const pct = report.vulns > 0 ? s.count / report.vulns : 0

    // Background card
    doc.setFillColor(15, 23, 42)
    doc.roundedRect(x, y, barW, 38, 2, 2, 'F')

    // Colored top stripe
    doc.setFillColor(rgb.r, rgb.g, rgb.b)
    doc.rect(x, y, barW, 3, 'F')

    // Count
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(rgb.r, rgb.g, rgb.b)
    doc.text(String(s.count), x + barW / 2, y + 16, { align: 'center' })

    // Label
    doc.setFontSize(7)
    doc.setTextColor(71, 85, 105)
    doc.setFont('helvetica', 'bold')
    doc.text(s.label, x + barW / 2, y + 24, { align: 'center' })

    // Percentage
    doc.setFontSize(7)
    doc.setTextColor(51, 65, 85)
    doc.text(`${(pct * 100).toFixed(0)}%`, x + barW / 2, y + 32, { align: 'center' })
  })

  // ── Score bar ────────────────────────────────────────────────────────────
  y += 50
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(226, 232, 240)
  doc.text('Score de sécurité global', 15, y)

  y += 8
  doc.setFillColor(30, 41, 59)
  doc.roundedRect(15, y, W - 30, 8, 2, 2, 'F')
  const scRgb = hexToRgb(sc)
  doc.setFillColor(scRgb.r, scRgb.g, scRgb.b)
  const fillW = Math.max(4, ((W - 30) * report.score) / 100)
  doc.roundedRect(15, y, fillW, 8, 2, 2, 'F')

  doc.setFontSize(8)
  doc.setTextColor(scRgb.r, scRgb.g, scRgb.b)
  doc.text(`${report.score} / 100`, W - 15, y + 6, { align: 'right' })

  // ── Recommendations ───────────────────────────────────────────────────────
  y += 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(226, 232, 240)
  doc.text('Recommandations', 15, y)

  const recs = [
    'Patcher immédiatement les vulnérabilités critiques.',
    'Mettre en place un WAF pour bloquer les injections XSS et SQL.',
    "Activer l'authentification multi-facteurs (MFA).",
    'Auditer les permissions et accès aux ressources sensibles.',
    'Planifier des scans de sécurité automatiques hebdomadaires.',
  ]

  y += 8
  recs.forEach(rec => {
    doc.setFillColor(15, 23, 42)
    doc.roundedRect(15, y - 4, W - 30, 10, 1.5, 1.5, 'F')
    doc.setFillColor(56, 189, 248)
    doc.circle(22, y + 1, 1, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(148, 163, 184)
    doc.text(rec, 28, y + 2)
    y += 13
  })

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(13, 24, 41)
  doc.rect(0, 280, W, 17, 'F')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('VulnAI Security Platform — Rapport confidentiel', 15, 290)
  doc.text(`Page 1 / 1`, W - 15, 290, { align: 'right' })

  doc.save(`${slugify(report.name)}.pdf`)
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const color = scoreColor(score)
  const r     = 18
  const circ  = 2 * Math.PI * r
  const dash  = (score / 100) * circ
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

// ─── Download modal ───────────────────────────────────────────────────────────

function DownloadModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)
  const [done, setDone]               = useState(false)
  const [currentFmt, setCurrentFmt]   = useState('')

  const formats = [
    { id: 'PDF',  label: 'PDF',  desc: 'Rapport complet formaté',    icon: '📄' },
    { id: 'JSON', label: 'JSON', desc: 'Données brutes structurées', icon: '{ }' },
    { id: 'CSV',  label: 'CSV',  desc: 'Export tableur',             icon: '📊' },
  ]

  const handleDownload = async (fmt: string) => {
    setDownloading(true)
    setCurrentFmt(fmt)
    try {
      if (fmt === 'PDF')       await downloadPDF(report)
      else if (fmt === 'JSON') downloadJSON(report)
      else if (fmt === 'CSV')  downloadCSV(report)

      setDownloading(false)
      setDone(true)
      toast.success(`Rapport téléchargé en ${fmt}`)
      setTimeout(onClose, 1200)
    } catch (err) {
      setDownloading(false)
      toast.error('Erreur lors du téléchargement')
      console.error(err)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 10 }}
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{
          background: '#0d1829',
          border: '1px solid rgba(56,189,248,0.2)',
          boxShadow: '0 0 60px rgba(56,189,248,0.1)',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#475569' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#e2e8f0')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#475569')}
        >
          <X size={14} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
            <FileDown size={18} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Télécharger le rapport</h3>
            <p className="text-xs" style={{ color: '#475569' }}>{report.name}</p>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle size={24} style={{ color: '#22c55e' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>Téléchargement terminé</p>
          </div>
        ) : downloading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-8 h-8 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
            <p className="text-xs" style={{ color: '#475569' }}>Génération du rapport {currentFmt}…</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>
              Choisir le format
            </p>
            {formats.map(f => (
              <button key={f.id} onClick={() => handleDownload(f.id)}
                className="w-full flex items-center gap-4 p-3.5 rounded-xl text-left transition-all group"
                style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)', cursor: 'pointer' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.3)'
                  ;(e.currentTarget as HTMLElement).style.background  = 'rgba(56,189,248,0.05)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(30,41,59,0.8)'
                  ;(e.currentTarget as HTMLElement).style.background  = 'rgba(15,23,42,0.6)'
                }}
              >
                <span className="text-lg">{f.icon}</span>
                <div>
                  <p className="text-xs font-bold" style={{ color: '#e2e8f0' }}>{f.label}</p>
                  <p className="text-[10px]" style={{ color: '#475569' }}>{f.desc}</p>
                </div>
                <Download size={13} style={{ color: '#ef4444', marginLeft: 'auto' }} />
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reports, setReports]       = useState<Report[]>([])
  const [selected, setSelected]     = useState<Report | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading]       = useState(true)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/scans/all?limit=200`)
      if (!res.ok) throw new Error()
      const scans = await res.json()
      const mapped: Report[] = scans
        .filter((s: any) => s.status === 'completed')
        .map((s: any) => ({
          id:       s.id,
          name:     `Scan #${s.id} — ${new URL(s.target_url.startsWith('http') ? s.target_url : 'https://' + s.target_url).hostname}`,
          target:   s.target_url.replace(/^https?:\/\//, ''),
          date:     s.completed_at || s.created_at || new Date().toISOString(),
          vulns:    (s.critical_count || 0) + (s.high_count || 0) + (s.medium_count || 0) + (s.low_count || 0),
          score:    Math.round(s.security_score || 0),
          format:   'PDF' as const,
          status:   'ready' as const,
          critical: s.critical_count || 0,
          high:     s.high_count || 0,
          medium:   s.medium_count || 0,
        }))
      setReports(mapped)
    } catch {
      toast.error('Backend inaccessible — données indisponibles')
    }
    setLoading(false)
  }

  useEffect(() => { fetchReports() }, [])

  const handleDelete = (id: number) => {
    if (!confirm('Supprimer ce rapport ?')) return
    setReports(prev => prev.filter(r => r.id !== id))
    toast.success('Rapport supprimé')
  }

  const handleGenerate = async () => {
    setGenerating(true)
    toast.info('Récupération des derniers scans…')
    await fetchReports()
    setGenerating(false)
    toast.success('Rapports mis à jour depuis les scans réels !')
  }

  const critical  = reports.reduce((a, r) => a + r.critical, 0)
  const avgScore  = reports.length
    ? Math.round(reports.reduce((a, r) => a + r.score, 0) / reports.length)
    : 0

  return (
    <MainLayout>
      <div className="min-h-screen p-6" style={{ background: '#0a0a0a', fontFamily: "'IBM Plex Mono', monospace" }}>

        {/* Background grid */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.025]">
          <svg className="w-full h-full">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ef4444" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative space-y-5">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)' }}>
                <FileText size={20} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  Rapports de <span style={{ color: '#a78bfa' }}>Sécurité</span>
                </h1>
                <p className="text-xs" style={{ color: '#475569' }}>
                  Téléchargez vos rapports en PDF, JSON ou CSV
                </p>
              </div>
            </div>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wider transition-all"
              style={{
                background: generating ? 'rgba(30,41,59,0.5)' : 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                color: generating ? '#475569' : '#fff',
                border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
                boxShadow: generating ? 'none' : '0 0 20px rgba(167,139,250,0.2)',
              }}
            >
              {generating
                ? <><div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> GÉNÉRATION…</>
                : <><Plus size={13} /> GÉNÉRER</>}
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total rapports',          value: reports.length, color: '#a78bfa', Icon: FileText        },
              { label: 'Score moyen',              value: `${avgScore}%`, color: scoreColor(avgScore), Icon: Shield },
              { label: 'Vulnérabilités critiques', value: critical,       color: '#ef4444', Icon: AlertTriangle   },
            ].map(({ label, value, color, Icon }) => (
              <div key={label} className="rounded-xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}15` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{label}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Reports list */}
          {loading ? (
            <div className="rounded-2xl p-16 text-center"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)' }}>
              <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm" style={{ color: '#475569' }}>Chargement des rapports…</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl p-16 text-center"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)' }}>
              <FileText size={32} style={{ color: '#334155', margin: '0 auto 12px' }} />
              <p className="text-sm" style={{ color: '#475569' }}>Aucun scan complété — lancez un scan d'abord</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="grid gap-3">
              {reports.map((report, i) => (
                <motion.div key={report.id}
                  initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl p-5 flex items-center gap-5 transition-all"
                  style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(30,41,59,0.8)')}
                >
                  <ScoreRing score={report.score} size={52} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold truncate" style={{ color: '#e2e8f0' }}>{report.name}</h3>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                        style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                        {report.format}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[10px]" style={{ color: '#475569' }}>
                      <span className="flex items-center gap-1"><Target size={9} /> {report.target}</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={9} /> {new Date(report.date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {[
                        { count: report.critical, color: '#ef4444', label: 'C' },
                        { count: report.high,     color: '#f97316', label: 'H' },
                        { count: report.medium,   color: '#eab308', label: 'M' },
                      ].map(({ count, color, label }) => count > 0 && (
                        <span key={label} className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${color}15`, color }}>
                          {count}{label}
                        </span>
                      ))}
                      <span className="text-[10px]" style={{ color: '#334155' }}>
                        {report.vulns} vuln{report.vulns > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setSelected(report)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: 'rgba(167,139,250,0.1)',
                        border: '1px solid rgba(167,139,250,0.2)',
                        color: '#a78bfa', cursor: 'pointer',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background  = 'rgba(167,139,250,0.2)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 15px rgba(167,139,250,0.15)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background  = 'rgba(167,139,250,0.1)'
                        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                      }}
                    >
                      <Download size={12} /> Télécharger
                    </button>
                    <button onClick={() => handleDelete(report.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#334155' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'
                        ;(e.currentTarget as HTMLElement).style.color    = '#ef4444'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color    = '#334155'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {selected && <DownloadModal report={selected} onClose={() => setSelected(null)} />}
        </AnimatePresence>
      </div>
    </MainLayout>
  )
}