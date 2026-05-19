'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, LayoutDashboard, Search, Brain,
  FileBarChart2, Activity, Eye, Lock,
  Globe, Settings, Bell, ChevronDown,
  LogOut, UserCircle, ShieldCheck, Menu, X,
  Scan, CheckCheck, Target, BookOpen, Users,
  ClipboardList, CheckSquare, Zap
} from 'lucide-react'
import { buildNotificationsFromAPI, type AppNotification } from '@/lib/notifications'
import { useAuth } from '@/lib/auth-context'

type Notification = AppNotification

const navSections = [
  {
    title: 'CORE',
    items: [
      { label: 'Dashboard',       href: '/dashboard',       icon: <LayoutDashboard size={15} /> },
      { label: 'Vulnerabilities', href: '/vulnerabilities', icon: <Search size={15} /> },
      { label: 'AI Analysis',     href: '/analysis',        icon: <Brain size={15} /> },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { label: 'Scans',        href: '/scans',        icon: <Scan size={15} /> },
      { label: 'Reports',      href: '/reports',      icon: <FileBarChart2 size={15} /> },
      { label: 'Live Monitor', href: '/live-monitor', icon: <Activity size={15} /> },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Remediation',  href: '/remediation',  icon: <CheckSquare size={15} /> },
      { label: 'Audit Trail',  href: '/audit',        icon: <ClipboardList size={15} /> },
      { label: 'Compliance',   href: '/compliance',   icon: <Shield size={15} /> },
    ],
  },
  {
    title: 'TOOLS',
    items: [
      { label: 'Attack Surface', href: '/attack-surface', icon: <Target size={15} /> },
      { label: 'CVE Explorer',   href: '/cve-explorer',   icon: <Eye size={15} /> },
      { label: 'Policies',       href: '/policies',       icon: <Lock size={15} /> },
      { label: 'Integrations',   href: '/integrations',   icon: <Globe size={15} /> },
    ],
  },
  {
    title: 'TEAM',
    items: [
      { label: 'Team',       href: '/team',       icon: <Users size={15} /> },
      { label: 'Onboarding', href: '/onboarding', icon: <BookOpen size={15} /> },
    ],
  },
]

const userMenuItems = [
  { label: 'My Profile', href: '/profile',  icon: <UserCircle size={13} /> },
  { label: 'Settings',   href: '/settings', icon: <Settings size={13} /> },
  { label: 'Security',   href: '/security', icon: <ShieldCheck size={13} /> },
]

const notifColors: Record<string, string> = {
  critical: '#ef4444',
  success:  '#22c55e',
  warning:  '#f97316',
  info:     '#f97316',
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60)    return `Il y a ${diff}s`
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  return `Il y a ${Math.floor(diff / 86400)}j`
}

function NavItem({ item, collapsed }: { item: { label: string; href: string; icon: React.ReactNode }; collapsed: boolean }) {
  const pathname = usePathname()
  const active   = pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link href={item.href}>
      <div className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-150 group ${
        active
          ? 'bg-red-500/10 text-red-300 border border-red-500/20'
          : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent'
      }`}>
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-red-500" />
        )}
        <span className={`flex-shrink-0 transition-colors ${active ? 'text-red-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
          {item.icon}
        </span>
        {!collapsed && (
          <span className="font-medium tracking-wide truncate">{item.label}</span>
        )}
        {collapsed && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-[#111] border border-red-500/20 text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
            {item.label}
          </div>
        )}
      </div>
    </Link>
  )
}

