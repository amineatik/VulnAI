'use client'

import MainLayout from '@/components/main-layout'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Plus, Trash2, Edit2, CheckCircle, XCircle,
  Shield, AlertTriangle, Clock, ToggleLeft, ToggleRight,
  X, Save, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Policy {
  id: number
  name: string
  description: string
  category: 'network' | 'authentication' | 'data' | 'compliance' | 'incident'
  severity: 'critical' | 'high' | 'medium' | 'low'
  enabled: boolean
  lastUpdated: string
  rules: number
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const INITIAL_POLICIES: Policy[] = [
  { id: 1, name: 'Zero Trust Network',        description: 'Aucune connexion non vérifiée autorisée depuis l\'extérieur du périmètre.',            category: 'network',        severity: 'critical', enabled: true,  lastUpdated: '2024-05-10', rules: 12 },
  { id: 2, name: 'MFA Obligatoire',            description: 'Authentification multi-facteurs requise pour tous les accès privilégiés.',              category: 'authentication', severity: 'critical', enabled: true,  lastUpdated: '2024-05-08', rules: 5  },
  { id: 3, name: 'Chiffrement des données',   description: 'Toutes les données sensibles doivent être chiffrées au repos et en transit (AES-256).',  category: 'data',           severity: 'high',     enabled: true,  lastUpdated: '2024-04-30', rules: 8  },
  { id: 4, name: 'Conformité RGPD',           description: 'Gestion et protection des données personnelles conformément au règlement européen.',      category: 'compliance',     severity: 'high',     enabled: true,  lastUpdated: '2024-04-22', rules: 20 },
  { id: 5, name: 'Plan de réponse aux incidents',description: 'Procédures de détection, confinement et récupération après incident.',               category: 'incident',       severity: 'medium',   enabled: false, lastUpdated: '2024-04-15', rules: 9  },
  { id: 6, name: 'Rotation des secrets',      description: 'Rotation automatique des clés API, mots de passe et certificats tous les 90 jours.',     category: 'authentication', severity: 'medium',   enabled: true,  lastUpdated: '2024-04-10', rules: 4  },
]

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  network:        '#ef4444',
  authentication: '#a78bfa',
  data:           '#22c55e',
  compliance:     '#eab308',
  incident:       '#f97316',
}
const CAT_LABEL: Record<string, string> = {
  network:        'Réseau',
  authentication: 'Auth',
  data:           'Données',
  compliance:     'Conformité',
  incident:       'Incident',
}
const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
}

// ─── Create/edit modal ────────────────────────────────────────────────────────

