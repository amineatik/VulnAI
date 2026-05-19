'use client'

import MainLayout from '@/components/main-layout'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Plus, Trash2, Edit2, CheckCircle, XCircle,
  RefreshCw, X, Save, Zap, Link2, AlertCircle,
  Webhook, Database, Mail, MessageSquare, GitBranch, Key
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Integration {
  id: number
  name: string
  type: 'webhook' | 'slack' | 'email' | 'github' | 'jira' | 'siem' | 'api'
  url: string
  status: 'connected' | 'error' | 'pending'
  lastSync: string
  events: string[]
  enabled: boolean
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_INTEGRATIONS: Integration[] = [
  { id: 1, name: 'Slack — Security Alerts',  type: 'slack',   url: 'https://hooks.slack.com/services/xxx',          status: 'connected', lastSync: '2024-05-14T10:30:00', events: ['critical', 'high'],       enabled: true  },
  { id: 2, name: 'GitHub — VulnAI Repo',     type: 'github',  url: 'https://api.github.com/repos/org/vulnai',       status: 'connected', lastSync: '2024-05-13T18:00:00', events: ['scan_complete'],          enabled: true  },
  { id: 3, name: 'SIEM — Splunk Enterprise', type: 'siem',    url: 'https://splunk.company.io:8088/collector',      status: 'error',     lastSync: '2024-05-10T08:00:00', events: ['all'],                    enabled: true  },
  { id: 4, name: 'Webhook — CI/CD Pipeline', type: 'webhook', url: 'https://jenkins.company.io/webhook/vulnai',     status: 'connected', lastSync: '2024-05-14T09:15:00', events: ['scan_complete', 'report'], enabled: true  },
  { id: 5, name: 'Email — Équipe Sécurité',  type: 'email',   url: 'security-team@company.io',                      status: 'pending',   lastSync: '',                    events: ['critical'],               enabled: false },
  { id: 6, name: 'Jira — Tickets sécurité',  type: 'jira',    url: 'https://company.atlassian.net/rest/api/3',      status: 'connected', lastSync: '2024-05-12T14:00:00', events: ['high', 'critical'],       enabled: true  },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  slack:   '#4A154B', github: '#333', email: '#ef4444',
  webhook: '#a78bfa', siem:   '#f97316', jira: '#0052CC', api: '#22c55e',
}
const TYPE_BG: Record<string, string> = {
  slack:   'rgba(74,21,75,0.3)', github: 'rgba(51,51,51,0.3)', email: 'rgba(56,189,248,0.15)',
  webhook: 'rgba(167,139,250,0.15)', siem: 'rgba(249,115,22,0.15)',
  jira:    'rgba(0,82,204,0.2)', api: 'rgba(34,197,94,0.15)',
}
const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e', error: '#ef4444', pending: '#eab308',
}
const STATUS_LABEL: Record<string, string> = {
  connected: 'Connecté', error: 'Erreur', pending: 'En attente',
}

function TypeIcon({ type, size = 16 }: { type: string; size?: number }) {
  const color = TYPE_COLOR[type] || '#6b7280'
  const props = { size, style: { color } }
  if (type === 'slack')   return <MessageSquare {...props} />
  if (type === 'github')  return <GitBranch    {...props} />
  if (type === 'email')   return <Mail    {...props} />
  if (type === 'webhook') return <Webhook {...props} />
  if (type === 'siem')    return <Database {...props} />
  if (type === 'api')     return <Key     {...props} />
  return <Link2 {...props} />
}

// ─── Add modal ────────────────────────────────────────────────────────────────