function BreadcrumbLabel() {
  const pathname = usePathname()
  const map: Record<string, string> = {
    '/dashboard':       'Dashboard',
    '/vulnerabilities': 'Vulnerabilities',
    '/analysis':        'AI Analysis',
    '/scans':           'Scans',
    '/scans/new':       'Nouveau Scan',
    '/reports':         'Reports',
    '/live-monitor':    'Live Monitor',
    '/cve-explorer':    'CVE Explorer',
    '/policies':        'Policies',
    '/integrations':    'Integrations',
    '/profile':         'My Profile',
    '/settings':        'Settings',
    '/security':        'Security',
    '/notifications':   'Notifications',
    '/remediation':     'Remediation Center',
    '/audit':           'Audit Trail',
    '/compliance':      'Compliance',
    '/attack-surface':  'Attack Surface',
    '/team':            'Team',
    '/onboarding':      'Onboarding',
  }
  if (pathname.match(/^\/scans\/\d+$/))
    return <span className="text-slate-300 text-xs">Scan Detail</span>
  const label = map[pathname] ?? pathname.split('/').pop() ?? 'VulnAI'
  return <span className="text-slate-300 text-xs">{label}</span>
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen]       = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading]   = useState(false)

  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    if (userMenuOpen || notifOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen, notifOpen])

  const fetchNotifications = async () => {
    setNotifLoading(true)
    try {
      const notifs = await buildNotificationsFromAPI()
      setNotifications(notifs.slice(0, 10))
    } catch { setNotifications([]) }
    finally { setNotifLoading(false) }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length
  const { user: authUser, logout } = useAuth()
  const displayName  = authUser?.username ?? authUser?.email?.split('@')[0] ?? '?'
  const displayEmail = authUser?.email ?? ''
  const displayRole  = authUser?.role ?? 'user'
  const initials     = displayName.slice(0, 2).toUpperCase()

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      style={{ fontFamily: "'IBM Plex Mono', monospace", background: '#0a0a0a', borderRight: '1px solid rgba(239,68,68,0.12)' }}
      className={`flex flex-col h-full transition-all duration-300 ${mobile ? 'w-64' : collapsed ? 'w-16' : 'w-60'}`}
    >
      <style>{`
        .vulnai-sidebar { background: #0a0a0a; border-right: 1px solid rgba(239,68,68,0.12); }
        .vulnai-sidebar-logo-bg { background: linear-gradient(135deg, #7f1d1d, #ef4444); box-shadow: 0 0 20px rgba(239,68,68,0.3); }
      `}</style>

      {/* Logo */}
      <div className={`vulnai-sidebar flex items-center gap-3 px-4 py-5 ${collapsed && !mobile ? 'justify-center' : ''}`}
        style={{ borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
        {/* Geometric Dragon icon */}
        <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden" style={{ background: '#0a0a0a', boxShadow: '0 0 14px rgba(239,68,68,0.35)' }}>
          <svg width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="slg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444"/>
                <stop offset="100%" stopColor="#f97316"/>
              </linearGradient>
              <filter id="sg">
                <feGaussianBlur stdDeviation="1.5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <rect width="64" height="64" rx="12" fill="#0a0a0a"/>
            <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#slg)" filter="url(#sg)"/>
            <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
            <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
            <polygon points="32,20 39,32 32,44 25,32" fill="url(#slg)" filter="url(#sg)"/>
            <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
            <circle cx="32" cy="10" r="2.5" fill="#f97316" filter="url(#sg)"/>
          </svg>
        </div>
        {(!collapsed || mobile) && (
          <div>
            <p className="text-sm font-bold text-white tracking-tight">
              Vuln<span style={{ color: '#ef4444' }}>Guard</span>
            </p>
            <p className="text-[9px] tracking-widest uppercase" style={{ color: 'rgba(239,68,68,0.6)' }}>
              AI · Security Platform
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="vulnai-sidebar flex-1 overflow-y-auto py-4 space-y-4 px-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-red-900/30">
        {navSections.map((section) => (
          <div key={section.title}>
            {(!collapsed || mobile) && (
              <p className="text-[9px] font-bold tracking-widest uppercase px-3 mb-2"
                style={{ color: 'rgba(239,68,68,0.4)' }}>
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.href} item={item} collapsed={collapsed && !mobile} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse btn */}
      {!mobile && (
        <div className="vulnai-sidebar px-2 py-3" style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-medium transition-all"
            style={{ color: 'rgba(239,68,68,0.5)', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.05)'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.5)' }}
          >
            {collapsed ? '→' : '← Collapse'}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: '#0a0a0a' }}
      className="flex h-screen text-slate-100 overflow-hidden">

      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-40 md:hidden"
              onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 h-full z-50 md:hidden">
              <Sidebar mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 flex-shrink-0 relative z-30"
          style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(239,68,68,0.1)', backdropFilter: 'blur(8px)' }}>

          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-slate-400 hover:text-white transition-colors">
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <svg width="11" height="11" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
                <defs><linearGradient id="bclg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ef4444"/><stop offset="100%" stopColor="#f97316"/></linearGradient></defs>
                <path d="M32 10 L8 40 L16 40 L32 18 L48 40 L56 40 Z" fill="url(#bclg)"/>
                <path d="M32 16 L12 39 L16 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
                <path d="M32 16 L52 39 L48 39 L32 21 Z" fill="#0a0a0a" opacity="0.55"/>
                <polygon points="32,20 39,32 32,44 25,32" fill="url(#bclg)"/>
                <polygon points="32,26 36,32 32,38 28,32" fill="#0a0a0a"/>
              </svg>
              <span style={{ color: 'rgba(239,68,68,0.4)' }}>/</span>
              <BreadcrumbLabel />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* LIVE badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </div>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setNotifOpen(v => !v); setUserMenuOpen(false); fetchNotifications() }}
                className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{ color: '#4b5563' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#4b5563' }}>
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: '#ef4444', border: '2px solid #0a0a0a' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50 shadow-2xl"
                    style={{ background: '#111', border: '1px solid rgba(239,68,68,0.15)' }}>

                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
                      <span className="text-xs font-bold text-white">Alertes de sécurité</span>
                      <button onClick={() => setNotifications(p => p.map(n => ({ ...n, read: true })))}
                        className="text-[10px] transition-colors" style={{ color: 'rgba(239,68,68,0.6)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.6)'}>
                        Tout marquer lu
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto">
                      {notifLoading ? (
                        <div className="py-8 text-center text-xs text-slate-600">Chargement…</div>
                      ) : notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-600">Aucune alerte</div>
                      ) : notifications.map(n => (
                        <div key={n.id} className="flex items-start gap-3 px-4 py-3 transition-colors group"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: n.read ? 'transparent' : 'rgba(239,68,68,0.04)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'rgba(239,68,68,0.04)'}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background: notifColors[n.type] ?? '#6b7280' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate">{n.message}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5 truncate">{n.category ?? n.type}</p>
                            <p className="text-[9px] mt-1" style={{ color: 'rgba(239,68,68,0.4)' }}>{n.time}</p>
                          </div>
                          <button onClick={() => setNotifications(p => p.filter(x => x.id !== n.id))}
                            className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-slate-400 transition-all flex-shrink-0">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(239,68,68,0.08)' }}>
                      <Link href="/notifications" onClick={() => setNotifOpen(false)}
                        className="block text-center text-[10px] transition-colors"
                        style={{ color: 'rgba(239,68,68,0.5)' }}
                        onMouseEnter={(e: any) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e: any) => e.currentTarget.style.color = 'rgba(239,68,68,0.5)'}>
                        Voir toutes les alertes →
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => { setUserMenuOpen(v => !v); setNotifOpen(false) }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all"
                style={{ background: userMenuOpen ? 'rgba(239,68,68,0.08)' : 'transparent', border: '1px solid transparent' }}
                onMouseEnter={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!userMenuOpen) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7f1d1d,#ef4444)' }}>
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-200 leading-none">{displayName}</p>
                  <p className="text-[9px] leading-none mt-0.5" style={{ color: 'rgba(239,68,68,0.6)' }}>
                    {displayRole === 'admin' ? '👑 Admin' : displayRole}
                  </p>
                </div>
                <ChevronDown size={11} className={`text-slate-600 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50 shadow-2xl"
                    style={{ background: '#111', border: '1px solid rgba(239,68,68,0.15)' }}>

                    <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(239,68,68,0.1)' }}>
                      <p className="text-xs font-bold text-white truncate">{displayName}</p>
                      <p className="text-[10px] text-slate-600 truncate">{displayEmail}</p>
                      <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {displayRole.toUpperCase()}
                      </span>
                    </div>

                    <div className="py-1">
                      {userMenuItems.map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)}>
                          <div className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-400 transition-all"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; (e.currentTarget as HTMLElement).style.color = '#ef4444' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}>
                            <span style={{ color: 'rgba(239,68,68,0.5)' }}>{item.icon}</span>
                            {item.label}
                          </div>
                        </Link>
                      ))}
                    </div>

                    <div className="py-1" style={{ borderTop: '1px solid rgba(239,68,68,0.08)' }}>
                      <button
                        onClick={() => { setUserMenuOpen(false); logout() }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-all"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <LogOut size={13} />
                        Déconnexion
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#0a0a0a' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
