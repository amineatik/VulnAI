'use client'

import { useState, useEffect } from 'react'
import MainLayout from '@/components/main-layout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Shield, Activity, CheckCircle, Crown, Eye,
  UserPlus, Mail, RefreshCw, Trash2, Edit3, X, Save,
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

const API = 'http://localhost:8000'

interface TeamMember {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string | null
  scans_count: number
  vulns_fixed: number
  last_active: string | null
}

const ROLES = ['admin', 'analyst', 'viewer', 'user'] as const

const ROLE_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  admin:   { color: '#f97316', label: 'Admin',   icon: Crown    },
  analyst: { color: '#a78bfa', label: 'Analyst', icon: Activity },
  viewer:  { color: '#6b7280', label: 'Viewer',  icon: Eye      },
  user:    { color: '#a78bfa', label: 'User',    icon: Shield   },
}

const AVATAR_COLORS = [
  'linear-gradient(135deg,#7f1d1d,#ef4444)',
  'linear-gradient(135deg,#7c2d12,#f97316)',
  'linear-gradient(135deg,#581c87,#a855f7)',
  'linear-gradient(135deg,#14532d,#22c55e)',
  'linear-gradient(135deg,#713f12,#eab308)',
  'linear-gradient(135deg,#1e3a5f,#3b82f6)',
  'linear-gradient(135deg,#4c1d95,#8b5cf6)',
]

function getInitials(name: string): string {
  return name.split(/[\s._-]/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1)  return 'En ligne'
  if (m < 60) return `Il y a ${m}min`
  if (h < 24) return `Il y a ${h}h`
  return `Il y a ${d}j`
}

