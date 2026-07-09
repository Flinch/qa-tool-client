import { useState } from 'react'
import { useAuth } from '../store/AuthContext.jsx'

export default function SignInPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.email, form.password, form.name)
      }
      // AuthProvider updates `user` on success; App re-renders into AppShell.
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 360, padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--white)', marginBottom: '0.35rem' }}>
            QA<span style={{ color: 'var(--accent)' }}>Tool</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {mode === 'login' ? 'Welcome back' : 'Create a client account'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              data-testid="signup-name"
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
            data-testid="auth-email"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required
            minLength={8}
            data-testid="auth-password"
            style={inputStyle}
          />

          {error && (
            <div
              data-testid="auth-error"
              style={{
                fontSize: '0.8rem',
                color: 'var(--danger)',
                background: 'rgba(193,68,58,0.1)',
                border: '1px solid rgba(193,68,58,0.25)',
                borderRadius: 0,
                padding: '0.5rem 0.65rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid="auth-submit"
            style={{
              marginTop: '0.25rem',
              background: 'var(--accent)',
              color: 'var(--white)',
              border: 'none',
              borderRadius: 0,
              padding: '0.6rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          data-testid="auth-toggle-mode"
          style={{
            marginTop: '1rem',
            width: '100%',
            textAlign: 'center',
            fontSize: '0.8rem',
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border2)',
  borderRadius: 0,
  padding: '0.6rem 0.7rem',
  color: 'var(--light)',
  fontSize: '0.88rem',
  outline: 'none',
}
