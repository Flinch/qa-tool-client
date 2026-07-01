import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const BASE = import.meta.env.VITE_API_URL || '/api'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('qa_tool_token'))
  const [loading, setLoading] = useState(true)

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
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('qa_tool_token')
    setToken(null)
    setUser(null)
  }

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
