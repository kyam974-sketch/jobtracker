import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Controlla la tua email per confermare la registrazione.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) setError(error.message)
      else setMessage('Email di recupero inviata.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, var(--noir) 0%, var(--noir-mid) 50%, #1E0A3C 100%)' }}>
      
      {/* Glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'var(--violet)' }} />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, var(--violet-dark), var(--violet))' }}>
            <span className="text-3xl">💼</span>
          </div>
          <h1 className="text-3xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
            JobTracker
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            La tua ricerca lavoro, organizzata
          </p>
        </div>

        <div className="rounded-2xl p-6"
          style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>

          {mode !== 'reset' && (
            <div className="flex rounded-xl p-1 mb-6"
              style={{ background: 'var(--noir-mid)' }}>
              {[['login','Accedi'],['register','Registrati']].map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setError(null); setMessage(null) }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: mode === m ? 'var(--violet)' : 'transparent',
                    color: mode === m ? 'white' : 'var(--text-muted)'
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {mode === 'reset' && (
            <h2 className="text-lg font-bold font-display mb-6" style={{ color: 'var(--text-primary)' }}>
              Recupera password
            </h2>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tua@email.com"
                className="w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--noir-mid)', border: '1px solid var(--noir-border)', color: 'var(--text-primary)' }} />
            </div>
            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'var(--noir-mid)', border: '1px solid var(--noir-border)', color: 'var(--text-primary)' }} />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: '#3B0F0F', border: '1px solid #7F1D1D', color: 'var(--red)' }}>
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-xl px-4 py-3 text-sm"
              style={{ background: '#0A2E1E', border: '1px solid #166534', color: 'var(--green)' }}>
              {message}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="mt-6 w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--violet), var(--accent))' }}>
            {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : mode === 'register' ? 'Crea account' : 'Invia email'}
          </button>

          {mode === 'login' && (
            <button onClick={() => { setMode('reset'); setError(null); setMessage(null) }}
              className="mt-4 w-full text-center text-sm"
              style={{ color: 'var(--text-muted)' }}>
              Password dimenticata?
            </button>
          )}
          {mode === 'reset' && (
            <button onClick={() => { setMode('login'); setError(null); setMessage(null) }}
              className="mt-4 w-full text-center text-sm"
              style={{ color: 'var(--text-muted)' }}>
              ← Torna al login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
