// lib/auth-context.tsx
// Context global — stocke l'utilisateur connecté et le token JWT
// Utilisé par toutes les pages qui ont besoin des données réelles

'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<AuthUser | null>(null)
  const [token, setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Charger depuis localStorage puis vérifier le rôle réel via /auth/me ──
  useEffect(() => {
    const saved = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (saved && savedUser) {
      setToken(saved)
      setUser(JSON.parse(savedUser))
      // Recharge le rôle depuis la DB (au cas où il a changé)
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${saved}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => {
          if (u) {
            setUser(u)
            localStorage.setItem('user', JSON.stringify(u))
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // ── Login réel via API ────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Connexion échouée')
    }
    const data = await res.json()
    setToken(data.access_token)
    setUser(data.user)
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }, [])

  // ── Refresh depuis /auth/me ───────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    const t = token || localStorage.getItem('token')
    if (!t) return
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok) {
        const u = await res.json()
        setUser(u)
        localStorage.setItem('user', JSON.stringify(u))
      }
    } catch { /* silencieux */ }
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}