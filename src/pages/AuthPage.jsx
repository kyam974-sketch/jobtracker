import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'reset'
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
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) setError(error.message)
      else setMessage('Email di recupero inviata. Controlla la tua casella.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        
        {/* Logo / Titolo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">💼</div>
          <h1 className="text-2xl font-bold text-gray-900">JobTracker</h1>
          <p className="text-gray-500 text-sm mt-1">Gestisci la tua ricerca lavoro</p>
        </div>

        {/* Tab login / registrati */}
        {mode !== 'reset' && (
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              Accedi
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              Registrati
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Recupera password</h2>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tua@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Errore / messaggio */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
            {message}
          </div>
        )}

        {/* Bottone principale */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : mode === 'register' ? 'Crea account' : 'Invia email'}
        </button>

        {/* Link password dimenticata */}
        {mode === 'login' && (
          <button
            onClick={() => { setMode('reset'); setError(null); setMessage(null) }}
            className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Password dimenticata?
          </button>
        )}

        {mode === 'reset' && (
          <button
            onClick={() => { setMode('login'); setError(null); setMessage(null) }}
            className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            ← Torna al login
          </button>
        )}
      </div>
    </div>
  )
}
