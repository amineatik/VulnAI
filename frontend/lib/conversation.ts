const API_URL = 'http://localhost:8000'

export interface Message {
  id?: number
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export interface Conversation {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
  messages?: Message[]
}

export async function getConversations(token: string): Promise<Conversation[]> {
  const response = await fetch(`${API_URL}/conversations`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return response.json()
}

export async function createConversation(token: string, title?: string): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title: title || 'Nouvelle conversation' })
  })
  return response.json()
}

export async function getConversation(token: string, id: number): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return response.json()
}

export async function addMessage(token: string, conversationId: number, role: string, content: string) {
  const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ role, content })
  })
  return response.json()
}

export async function deleteConversation(token: string, id: number) {
  await fetch(`${API_URL}/conversations/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
}