function PolicyModal({
  policy,
  onSave,
  onClose,
}: {
  policy?: Policy | null
  onSave: (p: Omit<Policy, 'id' | 'lastUpdated' | 'rules'>) => void
  onClose: () => void
}) {
  const [name, setName]         = useState(policy?.name ?? '')
  const [desc, setDesc]         = useState(policy?.description ?? '')
  const [cat, setCat]           = useState<Policy['category']>(policy?.category ?? 'network')
  const [sev, setSev]           = useState<Policy['severity']>(policy?.severity ?? 'medium')
  const [enabled, setEnabled]   = useState(policy?.enabled ?? true)

  const categories: Policy['category'][] = ['network', 'authentication', 'data', 'compliance', 'incident']
  const severities:  Policy['severity'][] = ['critical', 'high', 'medium', 'low']

  const handleSave = () => {
    if (!name.trim()) { toast.error('Le nom est requis'); return }
    onSave({ name, description: desc, category: cat, severity: sev, enabled })
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
        style={{ background: '#0d1829', border: '1px solid rgba(167,139,250,0.2)', fontFamily: "'IBM Plex Mono', monospace" }}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#475569' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#e2e8f0')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#475569')}
        ><X size={14} /></button>

        <h3 className="text-sm font-bold text-white">
          {policy ? 'Modifier la politique' : 'Nouvelle politique'}
        </h3>

        {/* Name */}
        <div>
          <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: '#475569' }}>
            Nom *
          </label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Nom de la politique"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)', color: '#e2e8f0', fontFamily: 'inherit' }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: '#475569' }}>
            Description
          </label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            rows={3} placeholder="Décrivez la politique…"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)', color: '#e2e8f0', fontFamily: 'inherit' }}
          />
        </div>

        {/* Category + Severity */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: '#475569' }}>
              Catégorie
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
                  style={{
                    background: cat === c ? `${CAT_COLOR[c]}20` : 'rgba(15,23,42,0.6)',
                    border: `1px solid ${cat === c ? CAT_COLOR[c] + '40' : 'rgba(30,41,59,0.8)'}`,
                    color: cat === c ? CAT_COLOR[c] : '#475569',
                  }}
                >{CAT_LABEL[c]}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: '#475569' }}>
              Sévérité
            </label>
            <div className="flex flex-wrap gap-1.5">
              {severities.map(s => (
                <button key={s} onClick={() => setSev(s)}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all capitalize"
                  style={{
                    background: sev === s ? `${SEV_COLOR[s]}20` : 'rgba(15,23,42,0.6)',
                    border: `1px solid ${sev === s ? SEV_COLOR[s] + '40' : 'rgba(30,41,59,0.8)'}`,
                    color: sev === s ? SEV_COLOR[s] : '#475569',
                  }}
                >{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.8)' }}>
          <span className="text-xs text-slate-300">Activer immédiatement</span>
          <button onClick={() => setEnabled(!enabled)}>
            {enabled
              ? <ToggleRight size={24} style={{ color: '#22c55e' }} />
              : <ToggleLeft  size={24} style={{ color: '#475569' }} />}
          </button>
        </div>

        {/* Save */}
        <button onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          <Save size={13} /> Sauvegarder
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [policies, setPolicies]   = useState<Policy[]>(INITIAL_POLICIES)
  const [modal, setModal]         = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing]     = useState<Policy | null>(null)
  const [catFilter, setCatFilter] = useState('ALL')

  const categories = ['ALL', 'network', 'authentication', 'data', 'compliance', 'incident']

  const filtered = catFilter === 'ALL'
    ? policies
    : policies.filter(p => p.category === catFilter)

  const enabled  = policies.filter(p => p.enabled).length
  const disabled = policies.length - enabled
  const critical = policies.filter(p => p.severity === 'critical').length

  const togglePolicy = (id: number) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
    const p = policies.find(p => p.id === id)
    toast.success(`Politique ${p?.enabled ? 'désactivée' : 'activée'}`)
  }

  const deletePolicy = (id: number) => {
    if (!confirm('Supprimer cette politique ?')) return
    setPolicies(prev => prev.filter(p => p.id !== id))
    toast.success('Politique supprimée')
  }

  const handleSave = (data: Omit<Policy, 'id' | 'lastUpdated' | 'rules'>) => {
    if (modal === 'edit' && editing) {
      setPolicies(prev => prev.map(p =>
        p.id === editing.id ? { ...p, ...data, lastUpdated: new Date().toISOString().split('T')[0] } : p
      ))
      toast.success('Politique mise à jour')
    } else {
      setPolicies(prev => [{
        ...data, id: Date.now(),
        lastUpdated: new Date().toISOString().split('T')[0],
        rules: Math.floor(Math.random() * 10) + 3,
      }, ...prev])
      toast.success('Politique créée !')
    }
    setModal(null)
    setEditing(null)
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-6" style={{ background: '#0a0a0a', fontFamily: "'IBM Plex Mono', monospace" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)' }}>
              <Lock size={20} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Politiques de <span style={{ color: '#a78bfa' }}>Sécurité</span>
              </h1>
              <p className="text-xs" style={{ color: '#475569' }}>{policies.length} politiques configurées</p>
            </div>
          </div>
          <button onClick={() => { setEditing(null); setModal('create') }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
              color: '#fff', border: 'none', cursor: 'pointer',
              boxShadow: '0 0 20px rgba(167,139,250,0.2)',
            }}
          >
            <Plus size={13} /> NOUVELLE
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Actives',   value: enabled,  color: '#22c55e', Icon: CheckCircle   },
            { label: 'Inactives', value: disabled, color: '#475569', Icon: XCircle       },
            { label: 'Critiques', value: critical, color: '#ef4444', Icon: AlertTriangle },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.8)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}15` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div>
                <p className="text-lg font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px]" style={{ color: '#475569' }}>{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Category filter */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: catFilter === c
                  ? (c === 'ALL' ? 'rgba(167,139,250,0.2)' : `${CAT_COLOR[c]}20`)
                  : 'rgba(15,23,42,0.6)',
                border: `1px solid ${catFilter === c ? (c === 'ALL' ? 'rgba(167,139,250,0.4)' : CAT_COLOR[c] + '40') : 'rgba(30,41,59,0.8)'}`,
                color: catFilter === c ? (c === 'ALL' ? '#a78bfa' : CAT_COLOR[c]) : '#475569',
              }}
            >
              {c === 'ALL' ? `Toutes (${policies.length})` : CAT_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Policy list */}
        <div className="space-y-3">
          {filtered.map((policy, i) => (
            <motion.div key={policy.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-5 flex items-center gap-5 transition-all"
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: `1px solid ${policy.enabled ? CAT_COLOR[policy.category] + '20' : 'rgba(30,41,59,0.6)'}`,
                opacity: policy.enabled ? 1 : 0.6,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${CAT_COLOR[policy.category]}35`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = policy.enabled ? `${CAT_COLOR[policy.category]}20` : 'rgba(30,41,59,0.6)')}
            >
              {/* Category dot */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${CAT_COLOR[policy.category]}15`, border: `1px solid ${CAT_COLOR[policy.category]}25` }}>
                <Shield size={16} style={{ color: CAT_COLOR[policy.category] }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-white truncate">{policy.name}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                    style={{ background: `${CAT_COLOR[policy.category]}15`, color: CAT_COLOR[policy.category] }}>
                    {CAT_LABEL[policy.category]}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 capitalize"
                    style={{ background: `${SEV_COLOR[policy.severity]}15`, color: SEV_COLOR[policy.severity] }}>
                    {policy.severity}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: '#475569' }}>{policy.description}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: '#334155' }}>
                  <span>{policy.rules} règles</span>
                  <span className="flex items-center gap-1">
                    <Clock size={8} /> Mis à jour {new Date(policy.lastUpdated).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => togglePolicy(policy.id)} title="Activer/Désactiver">
                  {policy.enabled
                    ? <ToggleRight size={22} style={{ color: '#22c55e', cursor: 'pointer' }} />
                    : <ToggleLeft  size={22} style={{ color: '#475569', cursor: 'pointer' }} />}
                </button>
                <button onClick={() => { setEditing(policy); setModal('edit') }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ background: 'transparent', color: '#334155', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#334155' }}
                >
                  <Edit2 size={13} />
                </button>
                <button onClick={() => deletePolicy(policy.id)}
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
          <PolicyModal
            policy={modal === 'edit' ? editing : null}
            onSave={handleSave}
            onClose={() => { setModal(null); setEditing(null) }}
          />
        )}
      </AnimatePresence>
    </MainLayout>
  )
}