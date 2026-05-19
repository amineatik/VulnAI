// Shared notification builder — used by main-layout and notifications page

const BASE = 'http://localhost:8000'

export interface AppNotification {
  id: number
  message: string
  type: 'critical' | 'success' | 'warning' | 'info'
  time: string
  read: boolean
  category?: string
}

function hostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

export async function buildNotificationsFromAPI(): Promise<AppNotification[]> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const notifs: AppNotification[] = []

  // 1. Scans
  try {
    const res = await fetch(`${BASE}/scans/`, { headers })
    if (res.ok) {
      const data = await res.json()
      const list: any[] = Array.isArray(data) ? data : data.items ?? data.results ?? []
      list.forEach((s, i) => {
        const url     = hostname(s.target_url ?? '')
        const status  = (s.status ?? '').toLowerCase()
        const done    = status === 'completed'
        const failed  = status === 'failed'

        let msg = ''
        let type: AppNotification['type'] = 'info'

        if (done) {
          const crit  = s.critical_count ?? 0
          const high  = s.high_count ?? 0
          const med   = s.medium_count ?? 0
          const score = s.security_score != null ? ` (score ${s.security_score}/100)` : ''
          const det   = [crit > 0 ? `${crit} critical` : '', high > 0 ? `${high} high` : '', med > 0 ? `${med} medium` : ''].filter(Boolean).join(', ')
          msg  = `Scan terminé — ${url} · ${det || 'aucune vulnérabilité'}${score}`
          type = crit > 0 ? 'critical' : high > 0 ? 'warning' : 'success'
        } else if (failed) {
          msg  = `Scan échoué — ${url}`
          type = 'warning'
        } else {
          msg  = `Scan ${status === 'pending' ? 'en attente' : 'en cours'} — ${url}`
          type = 'info'
        }

        notifs.push({
          id:       3000 + i,
          message:  msg,
          type,
          time:     s.completed_at ?? s.created_at ?? new Date().toISOString(),
          read:     done && (s.critical_count ?? 0) === 0,
          category: 'Scan',
        })
      })
    }
  } catch {}

  // 2. Vulnérabilités critiques
  try {
    const res = await fetch(`${BASE}/vulnerabilities/severity/critical?limit=15`, { headers })
    if (res.ok) {
      const data = await res.json()
      const list: any[] = Array.isArray(data) ? data : data.results ?? data.items ?? []
      list.slice(0, 15).forEach((v, i) => {
        const cve  = v.cve_id ?? v.id ?? `VULN-${i}`
        const desc = (v.description ?? v.title ?? 'Vulnérabilité critique').slice(0, 100)
        notifs.push({
          id:       1000 + i,
          message:  `${cve} — ${desc}`,
          type:     'critical',
          time:     v.published_date ?? v.created_at ?? new Date().toISOString(),
          read:     false,
          category: 'CVE',
        })
      })
    }
  } catch {}

  // 3. Vulnérabilités medium/high
  try {
    const res = await fetch(`${BASE}/vulnerabilities/?limit=20`, { headers })
    if (res.ok) {
      const data = await res.json()
      const list: any[] = Array.isArray(data) ? data : data.results ?? data.items ?? []
      list
        .filter((v: any) => ['medium', 'high', 'low'].includes((v.severity ?? '').toLowerCase()))
        .slice(0, 10)
        .forEach((v, i) => {
          const sev  = (v.severity ?? 'medium').toLowerCase()
          const cve  = v.cve_id ?? v.id ?? `VULN-${i}`
          const desc = (v.description ?? v.title ?? 'Vulnérabilité détectée').slice(0, 100)
          notifs.push({
            id:       2000 + i,
            message:  `${cve} — ${desc}`,
            type:     sev === 'high' ? 'warning' : sev === 'low' ? 'info' : 'warning',
            time:     v.published_date ?? v.created_at ?? new Date().toISOString(),
            read:     sev === 'low',
            category: 'CVE',
          })
        })
    }
  } catch {}

  // Dédupliquer + trier par date décroissante
  const seen = new Set<number>()
  return notifs
    .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}
