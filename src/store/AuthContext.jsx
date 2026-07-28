import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastStore } from './toastStore.jsx'

const AuthContext = createContext(null)

const BASE = import.meta.env.VITE_API_URL || '/api'

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('qa_tool_token'))
  const [loading, setLoading] = useState(true)

  // Landing back on "/" after any auth transition (login, logout, or a
  // session forcibly ending) is what actually fixes stale post-auth
  // routing: without it, whatever URL was in the address bar (a staff-only
  // page, a project the new session has no access to) gets re-evaluated
  // against the route table the instant a different user logs in, which is
  // how "log out, log back in as someone else" used to land on a broken
  // page instead of a real redirect.
  const resetToSignedOut = useCallback((message) => {
    localStorage.removeItem('qa_tool_token')
    setToken(null)
    setUser(null)
    navigate('/', { replace: true })
    if (message) useToastStore.getState().addToast(message, 'error')
  }, [navigate])

  // apiFetch already clears the token and fires this on any 401, but
  // nothing was listening — a session that expired or got revoked mid-use
  // silently broke every subsequent request instead of bouncing back to
  // sign-in, until a manual page refresh happened to re-run the /auth/me
  // check below. The toast is what tells the user why they suddenly landed
  // back on the sign-in screen, instead of it looking like nothing happened.
  useEffect(() => {
    const handler = () => resetToSignedOut('Your session has ended — please log in again.')
    window.addEventListener('qa-tool:unauthorized', handler)
    return () => window.removeEventListener('qa-tool:unauthorized', handler)
  }, [resetToSignedOut])

  // On mount, if a token exists, validate it against /api/auth/me
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Invalid session')
        return res.json()
      })
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('qa_tool_token')
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (email, password) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')

    localStorage.setItem('qa_tool_token', data.token)
    setToken(data.token)
    setUser(data.user)
    navigate('/', { replace: true })
    return data.user
  }

  const register = async (email, password, name) => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')

    localStorage.setItem('qa_tool_token', data.token)
    setToken(data.token)
    setUser(data.user)
    navigate('/', { replace: true })
    return data.user
  }

  const logout = () => resetToSignedOut()

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
