import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const PASSWORD_KEY = 'e4k-alliance-password'
const nativeFetch = window.fetch.bind(window)

window.fetch = (input, init = {}) => {
  const requestUrl = typeof input === 'string' ? input : input.url
  const resolved = new URL(requestUrl, window.location.href)
  if (!resolved.pathname.startsWith('/api/')) return nativeFetch(input, init)

  const headers = new Headers(typeof input === 'string' ? undefined : input.headers)
  new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value))
  const password = sessionStorage.getItem(PASSWORD_KEY)
  if (password) headers.set('X-Alliance-Password', password)

  const method = init.method || (typeof input === 'string' ? 'GET' : input.method)
  const body = init.body
  return nativeFetch(`${API_BASE}${resolved.pathname}${resolved.search}`, { ...init, method, headers, body })
}

function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await nativeFetch(`${API_BASE}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (!response.ok) throw new Error(response.status === 401 ? 'That password is incorrect.' : 'The shared server is not ready yet.')
      sessionStorage.setItem(PASSWORD_KEY, password)
      onUnlock()
    } catch (err) {
      setError(err.message || 'Could not connect to the shared server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0a0c10', color: '#e8e4d9', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <form onSubmit={submit} style={{ width: 'min(420px, 100%)', padding: 32, border: '1px solid #2a2d35', borderRadius: 14, background: '#12151c', boxShadow: '0 24px 70px #0008' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>⚔️</div>
        <h1 style={{ margin: '0 0 8px', color: '#c8a84b' }}>E4K Alliance Hub</h1>
        <p style={{ color: '#a5a5a5', marginBottom: 24 }}>Enter your alliance’s shared password to continue.</p>
        <label htmlFor="alliance-password" style={{ display: 'block', marginBottom: 8 }}>Shared password</label>
        <input id="alliance-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={{ boxSizing: 'border-box', width: '100%', padding: 12, borderRadius: 8, border: '1px solid #444', background: '#0a0c10', color: '#fff', marginBottom: 14 }} />
        {error && <p role="alert" style={{ color: '#f87171', margin: '0 0 14px' }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: '100%', padding: 12, border: 0, borderRadius: 8, background: '#c8a84b', color: '#111', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Checking…' : 'Unlock dashboard'}
        </button>
      </form>
    </main>
  )
}

function Root() {
  const [unlocked, setUnlocked] = useState(Boolean(sessionStorage.getItem(PASSWORD_KEY)))
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />
  return (
    <>
      <button type="button" onClick={() => { sessionStorage.removeItem(PASSWORD_KEY); setUnlocked(false) }} aria-label="Lock alliance dashboard" style={{ position: 'fixed', zIndex: 1000, right: 14, top: 12, padding: '7px 11px', borderRadius: 7, border: '1px solid #555', background: '#12151c', color: '#e8e4d9', cursor: 'pointer' }}>
        Lock
      </button>
      <App />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
