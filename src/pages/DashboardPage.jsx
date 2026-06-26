import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STATO_COLORS = {
  'bozza': 'bg-gray-100 text-gray-600',
  'inviata': 'bg-blue-100 text-blue-700',
  'in attesa': 'bg-yellow-100 text-yellow-700',
  'risposta': 'bg-green-100 text-green-700',
  'rifiuto': 'bg-red-100 text-red-700',
  'colloquio': 'bg-purple-100 text-purple-700',
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

    // Statistiche
    const s = { totale: allApps.length }
    ;['bozza','inviata','in attesa','risposta','rifiuto','colloquio'].forEach(stato => {
      s[stato] = allApps.filter(a => a.stato === stato).length
    })
    setStats(s)

    // Follow-up in scadenza entro 7 giorni
    const fu = allApps.filter(a => {
      if (!a.prossimo_followup) return false
      return a.prossimo_followup >= todayStr && a.prossimo_followup <= in7Str
    }).sort((a, b) => a.prossimo_followup.localeCompare(b.prossimo_followup))
    setFollowups(fu)

    // Candidature recenti (ultime 5)
    setRecentApps(allApps.slice(0, 5))
    setLoading(false)
  }

  const daysUntil = (dateStr) => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const d = new Date(dateStr)
    const diff = Math.round((d - today) / (1000*60*60*24))
    if (diff === 0) return 'oggi'
    if (diff === 1) return 'domani'
    return 'tra ' + diff + ' giorni'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Caricamento...</div>
    </div>
  )

  const nome = profile?.nome ? ', ' + profile.nome : ''

  return (
    <div className="px-4 pt-4 pb-12">
      {/* Intestazione */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">Ciao{nome}! 👋</h2>
        {profile?.citta_target && (
          <p className="text-sm text-gray-500 mt-0.5">Ricerca attiva a {profile.citta_target}</p>
        )}
      </div>

      {/* Contatori principali */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          ['inviata', 'Inviate', '📤'],
          ['in attesa', 'In attesa', '⏳'],
          ['colloquio', 'Colloqui', '🎯'],
        ].map(([stato, label, icon]) => (
          <button key={stato} onClick={() => onNavigate('candidature')}
            className="bg-white rounded-xl border border-gray-200 p-3 text-center hover:border-blue-300 transition-colors">
            <div className="text-2xl font-bold text-gray-900">{stats[stato] || 0}</div>
            <div className="text-xs text-gray-500 mt-0.5">{icon} {label}</div>
          </button>
        ))}
      </div>

      {/* Tutti gli stati */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          ['bozza', 'Bozze'],
          ['risposta', 'Risposte'],
          ['rifiuto', 'Rifiuti'],
        ].map(([stato, label]) => (
          <div key={stato} className="bg-white rounded-xl border border-gray-200 p-2 text-center">
            <div className="text-lg font-bold text-gray-700">{stats[stato] || 0}</div>
            <div className="text-xs text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Follow-up in scadenza */}
      {followups.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">⏰ Follow-up in scadenza</h3>
          </div>
          <div className="space-y-2">
            {followups.map(a => (
              <button key={a.id} onClick={() => onNavigate('candidature')}
                className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 text-left hover:border-amber-400 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{a.azienda}</div>
                    {a.ruolo && <div className="text-xs text-gray-500">{a.ruolo}</div>}
                  </div>
                  <div className="text-xs text-amber-700 font-medium">{daysUntil(a.prossimo_followup)}</div>
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
            <h3 className="text-sm font-semibold text-gray-800">📋 Candidature recenti</h3>
            <button onClick={() => onNavigate('candidature')} className="text-xs text-blue-600">Vedi tutte</button>
          </div>
          <div className="space-y-2">
            {recentApps.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{a.azienda}</div>
                    {a.ruolo && <div className="text-xs text-gray-500 truncate">{a.ruolo}</div>}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${STATO_COLORS[a.stato]}`}>
                    {a.stato}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offerte salvate */}
      {savedJobs.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">💾 Offerte salvate</h3>
            <button onClick={() => onNavigate('offerte')} className="text-xs text-blue-600">Cerca offerte</button>
          </div>
          <div className="space-y-2">
            {savedJobs.map(j => (
              <div key={j.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="font-medium text-gray-900 text-sm">{j.titolo}</div>
                <div className="text-xs text-gray-500">{j.azienda}</div>
                {j.url && (
                  <a href={j.url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 mt-1 block">Apri offerta →</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stato vuoto */}
      {stats.totale === 0 && (
        <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">🚀</div>
          <div className="text-gray-700 font-medium mb-1">Pronta per iniziare?</div>
          <div className="text-gray-400 text-sm mb-4">Cerca offerte o aggiungi la tua prima candidatura</div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => onNavigate('offerte')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              🔍 Cerca offerte
            </button>
            <button onClick={() => onNavigate('candidature')}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
              + Candidatura
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
