import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import ProfilePage from './pages/ProfilePage'
import ApplicationsPage from './pages/ApplicationsPage'
import MailPage from './pages/MailPage'
import CVPage from './pages/CVPage'
import JobsPage from './pages/JobsPage'
import { supabase } from './lib/supabase'

const NAV = [
  { id: 'candidature', label: 'Candidature', icon: '📋' },
  { id: 'offerte', label: 'Offerte', icon: '🔍' },
  { id: 'mail', label: 'Mail', icon: '✉️' },
  { id: 'cv', label: 'CV', icon: '📄' },
  { id: 'profilo', label: 'Profilo', icon: '👤' },
]

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('candidature')

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Caricamento...</div>
    </div>
  )

  if (!user) return <AuthPage />

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl">💼</span>
          <h1 className="text-base font-bold text-gray-900">JobTracker</h1>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-400 hover:text-gray-600">
          Esci
        </button>
      </div>

      <div className="pb-20">
        {page === 'candidature' && <ApplicationsPage />}
        {page === 'offerte' && <JobsPage />}
        {page === 'mail' && <MailPage />}
        {page === 'cv' && <CVPage />}
        {page === 'profilo' && <ProfilePage embedded />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${page === n.id ? 'text-blue-600' : 'text-gray-400'}`}>
            <span className="text-lg">{n.icon}</span>
            <span className="text-xs font-medium">{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
