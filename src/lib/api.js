import { useToastStore } from '../store/toastStore.jsx'

const BASE = import.meta.env.VITE_API_URL || '/api'

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('qa_tool_token')

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    const message = err.error || `HTTP ${res.status}`
    const error = new Error(message)
    error.status = res.status

    // A 401 means the session is gone (expired, revoked, or never sent) —
    // clear it and let AuthContext bounce the app back to sign-in instead of
    // leaving every page silently failing with the same cryptic error.
    if (res.status === 401 && token) {
      localStorage.removeItem('qa_tool_token')
      window.dispatchEvent(new CustomEvent('qa-tool:unauthorized'))
    }

    throw error
  }

  if (res.status === 204) return null
  return res.json()
}

export function reportError(message) {
  useToastStore.getState().addToast(message, 'error')
}
