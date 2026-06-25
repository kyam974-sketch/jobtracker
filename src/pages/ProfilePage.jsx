import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SETTORI = [
  'Beauty & Cosmesi',
  'Moda & Lusso',
  'Teatro & Spettacolo',
  'Cinema & Televisione',
  'Eventi & Wedding',
  'Retail',
  'Ristorazione & Hospitality',
  'Tech & Informatica',
  'Amministrazione & Segreteria',
  'Marketing & Comunicazione',
  'Istruzione & Formazione',
  'Altro',
]

export default function ProfilePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [profile, setProfile] = useState({
    nome: '',
    cognome: '',
    settore: '',
    sottosettore: '',
    citta_target: '',
    raggio_km: 20,
    lingue: [],
    portfolio_url: '',
    note_profilo: '',
  })
  const [nuovaLingua, setNuovaLingua] = useState('')

  useEffect(() => {
    loadProfile()
  }, [user])

  const loadProfile = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (data) {
      setProfile({
        nome: data.nome || '',
        cognome: data.cognome || '',
        settore: data.settore || '',
        sottosettore: data.sottosettore || '',
        citta_target: data.citta_target || '',
        raggio_km: data.raggio_km || 20,
        lingue: data.lingue || [],
        portfolio_url: data.portfolio_url || '',
        note_profilo: data.note_profilo || '',
      })
    }
    setLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, ...profile, updated_at: new Date().toISOString() })
    if (error) setMessage({ type: 'error', text: 'Errore nel salvataggio: ' + error.message })
    else setMessage({ type: 'success', text: 'Profilo salvato!' })
    setSaving(false)
  }

  const addLingua = () => {
    if (nuovaLingua.trim() && !profile.lingue.includes(nuovaLingua.trim())) {
      setProfile(p => ({ ...p, lingue: [...p.lingue, nuovaLingua.trim()] }))
      setNuovaLingua('')
    }
  }

  const removeLingua = (lingua) => {
    setProfile(p => ({ ...p, lingue: p.lingue.filter(l => l !== lingua) }))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">Caricamento...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💼</span>
          <h1 className="text-lg font-bold text-gray-900">JobTracker</h1>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">
          Esci
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-12">
        <h2 className="text-xl font-bold text-gray-900 mt-6 mb-6">Il tuo profilo</h2>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">

          {/* Nome e Cognome */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={profile.nome}
                onChange={e => setProfile(p => ({ ...p, nome: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
              <input
                type="text"
                value={profile.cognome}
                onChange={e => setProfile(p => ({ ...p, cognome: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Settore */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Settore</label>
            <select
              value={profile.settore}
              onChange={e => setProfile(p => ({ ...p, settore: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleziona settore</option>
              {SETTORI.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Sottosettore */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specializzazione</label>
            <input
              type="text"
              value={profile.sottosettore}
              onChange={e => setProfile(p => ({ ...p, sottosettore: e.target.value }))}
              placeholder="es. MUA freelance, Retail beauty, Teatro..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Città e raggio */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Città target</label>
              <input
                type="text"
                value={profile.citta_target}
                onChange={e => setProfile(p => ({ ...p, citta_target: e.target.value }))}
                placeholder="es. Milano"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raggio (km)</label>
              <input
                type="number"
                value={profile.raggio_km}
                onChange={e => setProfile(p => ({ ...p, raggio_km: parseInt(e.target.value) || 20 }))}
                min="5" max="100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Lingue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lingue</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={nuovaLingua}
                onChange={e => setNuovaLingua(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLingua()}
                placeholder="es. Inglese C1"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addLingua}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.lingue.map(l => (
                <span key={l} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                  {l}
                  <button onClick={() => removeLingua(l)} className="hover:text-blue-900 ml-1">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Portfolio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link portfolio</label>
            <input
              type="url"
              value={profile.portfolio_url}
              onChange={e => setProfile(p => ({ ...p, portfolio_url: e.target.value }))}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Note profilo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note aggiuntive</label>
            <textarea
              value={profile.note_profilo}
              onChange={e => setProfile(p => ({ ...p, note_profilo: e.target.value }))}
              placeholder="Informazioni extra da includere nelle mail e nelle candidature..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Messaggio */}
          {message && (
            <div className={`rounded-lg px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {/* Salva */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Salvataggio...' : 'Salva profilo'}
          </button>
        </div>
      </div>
    </div>
  )
}