function IntegrationModal({
  integration,
  onSave,
  onClose,
}: {
  integration?: Integration | null
  onSave: (data: Omit<Integration, 'id' | 'lastSync' | 'status'>) => void
  onClose: () => void
}) {
  const [name, setName]   = useState(integration?.name ?? '')
  const [type, setType]   = useState<Integration['type']>(integration?.type ?? 'webhook')
  const [url, setUrl]     = useState(integration?.url ?? '')
  const [enabled, setEnabled] = useState(integration?.enabled ?? true)

  const types: Integration['type'][] = ['webhook', 'slack', 'email', 'github', 'jira', 'siem', 'api']
  const typeLabels: Record<string, string> = {
    webhook: 'Webhook', slack: 'Slack', email: 'Email',
    github: 'GitHub', jira: 'Jira', siem: 'SIEM', api: 'API',
  }

  const handleSave = () => {
    if (!name.trim() || !url.trim()) { toast.error('Nom et URL requis'); return }
    onSave({ name, type, url, events: ['critical', 'high'], enabled })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
        className="relative w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: '#0d1829', border: '1px solid rgba(56,189,248,0.2)', fontFamily: "'IBM Plex Mono', monospace" }}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#475569' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#e2e8f0')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#475569')}
        ><X size={14} /></button>

        <div className="flex items-center gap-2">
          <Link2 size={16} style={{ color: '#ef4444' }} />
          <h3 className="text-sm font-bold text-white">
            {integration ? 'Modifier l\'intégration' : 'Nouvelle intégration'}
          </h3>
        </div>

        {/* Type selector */}
        <div>
          <label className="text-[10px] uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>
            Type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {types.map(t => (
              <button key={t} onClick={() => setType(t)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
                style={{
                  background: type === t ? TYPE_BG[t] : 'rgba(15,23,42,0.6)',
                  border: `1px solid ${type === t ? TYPE_COLOR[t] + '50' : 'rgba(30,41,59,0.8)'}`,
                  color: type === t ? TYPE_COLOR[t] : '#475569',
                }}
              >
                <TypeIcon type={t} size={11} />
                {typeLabels[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: '#475569' }}>Nom *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom de l'intégration"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)', color: '#e2e8f0', fontFamily: 'inherit' }}
          />
        </div>

        {/* URL */}
        <div>
          <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: '#475569' }}>
            {type === 'email' ? 'Adresse email *' : 'URL / Endpoint *'}
          </label>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder={type === 'email' ? 'team@company.io' : 'https://...'}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)', color: '#e2e8f0', fontFamily: 'inherit' }}
          />
        </div>

        <button onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#ef4444)', color: '#07111a', border: 'none', cursor: 'pointer' }}
        >
          <Save size={13} /> Sauvegarder
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS)
  const [modal, setModal]               = useState(false)
  const [editing, setEditing]           = useState<Integration | null>(null)
  const [testing, setTesting]           = useState<number | null>(null)

  const connected = integrations.filter(i => i.status === 'connected').length
  const errors    = integrations.filter(i => i.status === 'error').length
  const enabled   = integrations.filter(i => i.enabled).length

  const handleSave = (data: Omit<Integration, 'id' | 'lastSync' | 'status'>) => {
    if (editing) {
      setIntegrations(prev => prev.map(i =>
        i.id === editing.id ? { ...i, ...data, lastSync: new Date().toISOString() } : i
      ))
      toast.success('Intégration mise à jour')
    } else {
      setIntegrations(prev => [{
        ...data, id: Date.now(),
        status: 'pending' as const,
        lastSync: '',
      }, ...prev])
      toast.success('Intégration ajoutée')
    }
    setModal(false)
    setEditing(null)
  }

  const handleDelete = (id: number) => {
    if (!confirm('Supprimer cette intégration ?')) return
    setIntegrations(prev => prev.filter(i => i.id !== id))
    toast.success('Intégration supprimée')
  }

  const handleTest = async (id: number) => {
    setTesting(id)
    await new Promise(r => setTimeout(r, 1500))
    setTesting(null)
    const success = Math.random() > 0.3
    if (success) {
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: 'connected', lastSync: new Date().toISOString() } : i))
      toast.success('Connexion réussie !')
    } else {
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: 'error' } : i))
      toast.error('Échec de la connexion')
    }
  }

  const toggleEnabled = (id: number) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i))
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-6" style={{ background: '#0a0a0a', fontFamily: "'IBM Plex Mono', monospace" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)' }}>
              <Globe size={20} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                <span style={{ color: '#ef4444' }}>Intégrations</span>
              </h1>
              <p className="text-xs" style={{ color: '#475569' }}>
                Connectez VulnAI à vos outils
              </p>
            </div>
          </div>
          <button onClick={() => { setEditing(null); setModal(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg,#0ea5e9,#ef4444)',
              color: '#07111a', border: 'none', cursor: 'pointer',
              boxShadow: '0 0 20px rgba(56,189,248,0.2)',
            }}
          >
            <Plus size={13} /> CONNECTER
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Connectées',   value: connected, color: '#22c55e', Icon: CheckCircle   },
            { label: 'Erreurs',      value: errors,    color: '#ef4444', Icon: AlertCircle   },
            { label: 'Actives',      value: enabled,   color: '#ef4444', Icon: Zap           },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px]" style={{ color: '#475569' }}>{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Integration cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {integrations.map((intg, i) => (
            <motion.div key={intg.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-5 transition-all"
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: `1px solid ${intg.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(30,41,59,0.8)'}`,
                opacity: intg.enabled ? 1 : 0.55,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = TYPE_COLOR[intg.type] + '30')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = intg.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(30,41,59,0.8)')}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: TYPE_BG[intg.type] }}>
                    <TypeIcon type={intg.type} size={17} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white truncate max-w-[160px]">{intg.name}</p>
                    <p className="text-[10px] truncate max-w-[160px]" style={{ color: '#475569' }}>{intg.url}</p>
                  </div>
                </div>
                {/* Status badge */}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 flex-shrink-0"
                  style={{ background: `${STATUS_COLOR[intg.status]}15`, color: STATUS_COLOR[intg.status] }}>
                  <span className="w-1.5 h-1.5 rounded-full"
                    style={{ background: STATUS_COLOR[intg.status], display: 'inline-block',
                             animation: intg.status === 'connected' ? 'pulse 2s infinite' : 'none' }} />
                  {STATUS_LABEL[intg.status]}
                </span>
              </div>

              {/* Events */}
              <div className="flex flex-wrap gap-1 mb-3">
                {intg.events.map(ev => (
                  <span key={ev} className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase"
                    style={{ background: 'rgba(56,189,248,0.08)', color: '#ef4444', border: '1px solid rgba(56,189,248,0.15)' }}>
                    {ev}
                  </span>
                ))}
              </div>

              {/* Last sync */}
              {intg.lastSync && (
                <p className="text-[10px] mb-3" style={{ color: '#334155' }}>
                  Dernier sync : {new Date(intg.lastSync).toLocaleString('fr-FR', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit' })}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'rgba(30,41,59,0.6)' }}>
                <button onClick={() => handleTest(intg.id)} disabled={testing === intg.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all flex-1 justify-center"
                  style={{
                    background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
                    color: '#ef4444', cursor: testing === intg.id ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.15)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.08)')}
                >
                  {testing === intg.id
                    ? <><div className="w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" /> Test…</>
                    : <><RefreshCw size={10} /> Tester</>}
                </button>
                <button onClick={() => toggleEnabled(intg.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'transparent', color: intg.enabled ? '#22c55e' : '#475569', border: 'none', cursor: 'pointer' }}
                  title={intg.enabled ? 'Désactiver' : 'Activer'}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.1)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  {intg.enabled ? <CheckCircle size={14} /> : <XCircle size={14} />}
                </button>
                <button onClick={() => { setEditing(intg); setModal(true) }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'transparent', color: '#334155', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.1)'; (e.currentTarget as HTMLElement).style.color = '#a78bfa' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#334155' }}
                >
                  <Edit2 size={13} />
                </button>
                <button onClick={() => handleDelete(intg.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'transparent', color: '#334155', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#334155' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <IntegrationModal
            integration={editing}
            onSave={handleSave}
            onClose={() => { setModal(false); setEditing(null) }}
          />
        )}
      </AnimatePresence>
    </MainLayout>
  )
}