'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import MainLayout from '@/components/main-layout'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Send, Trash2, RefreshCw, Copy, Check,
  Sparkles, User, AlertTriangle, Shield, Zap, Eye,
  ChevronRight, Loader2, WifiOff, Wifi, Terminal,
  BookOpen, Wrench, Search, TrendingUp, X
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Vulnerability {
  id: number
  cve_id: string | null
  title: string
  severity: string
  description: string | null
  cvss_score?: string | null
  status?: string
}

interface Message {
  id: number
  role: 'user' | 'ai'
  content: string
  ts: Date
  loading?: boolean
}

// ── Config ────────────────────────────────────────────────────────────────────
const API   = 'http://localhost:8000'
let msgId   = 0

const SEV: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: <AlertTriangle size={11} /> },
  high:     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: <Zap size={11} /> },
  medium:   { color: '#eab308', bg: 'rgba(234,179,8,0.12)',  icon: <Eye size={11} /> },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  icon: <Shield size={11} /> },
}

const QUICK_PROMPTS = [
  { label: 'Explique XSS',           prompt: 'Explique-moi ce qu\'est une attaque XSS et comment s\'en protéger',           icon: <BookOpen size={12} /> },
  { label: 'SQL Injection',          prompt: 'Quelles sont les meilleures pratiques pour éviter les injections SQL ?',        icon: <Terminal size={12} /> },
  { label: 'OWASP Top 10',           prompt: 'Résume le Top 10 OWASP 2021 avec les risques principaux',                      icon: <TrendingUp size={12} /> },
  { label: 'Hardening serveur',      prompt: 'Donne-moi une checklist de hardening pour un serveur web Linux',               icon: <Wrench size={12} /> },
  { label: 'CSRF protection',        prompt: 'Comment implémenter une protection CSRF efficace ?',                            icon: <Shield size={12} /> },
  { label: 'CVE vs CVSS',           prompt: 'Quelle est la différence entre CVE et CVSS ? Comment lire un score CVSS ?',    icon: <Search size={12} /> },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function sevStyle(s: string) {
  return SEV[s?.toLowerCase()] ?? { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: <Shield size={11} /> }
}

function formatMsg(text: string): string {
  // Blocs de code ```...```
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    `<pre style="background:#111;border:1px solid #222;border-radius:8px;padding:12px;overflow-x:auto;margin:8px 0;font-size:11px;color:#a3e635;font-family:monospace">${code.trim()}</pre>`
  )
  // Code inline
  text = text.replace(/`([^`]+)`/g, '<code style="background:#1a1a1a;color:#ef4444;padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace">$1</code>')
  // Tables Markdown |---|---|
  text = text.replace(/(\|.+\|\n)+/g, (table) => {
    const rows = table.trim().split('\n').filter(r => !r.match(/^\|[-| :]+\|$/))
    const html = rows.map((row, i) => {
      const cells = row.split('|').filter(c => c !== '').map(c => c.trim())
      const tag = i === 0 ? 'th' : 'td'
      const style = i === 0 ? 'background:#1a1a1a;color:#ef4444;font-weight:bold;padding:6px 12px;text-align:left;font-size:11px;border-bottom:1px solid #2a2a2a' : 'padding:5px 12px;font-size:12px;border-bottom:1px solid #1a1a1a;color:#cbd5e1'
      return `<tr>${cells.map(c => `<${tag} style="${style}">${c}</${tag}>`).join('')}</tr>`
    }).join('')
    return `<table style="border-collapse:collapse;width:100%;margin:8px 0;border:1px solid #222;border-radius:6px;overflow:hidden">${html}</table>`
  })
  // Titres ## ###
  text = text.replace(/^### (.+)$/gm, '<h4 style="color:#ef4444;font-size:13px;font-weight:700;margin:12px 0 4px">$1</h4>')
  text = text.replace(/^## (.+)$/gm,  '<h3 style="color:#fff;font-size:14px;font-weight:700;margin:10px 0 6px;border-bottom:1px solid #1f1f1f;padding-bottom:4px">$1</h3>')
  text = text.replace(/^# (.+)$/gm,   '<h2 style="color:#ef4444;font-size:16px;font-weight:800;margin:10px 0 8px">$1</h2>')
  // Gras / italique
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f1f5f9">$1</strong>')
  text = text.replace(/\*([^*]+)\*/g,     '<em style="color:#94a3b8">$1</em>')
  // Listes numérotées 1. 2. 3.
  text = text.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#ef4444;font-weight:700;min-width:18px">$1.</span><span>$2</span></div>')
  // Listes à puces - et •
  text = text.replace(/^[-•]\s+(.+)$/gm, '<div style="display:flex;gap:8px;margin:2px 0"><span style="color:#ef4444;margin-top:2px">▸</span><span>$1</span></div>')
  // Séparateur ---
  text = text.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #1f1f1f;margin:10px 0"/>')
  // Sauts de ligne
  text = text.replace(/\n/g, '<br/>')
  return text
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full" style={{ background:'#ef4444' }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg, onCopy }: { msg: Message; onCopy: (t: string) => void }) {
  const isAI = msg.role === 'ai'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
        style={{ background: isAI ? 'linear-gradient(135deg,#7f1d1d,#ef4444)' : '#1e1e1e', color: isAI ? '#fff' : '#94a3b8' }}>
        {isAI ? <Brain size={14} /> : <User size={13} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] flex flex-col gap-1 ${isAI ? '' : 'items-end'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">{isAI ? 'VulnGuard AI' : 'Vous'}</span>
          <span className="text-[10px] text-slate-600">
            {msg.ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="rounded-xl px-4 py-2.5 text-sm leading-relaxed"
          style={isAI
            ? { background:'rgba(255,255,255,0.03)', border:'1px solid #1f1f1f', color:'#e2e8f0' }
            : { background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#e2e8f0' }
          }>
          {msg.loading ? (
            <TypingDots />
          ) : (
            <div
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }}
            />
          )}
        </div>

        {isAI && !msg.loading && (
          <button
            onClick={() => onCopy(msg.content)}
            className="text-slate-700 hover:text-slate-400 transition-colors self-start"
          >
            <Copy size={11} />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AIAnalysisPage() {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [aiOnline, setAiOnline]   = useState<boolean | null>(null)
  const [aiEngine, setAiEngine]   = useState<string>('Vérification...')
  const [vulns, setVulns]         = useState<Vulnerability[]>([])
  const [selectedVuln, setSelected] = useState<Vulnerability | null>(null)
  const [copied, setCopied]       = useState(false)
  const [vulnSearch, setVulnSearch] = useState('')
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkAI()
    fetchVulns()
    setMessages([{
      id: ++msgId,
      role: 'ai',
      content: '**Bonjour ! Je suis VulnGuard AI**\n\nJe suis votre assistant expert en cybersécurité, propulsé par **Llama 3.1** et enrichi par votre base de **10 000+ CVE**.\n\nJe peux vous aider à :\n\n- Analyser des vulnérabilités CVE spécifiques\n- Expliquer les attaques (XSS, SQL Injection, CSRF...)\n- Proposer des plans de remédiation\n- Répondre à vos questions en cybersécurité\n- Consulter les statistiques de votre base CVE\n\n**Posez votre première question !**',
      ts: new Date(),
    }])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── AI health ─────────────────────────────────────────────────────────────
  const checkAI = async () => {
    try {
      const r = await fetch(`${API}/ai/health`, { signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const d = await r.json()
        const isOnline = d.status === 'ok' || d.ai_ready === true || d.ollama?.status === 'available' || d.engine === 'cve_db' || d.engine === 'ollama'
        setAiOnline(isOnline)
        if (d.engine === 'ollama' || d.ollama_available) {
          setAiEngine('Llama 3.1 — En ligne')
        } else if (d.engine === 'cve_db') {
          setAiEngine('CVE DB — En ligne')
        } else if (d.ai_ready) {
          setAiEngine('Ollama — En ligne')
        } else {
          setAiEngine('Hors ligne')
        }
      } else {
        setAiOnline(false)
        setAiEngine('Hors ligne')
      }
    } catch {
      setAiOnline(false)
      setAiEngine('Hors ligne')
    }
  }

  // ── Load vulns from backend ───────────────────────────────────────────────
  const fetchVulns = async () => {
    try {
      const r = await fetch(`${API}/vulnerabilities/?limit=50`, { signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const d = await r.json()
        const list: Vulnerability[] = Array.isArray(d) ? d : (d.results ?? d.items ?? [])
        setVulns(list)
        if (list.length > 0) setSelected(list[0])
      }
    } catch {
      // keep empty
    }
  }

  // ── Send message (streaming temps réel) ─────────────────────────────────
  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput('')

    const aiMsgId = ++msgId
    const userMsg: Message    = { id: ++msgId, role: 'user', content: msg, ts: new Date() }
    const loadingMsg: Message = { id: aiMsgId, role: 'ai',  content: '', ts: new Date(), loading: true }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setSending(true)

    try {
      const r = await fetch(`${API}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })

      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`)

      const reader  = r.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let started     = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const raw   = decoder.decode(value, { stream: true })
        const lines = raw.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.token) {
              accumulated += data.token
              if (!started) {
                started = true
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, content: accumulated, loading: false } : m
                ))
              } else {
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, content: accumulated } : m
                ))
              }
            }
            if (data.done && !started) {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: accumulated || 'Aucune réponse.', loading: false } : m
              ))
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, content: '**Backend inaccessible**\n\nVérifiez que le serveur Python tourne sur le port 8000.', loading: false } : m
      ))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, sending])

  // ── Analyze selected vuln ─────────────────────────────────────────────────
  const analyzeVuln = useCallback(() => {
    if (!selectedVuln) return
    const prompt = `Analyse cette vulnérabilité en détail :\n**${selectedVuln.title}** (${selectedVuln.cve_id ?? 'ID inconnu'})\nSévérité : ${selectedVuln.severity.toUpperCase()}\nDescription : ${selectedVuln.description ?? 'Non disponible'}\n\nDonne-moi : le risque, l'impact, les corrections recommandées et un exemple concret.`
    send(prompt)
  }, [selectedVuln, send])

  // ── Clear chat ────────────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([{
      id: ++msgId,
      role: 'ai',
      content: '🧹 **Conversation réinitialisée**\n\nComment puis-je vous aider ?',
      ts: new Date(),
    }])
  }

  // ── Copy ──────────────────────────────────────────────────────────────────
  const copyMsg = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Key handler ───────────────────────────────────────────────────────────
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const filteredVulns = vulns.filter(v =>
    !vulnSearch || v.title.toLowerCase().includes(vulnSearch.toLowerCase()) || v.cve_id?.includes(vulnSearch)
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div
        className="flex h-[calc(100vh-57px)] overflow-hidden"
        style={{ background:'#0a0a0a', fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace" }}
      >

        {/* ── Left panel: vulns ──────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex-col hidden lg:flex" style={{ background:'#0d0d0d', borderRight:'1px solid #1a1a1a' }}>
          <div className="px-3 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={13} style={{ color:'#ef4444' }} />
              <span className="text-xs font-semibold text-white uppercase tracking-widest">Vulnérabilités</span>
              <span className="ml-auto text-xs text-slate-600">{vulns.length}</span>
            </div>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={vulnSearch}
                onChange={e => setVulnSearch(e.target.value)}
                placeholder="Filtrer..."
                className="w-full rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-300 outline-none transition-colors" style={{ background:'#111', border:'1px solid #222' }}
              />
              {vulnSearch && (
                <button onClick={() => setVulnSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filteredVulns.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-6 px-3">
                {vulns.length === 0 ? 'Chargement ou aucune donnée backend' : 'Aucun résultat'}
              </p>
            ) : filteredVulns.map(v => {
              const sev = sevStyle(v.severity)
              const active = selectedVuln?.id === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className="w-full text-left px-3 py-2.5 transition-all border-l-2"
                  style={active ? { borderLeftColor:'#ef4444', background:'rgba(239,68,68,0.08)' } : { borderLeftColor:'transparent' }}
                >
                  <p className="text-xs text-slate-200 truncate font-medium">{v.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
                      style={{ background: sev.bg, color: sev.color }}
                    >
                      {v.severity}
                    </span>
                    {v.cve_id && (
                      <span className="text-[10px] text-slate-600 font-mono truncate">{v.cve_id}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Analyze button */}
          {selectedVuln && (
            <div className="px-3 py-3 border-t border-slate-800/60">
              <button
                onClick={analyzeVuln}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444' }}
              >
                <Brain size={12} />
                Analyser avec l&apos;IA
                <ChevronRight size={11} />
              </button>
            </div>
          )}
        </div>

        {/* ── Center: chat ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:'linear-gradient(135deg,#7f1d1d,#ef4444)' }}>
                <Brain size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Assistant IA</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    aiOnline === null ? 'bg-slate-500 animate-pulse' :
                    aiOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                  }`} />
                  <span className="text-[10px] text-slate-500">
                    {aiOnline === null ? 'Vérification...' : aiOnline ? `● ${aiEngine}` : 'Backend hors ligne'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {copied && <span className="text-xs text-green-400 flex items-center gap-1"><Check size={11} /> Copié</span>}
              <button
                onClick={checkAI}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ color:'#555' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#ef4444'; (e.currentTarget as HTMLElement).style.background='rgba(239,68,68,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#555'; (e.currentTarget as HTMLElement).style.background='transparent' }}
                title="Vérifier connexion IA"
              >
                {aiOnline === null ? <Loader2 size={13} className="animate-spin" /> : aiOnline ? <Brain size={13} /> : <WifiOff size={13} />}
              </button>
              <button
                onClick={clearChat}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all"
                title="Vider la conversation"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <MsgBubble key={msg.id} msg={msg} onCopy={copyMsg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
            {QUICK_PROMPTS.map(q => (
              <button
                key={q.label}
                onClick={() => send(q.prompt)}
                disabled={sending}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-40" style={{ border:'1px solid #222', background:'rgba(255,255,255,0.02)', color:'#666' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#ef4444'; (e.currentTarget as HTMLElement).style.borderColor='rgba(239,68,68,0.3)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#666'; (e.currentTarget as HTMLElement).style.borderColor='#222' }}
              >
                <span style={{ color:'#ef4444' }}>{q.icon}</span>
                {q.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 pb-4 flex-shrink-0">
            <div className="flex gap-2 items-end rounded-xl px-3 py-2.5 transition-colors" style={{ background:'#111', border:'1px solid #222' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Posez votre question... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
                rows={1}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed"
                style={{ maxHeight: 120 }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || sending}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30" style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444' }}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 text-center">
              VulnGuard AI — propulsé par Ollama / Llama 3.1 · Les réponses peuvent contenir des erreurs
            </p>
          </div>
        </div>

        {/* ── Right panel: selected vuln detail ─────────────────────────── */}
        <AnimatePresence>
          {selectedVuln && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 border-l border-slate-800/60 bg-slate-950/60 overflow-hidden hidden xl:flex flex-col"
            >
              <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Vulnérabilité sélectionnée</span>
                    <button onClick={() => setSelected(null)} className="text-slate-700 hover:text-slate-400"><X size={12} /></button>
                  </div>
                  <h3 className="text-sm font-semibold text-white leading-tight">{selectedVuln.title}</h3>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'CVE ID',    value: selectedVuln.cve_id ?? '—' },
                    { label: 'Sévérité',  value: selectedVuln.severity.toUpperCase() },
                    { label: 'Score CVSS',value: selectedVuln.cvss_score ?? '—' },
                    { label: 'Statut',    value: selectedVuln.status ?? 'open' },
                  ].map(f => {
                    const sev = f.label === 'Sévérité' ? sevStyle(selectedVuln.severity) : null
                    return (
                      <div key={f.label}>
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-0.5">{f.label}</p>
                        {sev ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold uppercase"
                            style={{ background: sev.bg, color: sev.color }}
                          >
                            {f.value}
                          </span>
                        ) : (
                          <p className="text-xs text-slate-300 font-mono">{f.value}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {selectedVuln.description && (
                  <div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Description</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedVuln.description.slice(0, 200)}{selectedVuln.description.length > 200 ? '…' : ''}
                    </p>
                  </div>
                )}

                <div className="mt-auto space-y-2">
                  <button
                    onClick={analyzeVuln}
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444' }}
                  >
                    <Sparkles size={12} /> Analyser avec l&apos;IA
                  </button>
                  <button
                    onClick={() => send(`Quelles sont les étapes de remédiation pour ${selectedVuln.title} (${selectedVuln.cve_id ?? ''}) ?`)}
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    <Wrench size={12} /> Remédiation
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MainLayout>
  )
}
