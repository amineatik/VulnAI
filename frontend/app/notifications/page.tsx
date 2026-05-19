'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, X, CheckCheck, RefreshCw, Filter,
  AlertTriangle, CheckCircle, Info, Zap,
  Trash2, Eye, Clock, ShieldAlert, ServerCrash
} from 'lucide-react'
import MainLayout from '@/components/main-layout'
import { buildNotificationsFromAPI, type AppNotification } from '@/lib/notifications'

type Notification = AppNotification

const typeConfig = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  label: 'Critical', icon: ShieldAlert,   glow: '0 0 12px rgba(239,68,68,0.3)'  },
  success:  { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  label: 'Success',  icon: CheckCircle,   glow: '0 0 12px rgba(34,197,94,0.3)'  },
  warning:  { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', label: 'Warning',  icon: AlertTriangle, glow: '0 0 12px rgba(249,115,22,0.3)' },
  info:     { color: '#ef4444', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.25)', label: 'Info',     icon: Info,          glow: '0 0 12px rgba(56,189,248,0.3)' },
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

type FilterType = 'all' | 'unread' | 'critical' | 'success' | 'warning' | 'info'

// ═══════════════════════════════════════════════════════════════════════════════
export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [filter, setFilter]               = useState<FilterType>('all')
  const [selected, setSelected]           = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode]       = useState(false)

  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)
    try {
      const notifs = await buildNotificationsFromAPI()
      if (notifs.length === 0) setError('Aucune donnée retournée par le backend')
      else setNotifications(notifs)
    } catch {
      setError('Backend inaccessible — vérifiez que localhost:8000 tourne')
    }
    setLoading(false)
  }

  useEffect(() => { fetchNotifications() }, [])

  const markRead       = (id: number) => setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n))
  const markAllRead    = ()           => setNotifications(p => p.map(n => ({ ...n, read: true })))
  const deleteNotif    = (id: number) => { setNotifications(p => p.filter(n => n.id !== id)); setSelected(p => { const s = new Set(p); s.delete(id); return s }) }
  const deleteSelected = ()           => { selected.forEach(deleteNotif); setSelected(new Set()); setSelectMode(false) }
  const toggleSelect   = (id: number) => setSelected(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s })

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read
    if (['critical','success','warning','info'].includes(filter)) return n.type === filter
    return true
  })
  const unread = notifications.filter(n => !n.read).length

  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all',      label: `All (${notifications.length})` },
    { key: 'unread',   label: `Unread (${unread})` },
    { key: 'critical', label: `Critical (${notifications.filter(n => n.type === 'critical').length})` },
    { key: 'warning',  label: `Warning (${notifications.filter(n => n.type === 'warning').length})` },
    { key: 'success',  label: `Success (${notifications.filter(n => n.type === 'success').length})` },
    { key: 'info',     label: `Info (${notifications.filter(n => n.type === 'info').length})` },
  ]

  return (
    <MainLayout>
    <div style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
      className="min-h-full bg-[#0a0a0a] px-4 md:px-8 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/25 flex items-center justify-center">
                <Bell size={15} className="text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
              {unread > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold">
                  {unread} unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 ml-11">
              {loading ? 'Connexion au backend…' : error ? 'Erreur backend' : `${notifications.length} notifications · données réelles`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <motion.button whileTap={{ scale: 0.95 }} onClick={fetchNotifications}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400 hover:text-white transition-all">
              <motion.div animate={loading ? { rotate: 360 } : {}} transition={{ duration: 0.8, repeat: loading ? Infinity : 0, ease: 'linear' }}>
                <RefreshCw size={12} />
              </motion.div>
              Refresh
            </motion.button>
            {unread > 0 && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/25 text-xs text-red-400 hover:bg-red-600/20 transition-all">
                <CheckCheck size={12} /> Mark all read
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSelectMode(v => !v); setSelected(new Set()) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${selectMode ? 'bg-slate-700/60 border-slate-600 text-white' : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-white'}`}>
              <Filter size={12} /> Select
            </motion.button>
            {selectMode && selected.size > 0 && (
              <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.95 }} onClick={deleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 hover:bg-red-500/20 transition-all">
                <Trash2 size={12} /> Delete ({selected.size})
              </motion.button>
            )}
          </div>
        </div>

        {/* Stats */}
        {!loading && !error && notifications.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {(['critical','warning','success','info'] as const).map(t => {
              const cfg   = typeConfig[t]
              const count = notifications.filter(n => n.type === t).length
              if (count === 0) return null
              const Icon  = cfg.icon
              return (
                <button key={t} onClick={() => setFilter(filter === t ? 'all' : t)}
                  style={{ background: filter === t ? cfg.bg : 'rgba(255,255,255,0.02)', borderColor: filter === t ? cfg.border : 'rgba(148,163,184,0.1)', boxShadow: filter === t ? cfg.glow : 'none' }}
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all hover:opacity-90">
                  <Icon size={12} style={{ color: cfg.color }} />
                  <span style={{ color: cfg.color }} className="text-sm font-bold">{count}</span>
                  <span className="text-xs text-slate-500 uppercase tracking-widest">{cfg.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Tabs */}
        {!loading && !error && notifications.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-5 scrollbar-none">
            {tabs.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${filter === f.key ? 'bg-red-600/15 border border-red-500/30 text-red-300' : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-700'}`}>
                {f.label}
              </button>
            ))}
            {selectMode && (
              <button onClick={() => setSelected(new Set(filtered.map(n => n.id)))}
                className="ml-auto text-xs text-slate-500 hover:text-slate-300 whitespace-nowrap transition-colors">
                Select all
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <RefreshCw size={20} className="text-slate-600" />
            </motion.div>
            <p className="text-xs text-slate-600">Chargement depuis localhost:8000…</p>
          </div>
        )}

        {/* Erreur */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <ServerCrash size={24} className="text-red-500/60" />
            </div>
            <p className="text-sm text-slate-400 text-center max-w-sm">{error}</p>
            <button onClick={fetchNotifications}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white transition-all">
              <RefreshCw size={12} /> Réessayer
            </button>
          </div>
        )}

        {/* Vide */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Bell size={20} className="text-slate-600" />
            <p className="text-sm text-slate-500">Aucune notification pour ce filtre</p>
          </div>
        )}

        {/* Liste */}
        {!loading && !error && (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {filtered.map((n, i) => {
                const cfg   = typeConfig[n.type] ?? typeConfig.info
                const Icon  = cfg.icon
                const isSel = selected.has(n.id)
                return (
                  <motion.div key={n.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    style={{ borderColor: isSel ? cfg.border : n.read ? 'rgba(148,163,184,0.08)' : 'rgba(148,163,184,0.14)', background: isSel ? cfg.bg : n.read ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)' }}
                    className="group relative rounded-xl border transition-all hover:border-slate-700/60 overflow-hidden">

                    {!n.read && <div style={{ background: cfg.color }} className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full" />}

                    <div className="flex items-start gap-4 px-4 py-4">
                      {selectMode && (
                        <button onClick={() => toggleSelect(n.id)}
                          style={{ borderColor: isSel ? cfg.color : undefined, background: isSel ? cfg.bg : undefined }}
                          className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border border-slate-600 flex items-center justify-center transition-all">
                          {isSel && <div style={{ background: cfg.color }} className="w-2 h-2 rounded-sm" />}
                        </button>
                      )}
                      <div style={{ background: cfg.bg, borderColor: cfg.border }}
                        className="flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center">
                        <Icon size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm leading-relaxed ${n.read ? 'text-slate-400' : 'text-slate-200'}`}>
                            {n.message}
                          </p>
                          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <button onClick={() => markRead(n.id)}
                                className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all">
                                <Eye size={10} />
                              </button>
                            )}
                            <button onClick={() => deleteNotif(n.id)}
                              className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all">
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                            className="text-[10px] px-1.5 py-0.5 rounded-md border font-semibold uppercase tracking-widest">
                            {cfg.label}
                          </span>
                          {n.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-500 uppercase tracking-widest">
                              {n.category}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] text-slate-600">
                            <Clock size={10} /> {timeAgo(n.time)}
                          </span>
                          {!n.read && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-400/80">
                              <Zap size={9} /> Unread
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-700">
              {filtered.length} notification{filtered.length > 1 ? 's' : ''}{filter !== 'all' ? ` · filtre : ${filter}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
    </MainLayout>
  )
}