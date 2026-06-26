import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import ApplicationsPage from './pages/ApplicationsPage'
import MailPage from './pages/MailPage'
import CVPage from './pages/CVPage'
import JobsPage from './pages/JobsPage'
import CompaniesPage from './pages/CompaniesPage'
import { supabase } from './lib/supabase'

const NAV = [
  { id: 'dashboard', label: 'Home', icon: '🏠' },
  { id: 'candidature', label: 'Candidature', icon: '📋' },
  { id: 'offerte', label: 'Offerte', icon: '🔍' },
  { id: 'aziende', label: 'Aziende', icon: '🏢' },
  { id: 'mail', label: 'Mail', icon: '✉️' },
  { id: 'cv', label: 'CV', icon: '📄' },
  { id: 'profilo', label: 'Profilo', icon: '👤' },
]

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--noir)' }}>
      <div style={{ color: 'var(--violet-light)' }} className="text-sm">Caricamento...</div>
    </div>
  )

  if (!user) return <AuthPage />

  return (
    <div className="min-h-screen" style={{ background: 'var(--noir)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--noir-mid)', borderBottom: '1px solid var(--noir-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, var(--violet), var(--accent))' }}>
            💼
          </div>
          <h1 className="text-base font-bold font-display" style={{ color: 'var(--text-primary)' }}>
            JobTracker
          </h1>
        </div>
        <button onClick={() => supabase.auth.signOut()}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--noir-border)' }}>
          Esci
        </button>
      </div>

      {/* Content */}
      <div className="pb-20">
        {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
        {page === 'candidature' && <ApplicationsPage />}
        {page === 'offerte' && <JobsPage />}
        {page === 'aziende' && <CompaniesPage />}
        {page === 'mail' && <MailPage />}
        {page === 'cv' && <CVPage />}
        {page === 'profilo' && <ProfilePage />}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 flex z-30"
        style={{ background: 'var(--noir-mid)', borderTop: '1px solid var(--noir-border)' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-all"
            style={{ color: page === n.id ? 'var(--accent)' : 'var(--text-muted)' }}>
            <span className="text-base">{n.icon}</span>
            <span style={{ fontSize: '9px' }} className="font-medium">{n.label}</span>
            {page === n.id && (
              <div className="absolute bottom-0 w-8 h-0.5 rounded-full"
                style={{ background: 'var(--accent)' }} />
            )}
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
