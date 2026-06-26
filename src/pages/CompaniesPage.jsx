import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/callAI'
import { useAuth } from '../context/AuthContext'

const TIPI = ['azienda', 'agenzia', 'interinale']

const EMPTY_FORM = {
  nome: '', tipo: 'azienda', settore: '',
  contatto_email: '', url: '', note: '',
  candidatura_spontanea: false
}

export default function CompaniesPage() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState(null)
  const [filter, setFilter] = useState('tutti')
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [profile, setProfile] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    setLoading(true)
    const [{ data: comp }, { data: prof }] = await Promise.all([
      supabase.from('companies').select('*').eq('user_id', user.id).order('nome'),
      supabase.from('profiles').select('*').eq('user_id', user.id).single()
    ])
    setCompanies(comp || [])
    setProfile(prof)
    setLoading(false)
  }

  const saveCompany = async () => {
    setSaving(true)
    const payload = { ...form, user_id: user.id }
    if (editingId) {
      await supabase.from('companies').update(payload).eq('id', editingId)
    } else {
      await supabase.from('companies').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    loadData()
  }

  const deleteCompany = async (id) => {
    if (!confirm('Eliminare questa azienda?')) return
    await supabase.from('companies').delete().eq('id', id)
    setDetail(null)
    loadData()
  }

  const openEdit = (c) => {
    setForm({
      nome: c.nome || '', tipo: c.tipo || 'azienda',
      settore: c.settore || '', contatto_email: c.contatto_email || '',
      url: c.url || '', note: c.note || '',
      candidatura_spontanea: c.candidatura_spontanea || false
    })
    setEditingId(c.id)
    setShowForm(true)
    setDetail(null)
  }

  const suggestCompanies = async () => {
    setSuggesting(true)
    setSuggestions([])
    const prompt = `Suggerisci 10 aziende o agenzie a Milano adatte per una persona con questo profilo:
Settore: ${profile?.settore || ''} - ${profile?.sottosettore || ''}
Lingue: ${(profile?.lingue || []).join(', ')}

Per ogni azienda fornisci SOLO un JSON array con questa struttura:
[
  {
    "nome": "Nome Azienda",
    "tipo": "azienda" | "agenzia" | "interinale",
    "settore": "settore specifico",
    "url": "https://...",
    "note": "breve descrizione di perché è rilevante"
  }
]

Includi: aziende del settore, agenzie specializzate, agenzie interinali attive nel settore.
Rispondi SOLO con il JSON array, senza markdown.`

    try {
      const result = await callAI(prompt, 'Sei un esperto di mercato del lavoro italiano. Rispondi SOLO con JSON valido.')
      const clean = result.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setSuggestions(parsed)
    } catch (e) {
      setMessage({ type: 'error', text: 'Errore nella generazione suggerimenti.' })
    }
    setSuggesting(false)
  }

  const addSuggestion = async (s) => {
    await supabase.from('companies').insert({
      user_id: user.id,
      nome: s.nome,
      tipo: s.tipo,
      settore: s.settore,
      url: s.url || '',
      note: s.note || '',
      candidatura_spontanea: true
    })
    setSuggestions(prev => prev.filter(x => x.nome !== s.nome))
    loadData()
  }

  const filtered = filter === 'tutti'
    ? companies
    : filter === 'spontanea'
    ? companies.filter(c => c.candidatura_spontanea)
    : companies.filter(c => c.tipo === filter)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Caricamento...</div>
    </div>
  )

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Aziende</h2>

      {/* Suggerimenti AI */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <div className="text-sm font-medium text-blue-800 mb-2">✨ Suggerimenti AI</div>
        <p className="text-xs text-blue-600 mb-3">Trova aziende e agenzie adatte al tuo profilo a Milano</p>
        <button onClick={suggestCompanies} disabled={suggesting}
          className="w-full bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm">
          {suggesting ? '⏳ Ricerca in corso...' : '🔍 Suggerisci aziende'}
        </button>
      </div>

      {/* Lista suggerimenti */}
      {suggestions.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Suggerimenti ({suggestions.length})</div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-blue-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{s.nome}</div>
                    <div className="text-xs text-gray-500">{s.tipo} · {s.settore}</div>
                    {s.note && <div className="text-xs text-gray-400 mt-1 italic">{s.note}</div>}
                  </div>
                  <button onClick={() => addSuggestion(s)}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shrink-0">
                    + Aggiungi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Filtri */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {[['tutti', 'Tutte'], ['azienda', 'Aziende'], ['agenzia', 'Agenzie'], ['interinale', 'Interinali'], ['spontanea', '📨 Spontanee']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            {label} {id === 'tutti' ? `(${companies.length})` : `(${id === 'spontanea' ? companies.filter(c => c.candidatura_spontanea).length : companies.filter(c => c.tipo === id).length})`}
          </button>
        ))}
      </div>

      {/* Lista aziende */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">Nessuna azienda ancora.</div>
        )}
        {filtered.map(c => (
          <div key={c.id} onClick={() => setDetail(c)}
            className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-300 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{c.nome}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.tipo}{c.settore ? ` · ${c.settore}` : ''}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                {c.candidatura_spontanea && (
                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-full">spontanea</span>
                )}
              </div>
            </div>
            {c.note && <div className="text-xs text-gray-400 mt-2 truncate">{c.note}</div>}
          </div>
        ))}
      </div>

      {/* FAB aggiungi */}
      <button
        onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
        className="fixed bottom-20 right-6 bg-blue-600 text-white w-14 h-14 rounded-full text-2xl shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors">
        +
      </button>

      {/* Detail modale */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setDetail(null)}>
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{detail.nome}</h3>
            <div className="text-sm text-gray-500 mb-4">{detail.tipo}{detail.settore ? ` · ${detail.settore}` : ''}</div>
            <div className="space-y-2 text-sm text-gray-600 mb-6">
              {detail.contatto_email && <div>📧 {detail.contatto_email}</div>}
              {detail.url && <div>🔗 <a href={detail.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{detail.url}</a></div>}
              {detail.candidatura_spontanea && <div className="text-purple-600">📨 Candidatura spontanea pianificata</div>}
              {detail.note && <div className="bg-gray-50 rounded-lg p-3 mt-2">📝 {detail.note}</div>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => openEdit(detail)}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm">
                Modifica
              </button>
              <button onClick={() => deleteCompany(detail.id)}
                className="px-4 bg-red-50 text-red-600 py-2.5 rounded-lg font-medium text-sm">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form modale */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-5">
              {editingId ? 'Modifica azienda' : 'Nuova azienda'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {TIPI.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Settore</label>
                  <input type="text" value={form.settore} onChange={e => setForm(f => ({...f, settore: e.target.value}))}
                    placeholder="es. beauty, moda..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email contatto</label>
                <input type="email" value={form.contatto_email} onChange={e => setForm(f => ({...f, contatto_email: e.target.value}))}
                  placeholder="hr@azienda.it"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sito web</label>
                <input type="url" value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))}
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="spontanea" checked={form.candidatura_spontanea}
                  onChange={e => setForm(f => ({...f, candidatura_spontanea: e.target.checked}))}
                  className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="spontanea" className="text-sm text-gray-700">Pianifica candidatura spontanea</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium text-sm">
                Annulla
              </button>
              <button onClick={saveCompany} disabled={saving || !form.nome}
                className="flex-1 bg-blue-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
