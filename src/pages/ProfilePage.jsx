import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SETTORI = [
  'Beauty & Cosmesi', 'Moda & Lusso', 'Teatro & Spettacolo',
  'Cinema & Televisione', 'Eventi & Wedding', 'Retail',
  'Ristorazione & Hospitality', 'Tech & Informatica',
  'Amministrazione & Segreteria', 'Marketing & Comunicazione',
  'Istruzione & Formazione', 'Altro',
]

const CONTRATTI = [
  { id: 'full_time', label: 'Full time' },
  { id: 'part_time', label: 'Part time' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'piva_si', label: 'Con P.IVA' },
  { id: 'piva_no', label: 'Senza P.IVA' },
  { id: 'determinato', label: 'Tempo determinato' },
  { id: 'indeterminato', label: 'Tempo indeterminato' },
  { id: 'stage', label: 'Stage / tirocinio' },
]

export default function ProfilePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [profile, setProfile] = useState({
    nome: '', cognome: '', telefono: '',
    settori: [], sottosettore: '',
    citta_target: '', raggio_km: 20,
    lingue: [], portfolio_url: '',
    note_profilo: '', stipendio_desiderato: '',
    preferenze_contratto: [],
  })
  const [nuovaLingua, setNuovaLingua] = useState('')

  useEffect(() => { loadProfile() }, [user])

  const loadProfile = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile({
        nome: data.nome || '', cognome: data.cognome || '',
        telefono: data.telefono || '',
        settori: data.settori || (data.settore ? [data.settore] : []),
        sottosettore: data.sottosettore || '',
        citta_target: data.citta_target || '', raggio_km: data.raggio_km || 20,
        lingue: data.lingue || [], portfolio_url: data.portfolio_url || '',
        note_profilo: data.note_profilo || '',
        stipendio_desiderato: data.stipendio_desiderato || '',
        preferenze_contratto: data.preferenze_contratto || [],
      })
    }
    setLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('profiles').upsert({
      user_id: user.id, ...profile,
      settore: profile.settori[0] || '',
      stipendio_desiderato: profile.stipendio_desiderato ? parseInt(profile.stipendio_desiderato) : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    if (error) setMessage({ type: 'error', text: 'Errore nel salvataggio: ' + error.message })
    else setMessage({ type: 'success', text: 'Profilo salvato!' })
    setSaving(false)
  }

  const toggleSettore = (s) => {
    setProfile(p => ({
      ...p,
      settori: p.settori.includes(s) ? p.settori.filter(x => x !== s) : [...p.settori, s]
    }))
  }

  const toggleContratto = (id) => {
    setProfile(p => ({
      ...p,
      preferenze_contratto: p.preferenze_contratto.includes(id)
        ? p.preferenze_contratto.filter(x => x !== id)
        : [...p.preferenze_contratto, id]
    }))
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Caricamento...</div>
    </div>
  )

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Il tuo profilo</h2>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">

        {/* Nome e Cognome */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input type="text" value={profile.nome} onChange={e => setProfile(p => ({...p, nome: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
            <input type="text" value={profile.cognome} onChange={e => setProfile(p => ({...p, cognome: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Telefono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
          <input type="tel" value={profile.telefono} onChange={e => setProfile(p => ({...p, telefono: e.target.value}))}
            placeholder="+39 333 1234567"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Settori multi-selezione */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Settori <span className="text-gray-400 font-normal">(seleziona tutti quelli rilevanti)</span></label>
          <div className="flex flex-wrap gap-2">
            {SETTORI.map(s => (
              <button key={s} onClick={() => toggleSettore(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  profile.settori.includes(s)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Specializzazione */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Specializzazione</label>
          <input type="text" value={profile.sottosettore} onChange={e => setProfile(p => ({...p, sottosettore: e.target.value}))}
            placeholder="es. MUA freelance, Retail beauty, Teatro..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Preferenze contratto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo di contratto preferito</label>
          <div className="flex flex-wrap gap-2">
            {CONTRATTI.map(c => (
              <button key={c.id} onClick={() => toggleContratto(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  profile.preferenze_contratto.includes(c.id)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Città e raggio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Città target</label>
            <input type="text" value={profile.citta_target} onChange={e => setProfile(p => ({...p, citta_target: e.target.value}))}
              placeholder="es. Milano"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raggio (km)</label>
            <input type="number" value={profile.raggio_km} onChange={e => setProfile(p => ({...p, raggio_km: parseInt(e.target.value) || 20}))}
              min="5" max="100"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Stipendio desiderato */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quanto vorresti guadagnare al mese (netto €)</label>
          <input type="number" value={profile.stipendio_desiderato} onChange={e => setProfile(p => ({...p, stipendio_desiderato: e.target.value}))}
            placeholder="es. 1500"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Lingue */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lingue</label>
          <div className="flex gap-2 mb-2">
            <input type="text" value={nuovaLingua} onChange={e => setNuovaLingua(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLingua()}
              placeholder="es. Inglese C1"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={addLingua} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">+</button>
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
          <input type="url" value={profile.portfolio_url} onChange={e => setProfile(p => ({...p, portfolio_url: e.target.value}))}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note aggiuntive</label>
          <textarea value={profile.note_profilo} onChange={e => setProfile(p => ({...p, note_profilo: e.target.value}))}
            placeholder="Informazioni extra da includere nelle mail e nelle candidature..."
            rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <button onClick={saveProfile} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors">
          {saving ? 'Salvataggio...' : 'Salva profilo'}
        </button>
      </div>
    </div>
  )
}
