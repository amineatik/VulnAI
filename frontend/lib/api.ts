// lib/api.ts
import axios from 'axios'

const API_URL = 'http://localhost:8000'

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ========== INTERCEPTEURS ==========

apiClient.interceptors.request.use(
  (config) => {
    const publicEndpoints = ['/auth/login', '/auth/register', '/ai/health', '/ai/test', '/health']
    const isPublicEndpoint = publicEndpoints.some(endpoint => config.url?.includes(endpoint))
    
    if (!isPublicEndpoint) {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login'
      }
    }

    if (error.response?.status === 403) {
      console.warn('Accès interdit:', error.response?.data?.detail)
    }

    if (error.response?.status === 404) {
      console.warn('Ressource non trouvée:', error.config?.url)
    }

    if (error.response?.status === 422) {
      console.warn('Erreur de validation (422):', error.response?.data?.detail)
    }

    if (error.response?.status === 500) {
      console.warn('Erreur serveur:', error.response?.data?.detail)
    }

    if (error.code === 'ECONNABORTED') {
      console.warn('Timeout - Le serveur ne répond pas')
    }

    if (!error.response) {
      console.warn('Erreur réseau - backend port 8000')
    }

    return Promise.reject(error)
  }
)

// ========== TYPES ==========

export interface User {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export interface Scan {
  id: number
  user_id: number
  target_url: string
  scan_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  security_score: number | null
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  info_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Vulnerability {
  id: number
  scan_id: number | null
  cve_id: string | null
  title: string
  description: string | null
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cvss_score: string | null
  endpoint: string | null
  remediation: string | null
  status: string
  created_at: string
}

export interface Report {
  id: number
  user_id: number
  scan_id: number | null
  title: string
  report_type: string
  content: Record<string, any>
  created_at: string
}

export interface CVEMetadata {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  has_data: boolean
}

export interface ChatMessage {
  message: string
  context?: string
  history?: Array<{ role: string; content: string }>
}

export interface ChatResponse {
  response: string
  model_used?: string
  cves_found?: boolean
  context_used?: {
    cves_found: number
    cve_ids: string[]
  }
}

export interface OllamaStatus {
  status: string
  ollama: {
    status: 'available' | 'unavailable' | 'not_running' | 'error'
    url: string
    model: string
    available_models?: string[]
    message?: string
  }
  ai_ready: boolean
}

// ========== AUTH ENDPOINTS ==========

export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (username: string, email: string, password: string) =>
    apiClient.post('/auth/register', { username, email, password }),
  me: () => apiClient.get('/auth/me'),
}

// ========== SCANS ENDPOINTS (CORRIGÉS) ==========

export const scansAPI = {
  create: (targetUrl: string, scanType: string) =>
    apiClient.post<Scan>('/scans/', { target_url: targetUrl, scan_type: scanType }),

  list: (skip?: number, limit?: number) =>
    apiClient.get<{ total: number; items: Scan[] }>('/scans/', {
      params: { skip, limit }
    }),

  get: (scanId: number) =>
    apiClient.get<Scan>(`/scans/${scanId}`),

  getVulnerabilities: (scanId: number) =>
    apiClient.get<Vulnerability[]>(`/scans/${scanId}/vulnerabilities`),

  delete: (scanId: number) =>
    apiClient.delete<{ message: string }>(`/scans/${scanId}`),
}

// ========== VULNERABILITIES ENDPOINTS ==========

export const vulnerabilitiesAPI = {
  getAll: (skip?: number, limit?: number, severity?: string, search?: string) =>
    apiClient.get<{ total: number; skip: number; limit: number; results: Vulnerability[] }>(
      '/vulnerabilities', 
      { params: { skip, limit, severity, search } }
    ),
  
  get: (vulnId: number) =>
    apiClient.get<Vulnerability>(`/vulnerabilities/${vulnId}`),
  
  updateStatus: (vulnId: number, status: string) =>
    apiClient.patch<Vulnerability>(`/vulnerabilities/${vulnId}/status`, { status }),
  
  search: (query: string, limit?: number) =>
    apiClient.get<{ query: string; count: number; results: Vulnerability[] }>(
      '/vulnerabilities/search', 
      { params: { q: query, limit } }
    ),
  
  getStats: () =>
    apiClient.get<CVEMetadata>('/vulnerabilities/stats'),
  
  getBySeverity: (severity: string, skip?: number, limit?: number) =>
    apiClient.get<{ severity: string; total: number; results: Vulnerability[] }>(
      `/vulnerabilities/severity/${severity}`,
      { params: { skip, limit } }
    ),
  
  getRecent: (limit?: number) =>
    apiClient.get<{ count: number; results: Vulnerability[] }>('/vulnerabilities/recent', 
      { params: { limit } }
    ),
  
  getByCVEId: (cveId: string) =>
    apiClient.get<Vulnerability>(`/vulnerabilities/by-cve/${cveId}`),
}

// ========== AI / CHAT ENDPOINTS ==========

export const aiAPI = {
  health: () =>
    apiClient.get<OllamaStatus>('/ai/health'),
  
  chat: (message: string, history?: Array<{ role: string; content: string }>) =>
    apiClient.post<ChatResponse>('/ai/chat', { message, history }),
  
  analyze: (vulnerability_title: string, description?: string, severity?: string) =>
    apiClient.post<{
      answer: string
      analysis: string
      recommendations: string[]
      similar_cves: Array<{ cve_id: string; title: string; severity: string; cvss_score: string }>
    }>('/ai/analyze', { 
      vulnerability_title, 
      description, 
      severity,
      question: "Analyse complète de cette vulnérabilité"
    }),
  
  analyzeCVE: (cve_id: string, question?: string) =>
    apiClient.post<{ cve: Vulnerability; analysis: string }>('/ai/analyze-cve', { cve_id, question }),
  
  getStats: () =>
    apiClient.get<CVEMetadata>('/ai/stats'),
  
  searchCVEs: (query: string, limit?: number) =>
    apiClient.get<{ query: string; count: number; results: Vulnerability[] }>(
      `/ai/search/${encodeURIComponent(query)}`, 
      { params: { limit } }
    ),
  
  testOllama: () =>
    apiClient.post<{ success: boolean; response?: string; error?: string; message?: string }>('/ai/test'),
  
  listModels: () =>
    apiClient.get<{ available_models: Array<{ name: string; size?: number }>; current_model: string; is_current_available: boolean }>('/ai/models'),
  
  listTopics: () =>
    apiClient.get<{ total_topics: number; topics: string[]; categories: Record<string, string[]> }>('/ai/topics'),
}

// ========== REPORTS ENDPOINTS ==========

export const reportsAPI = {
  create: (title: string, reportType: string, scanId?: number) =>
    apiClient.post<Report>('/reports', { title, report_type: reportType, scan_id: scanId }),
  
  list: () =>
    apiClient.get<{ total: number; items: Report[] }>('/reports'),
  
  get: (reportId: number) =>
    apiClient.get<Report>(`/reports/${reportId}`),
  
  delete: (reportId: number) =>
    apiClient.delete<{ message: string }>(`/reports/${reportId}`),
  
  generatePDF: (reportId: number) =>
    apiClient.get(`/reports/${reportId}/pdf`, { responseType: 'blob' }),
}

// ========== DASHBOARD ENDPOINTS ==========

export const dashboardAPI = {
  getStats: () =>
    apiClient.get<{
      total_scans: number
      total_vulnerabilities: number
      critical_count: number
      high_count: number
      medium_count: number
      low_count: number
      average_security_score: number | null
      recent_scans: Scan[]
    }>('/dashboard/stats'),
}

// ========== FONCTIONS UTILITAIRES ==========

export const formatApiError = (error: any): string => {
  if (error.response?.status === 422) {
    const detail = error.response?.data?.detail
    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg
    }
    if (typeof detail === 'string') {
      return detail
    }
    return 'Données invalides. Vérifiez les champs du formulaire.'
  }
  
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  
  if (error.message) {
    return error.message
  }
  
  return 'Une erreur inattendue est survenue'
}

export const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('token')
  return !!token && token.length > 0
}

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  }
  return null
}

export const setCurrentUser = (user: User) => {
  localStorage.setItem('user', JSON.stringify(user))
}

export const clearSession = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get('/health')
    return response.status === 200
  } catch {
    return false
  }
}

export const getApiInfo = async () => {
  try {
    const response = await apiClient.get('/info')
    return response.data
  } catch {
    return null
  }
}

export default apiClient