export default function TeamPage() {
  const { user: authUser } = useAuth()
  const isAdmin = authUser?.role === 'admin'

  const [team, setTeam]       = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('user')
  const [inviting, setInviting]       = useState(false)
  const [invited, setInvited]         = useState(false)

  // Edit modal
  const [editingId, setEditingId]         = useState<number | null>(null)
  const [editUsername, setEditUsername]   = useState('')
  const [editEmail, setEditEmail]         = useState('')
  const [editRole, setEditRole]           = useState('')
  const [editSaving, setEditSaving]       = useState(false)
  const [editError, setEditError]         = useState('')

  // Delete confirm
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const getHeaders = () => {
    const token = localStorage.getItem('token')
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  }

  const fetchTeam = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/users`, { headers: getHeaders() })
      if (res.ok) {
        const data = await res.json()
        setTeam(Array.isArray(data) ? data : [])
      } else {
        const text = await res.text().catch(() => '')
        setError(`Erreur ${res.status}: ${text || 'Impossible de charger les membres'}`)
      }
    } catch (e: any) {
      setError(`Erreur de connexion: ${e?.message || 'serveur inaccessible'}`)
    }
    setLoading(false)
  }

  useEffect(() => { fetchTeam() }, [])

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openEdit = (m: TeamMember) => {
    setEditingId(m.id)
    setEditUsername(m.username)
    setEditEmail(m.email)
    setEditRole(m.role)
    setEditError('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`${API}/users/${editingId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ username: editUsername, email: editEmail, role: editRole }),
      })
      if (res.ok) {
        setTeam(prev => prev.map(m => m.id === editingId
          ? { ...m, username: editUsername, email: editEmail, role: editRole }
          : m
        ))
        setEditingId(null)
      } else {
        const d = await res.json()
        setEditError(d.detail ?? 'Erreur de sauvegarde')
      }
    } catch {
      setEditError('Erreur de connexion')
    }
    setEditSaving(false)
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deletingId) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API}/users/${deletingId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      if (res.ok || res.status === 204) {
        setTeam(prev => prev.filter(m => m.id !== deletingId))
        setDeletingId(null)
      }
    } catch {}
    setDeleteLoading(false)
  }

  // ── Invite ───────────────────────────────────────────────────────────────────
  const [inviteError, setInviteError] = useState('')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    setInviteError('')
    try {
      const res = await fetch(`${API}/users/invite`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (res.ok) {
        setInvited(true)
        setInviteEmail('')
        setTimeout(() => setInvited(false), 5000)
      } else {
        const d = await res.json().catch(() => ({}))
        setInviteError(d.detail ?? 'Erreur lors de l\'envoi')
      }
    } catch {
      setInviteError('Serveur inaccessible')
    }
    setInviting(false)
  }

  const stats = {
    total:      team.length,
    active:     team.filter(m => m.is_active).length,
    totalScans: team.reduce((a, m) => a + m.scans_count, 0),
    totalFixed: team.reduce((a, m) => a + m.vulns_fixed, 0),
  }

  return (
    <MainLayout>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", background:'#0a0a0a' }} className="min-h-full p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} style={{ color:'#ef4444' }} />
              <span className="text-xs tracking-widest uppercase" style={{ color:'#ef4444' }}>Team</span>
              {isAdmin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 font-bold">ADMIN</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">Gestion de l'équipe</h1>
            <p className="text-xs text-slate-500 mt-0.5">{stats.total} membre{stats.total > 1 ? 's' : ''} · {stats.active} actif{stats.active > 1 ? 's' : ''}</p>
          </div>
          <button onClick={fetchTeam} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40"
            style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Membres',      value: stats.total,      color: '#ef4444' },
            { label: 'Actifs',       value: stats.active,     color: '#22c55e' },
            { label: 'Scans totaux', value: stats.totalScans, color: '#f97316' },
            { label: 'Vulns fixées', value: stats.totalFixed, color: '#f97316' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4" style={{ background:'#111', border:'1px solid #1f1f1f' }}>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs mt-1" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Team list */}
        <div className="rounded-xl overflow-hidden" style={{ background:'#111', border:'1px solid #1f1f1f' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid #1a1a1a' }}>
            <p className="text-xs font-semibold text-slate-300">Membres de l'équipe</p>
            {isAdmin && <p className="text-[10px] text-orange-400/70">Mode admin · Cliquez sur ✏️ pour modifier</p>}
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <RefreshCw size={16} className="text-slate-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-red-400">{error}</div>
          ) : team.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-600">Aucun membre trouvé</div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {team.map((m, i) => {
                const roleConf = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.user
                const RoleIcon = roleConf.icon
                const isMe = m.id === authUser?.id
                const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length]
                return (
                  <motion.div key={m.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 px-4 py-3.5 transition-all"
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>

                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: avatarColor }}>
                      {getInitials(m.username)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{m.username}</p>
                        {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)' }}>Vous</span>}
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ color: roleConf.color, background: roleConf.color + '15' }}>
                          <RoleIcon size={9} /> {roleConf.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                    </div>

                    <div className="hidden sm:flex items-center gap-5 text-right">
                      <div>
                        <p className="text-xs font-bold text-white">{m.scans_count}</p>
                        <p className="text-[10px] text-slate-600">Scans</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{m.vulns_fixed}</p>
                        <p className="text-[10px] text-slate-600">Fixées</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${m.is_active ? 'bg-green-400' : 'bg-slate-600'}`} />
                        <p className="text-[11px] text-slate-500">{timeAgo(m.last_active)}</p>
                      </div>
                    </div>

                    {/* Admin controls */}
                    {isAdmin && !isMe && (
                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        <button onClick={() => openEdit(m)}
                          className="p-1.5 rounded-lg transition-all" style={{ color:'#555' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#ef4444'; (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.08)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#555'; (e.currentTarget as HTMLElement).style.background='transparent' }}
                          title="Modifier">
                          <Edit3 size={13} />
                        </button>
                        <button onClick={() => setDeletingId(m.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Désactiver">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Invite */}
        <div className="rounded-xl p-5" style={{ background:'#111', border:'1px solid #1f1f1f' }}>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={14} style={{ color:'#ef4444' }} />
            <p className="text-sm font-semibold text-white">Inviter un membre</p>
          </div>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-52">
              <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                type="email" placeholder="email@exemple.com"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-slate-300 focus:outline-none" style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', fontFamily:'inherit' }} />
            </div>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs text-slate-300 focus:outline-none" style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', fontFamily:'inherit' }}>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <button type="submit" disabled={inviting || !inviteEmail}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444' }}>
              {inviting
                ? <><span className="animate-spin inline-block">↻</span> Envoi…</>
                : invited
                ? <><CheckCircle size={12} className="text-green-400" /> Email envoyé !</>
                : <><UserPlus size={12} /> Inviter</>}
            </button>
          </form>
          {inviteError && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle size={10} /> {inviteError}
            </p>
          )}
          {invited && (
            <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
              <CheckCircle size={10} /> Invitation envoyée par email !
            </p>
          )}
        </div>

        {/* ── Modal Edit ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {editingId !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={e => { if (e.target === e.currentTarget) setEditingId(null) }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background:'#111', border:'1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">Modifier le membre</p>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nom d'utilisateur</label>
                    <input value={editUsername} onChange={e => setEditUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs text-slate-200 focus:outline-none" style={{ background:'#1a1a1a', border:'1px solid #333', fontFamily:'inherit' }} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Email</label>
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email"
                      className="w-full px-3 py-2 rounded-lg text-xs text-slate-200 focus:outline-none" style={{ background:'#1a1a1a', border:'1px solid #333', fontFamily:'inherit' }} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Rôle</label>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs text-slate-200 focus:outline-none" style={{ background:'#1a1a1a', border:'1px solid #333', fontFamily:'inherit' }}>
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  {editError && <p className="text-xs text-red-400">{editError}</p>}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={saveEdit} disabled={editSaving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                    style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444' }}>
                    {editSaving ? <><span className="animate-spin">↻</span> Sauvegarde…</> : <><Save size={12} /> Sauvegarder</>}
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="px-4 py-2 rounded-lg text-xs transition-all" style={{ border:'1px solid #333', color:'#666' }}>
                    Annuler
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Modal Delete confirm ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {deletingId !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={e => { if (e.target === e.currentTarget) setDeletingId(null) }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl p-6 space-y-4 text-center" style={{ background:'#111', border:'1px solid rgba(239,68,68,0.25)' }}>
                <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Désactiver ce compte ?</p>
                  <p className="text-xs text-slate-500 mt-1">
                    L'utilisateur ne pourra plus se connecter. Les scans et données associés sont conservés.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={confirmDelete} disabled={deleteLoading}
                    className="flex-1 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-semibold transition-all disabled:opacity-40">
                    {deleteLoading ? '↻ Suppression…' : 'Désactiver'}
                  </button>
                  <button onClick={() => setDeletingId(null)}
                    className="flex-1 py-2 rounded-lg text-xs transition-all" style={{ border:'1px solid #333', color:'#666' }}>
                    Annuler
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </MainLayout>
  )
}
