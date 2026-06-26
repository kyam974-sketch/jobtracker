import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STATO_COLORS = {
  'bozza': { bg: '#1A1033', color: '#A594D4', border: '#3D2E6B' },
  'inviata': { bg: '#0D1B3E', color: '#60A5FA', border: '#1E3A6E' },
  'nessuna risposta': { bg: '#1E1A00', color: '#FBBF24', border: '#44400A' },
  'risposta': { bg: '#0A2E1E', color: '#34D399', border: '#0F5132' },
  'rifiuto': { bg: '#2E0A0A', color: '#F87171', border: '#6B1313' },
  'colloquio': { bg: '#1A0A2E', color: '#C084FC', border: '#4C1D95' },
}

export default function DashboardPage({ onNavigate }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({})
  const [followups, setFollowups] = useState([])
  const [recentApps, setRecentApps] = useState([])
  const [savedJobs, setSavedJobs] = useState([])

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    setLoading(true)
    const today = new Date()
    const in7days = new Date(today)
    in7days.setDate(today.getDate() + 7)
    const todayStr = today.toISOString().split('T')[0]
    const in7Str = in7days.toISOString().split('T')[0]

    const [{ data: prof }, { data: apps }, { data: jobs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('job_cache').select('*').eq('user_id', user.id).eq('salvata', true).order('data_trovata', { ascending: false }).limit(5)
    ])

    setProfile(prof)
    setSavedJobs(jobs || [])
    const allApps = apps || []
    const s = { totale: allApps.length }
    ;['bozza','inviata','nessuna risposta','risposta','rifiuto','colloquio'].forEach(stato => {
      s[stato] = allApps.filter(a => a.stato === stato).length
    })
    setStats(s)
    setFollowups(allApps.filter(a => a.prossimo_followup >= todayStr && a.prossimo_followup <= in7Str).sort((a,b) => a.prossimo_followup.localeCompare(b.prossimo_followup)))
    setRecentApps(allApps.slice(0, 5))
    setLoading(false)
  }

  const daysUntil = (dateStr) => {
    const today = new Date(); today.setHours(0,0,0,0)
    const diff = Math.round((new Date(dateStr) - today) / (1000*60*60*24))
    if (diff === 0) return 'oggi'
    if (diff === 1) return 'domani'
    return `tra ${diff} giorni`
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div style={{ color: 'var(--text-muted)' }} className="text-sm">Caricamento...</div></div>

  const nome = profile?.nome ? `, ${profile.nome}` : ''

  return (
    <div className="px-4 pt-5 pb-12">
      {/* Saluto */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
          Ciao{nome}! 👋
        </h2>
        {profile?.citta_target && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Ricerca attiva a {profile.citta_target}
          </p>
        )}
      </div>

      {/* Contatori principali */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[['inviata','Inviate','📤'],['nessuna risposta','In attesa','⏳'],['colloquio','Colloqui','🎯']].map(([stato, label, icon]) => (
          <button key={stato} onClick={() => onNavigate('candidature')}
            className="rounded-2xl p-3 text-center transition-all active:scale-95"
            style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
            <div className="text-2xl font-bold font-display" style={{ color: 'var(--accent)' }}>{stats[stato] || 0}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{icon} {label}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {[['bozza','Bozze'],['risposta','Risposte'],['rifiuto','Rifiuti']].map(([stato, label]) => (
          <div key={stato} className="rounded-2xl p-2 text-center"
            style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
            <div className="text-lg font-bold font-display" style={{ color: 'var(--text-primary)' }}>{stats[stato] || 0}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Follow-up */}
      {followups.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold font-display mb-2" style={{ color: 'var(--text-primary)' }}>⏰ Follow-up in scadenza</h3>
          <div className="space-y-2">
            {followups.map(a => (
              <button key={a.id} onClick={() => onNavigate('candidature')}
                className="w-full rounded-xl p-3 text-left transition-all active:scale-95"
                style={{ background: '#1A1A00', border: '1px solid #44400A' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{a.azienda}</div>
                    {a.ruolo && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.ruolo}</div>}
                  </div>
                  <div className="text-xs font-medium" style={{ color: 'var(--amber)' }}>{daysUntil(a.prossimo_followup)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Candidature recenti */}
      {recentApps.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold font-display" style={{ color: 'var(--text-primary)' }}>📋 Candidature recenti</h3>
            <button onClick={() => onNavigate('candidature')} className="text-xs" style={{ color: 'var(--violet-light)' }}>Vedi tutte</button>
          </div>
          <div className="space-y-2">
            {recentApps.map(a => {
              const sc = STATO_COLORS[a.stato] || STATO_COLORS['bozza']
              return (
                <div key={a.id} className="rounded-xl p-3"
                  style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{a.azienda}</div>
                      {a.ruolo && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{a.ruolo}</div>}
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium shrink-0"
                      style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {a.stato}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Offerte salvate */}
      {savedJobs.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold font-display" style={{ color: 'var(--text-primary)' }}>💾 Offerte salvate</h3>
            <button onClick={() => onNavigate('offerte')} className="text-xs" style={{ color: 'var(--violet-light)' }}>Cerca offerte</button>
          </div>
          <div className="space-y-2">
            {savedJobs.map(j => (
              <div key={j.id} className="rounded-xl p-3"
                style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
                <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{j.titolo}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{j.azienda}</div>
                {j.url && <a href={j.url} target="_blank" rel="noreferrer" className="text-xs mt-1 block" style={{ color: 'var(--violet-light)' }}>Apri offerta →</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stato vuoto */}
      {stats.totale === 0 && (
        <div className="text-center py-10 rounded-2xl"
          style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
          <div className="text-4xl mb-3">🚀</div>
          <div className="font-semibold font-display mb-1" style={{ color: 'var(--text-primary)' }}>Pronta per iniziare?</div>
          <div className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Cerca offerte o aggiungi la prima candidatura</div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => onNavigate('offerte')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, var(--violet), var(--accent))' }}>
              🔍 Cerca offerte
            </button>
            <button onClick={() => onNavigate('candidature')}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--noir-mid)', color: 'var(--text-primary)', border: '1px solid var(--noir-border)' }}>
              + Candidatura
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
