import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STATI = ['bozza', 'inviata', 'in attesa', 'risposta', 'rifiuto', 'colloquio']
const CANALI = ['email', 'form', 'DM social', 'spontanea', 'agenzia']

const STATO_COLORS = {
  'bozza': 'bg-gray-100 text-gray-600',
  'inviata': 'bg-blue-100 text-blue-700',
  'in attesa': 'bg-yellow-100 text-yellow-700',
  'risposta': 'bg-green-100 text-green-700',
  'rifiuto': 'bg-red-100 text-red-700',
  'colloquio': 'bg-purple-100 text-purple-700',
}

const EMPTY_FORM = {
  azienda: '', ruolo: '', canale: 'email', url_offerta: '',
  data_offerta: '', data_invio: '', stato: 'bozza',
  note: '', prossimo_followup: '', fonte: 'manuale'
}

export default function ApplicationsPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterStato, setFilterStato] = useState('tutti')
  const [detail, setDetail] = useState(null)

  useEffect(() => { loadApplications() }, [user])

  const loadApplications = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setApplications(data || [])
    setLoading(false)
  }

  const saveApplication = async () => {
    setSaving(true)
    const payload = {
      ...form,
      user_id: user.id,
      data_offerta: form.data_offerta || null,
      data_invio: form.data_invio || null,
      prossimo_followup: form.prossimo_followup || null,
      updated_at: new Date().toISOString()
    }
    if (editingId) {
      await supabase.from('applications').update(payload).eq('id', editingId)
    } else {
      await supabase.from('applications').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    loadApplications()
  }

  const deleteApplication = async (id) => {
    if (!confirm('Eliminare questa candidatura?')) return
    await supabase.from('applications').delete().eq('id', id)
    setDetail(null)
    loadApplications()
  }

  const openEdit = (app) => {
    setForm({
      azienda: app.azienda || '',
      ruolo: app.ruolo || '',
      canale: app.canale || 'email',
      url_offerta: app.url_offerta || '',
      data_offerta: app.data_offerta || '',
      data_invio: app.data_invio || '',
      stato: app.stato || 'bozza',
      note: app.note || '',
      prossimo_followup: app.prossimo_followup || '',
      fonte: app.fonte || 'manuale'
    })
    setEditingId(app.id)
    setShowForm(true)
    setDetail(null)
  }

  const filtered = filterStato === 'tutti'
    ? applications
    : applications.filter(a => a.stato === filterStato)

  const counts = STATI.reduce((acc, s) => {
    acc[s] = applications.filter(a => a.stato === s).length
    return acc
  }, {})

  // Followup in scadenza (entro 7 giorni)
  const today = new Date()
  const upcoming = applications.filter(a => {
    if (!a.prossimo_followup) return false
    const d = new Date(a.prossimo_followup)
    const diff = (d - today) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Caricamento...</div>
    </div>
  )

  return (
    <div className="pb-12">
      {/* Followup in scadenza */}
      {upcoming.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 mx-4 mt-4">
          <div className="text-amber-800 font-medium text-sm mb-2">⏰ Follow-up in scadenza</div>
          {upcoming.map(a => (
            <div key={a.id} className="text-amber-700 text-sm">
              {a.azienda} — {a.prossimo_followup}
            </div>
          ))}
        </div>
      )}

      {/* Contatori stati */}
      <div className="grid grid-cols-3 gap-2 px-4 mt-4 mb-4">
        {[['inviata','Inviate'],['in attesa','Attesa'],['colloquio','Colloqui']].map(([s, label]) => (
          <div key={s} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{counts[s] || 0}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div className="flex gap-2 px-4 overflow-x-auto pb-2">
        {['tutti', ...STATI].map(s => (
          <button
            key={s}
            onClick={() => setFilterStato(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterStato === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === 'tutti' ? `Tutte (${applications.length})` : `${s} (${counts[s] || 0})`}
          </button>
        ))}
      </div>


      {/* Legenda stati */}
      <div className="mx-4 mb-3 bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-0.5">
        <div><span className="font-medium text-gray-700">bozza</span> — da inviare · <span className="font-medium text-gray-700">inviata</span> — spedita, attendo risposta</div>
        <div><span className="font-medium text-gray-700">in attesa</span> — ho sollecitato, nessuna risposta · <span className="font-medium text-gray-700">risposta</span> — mi hanno risposto</div>
        <div><span className="font-medium text-gray-700">rifiuto</span> — non selezionata · <span className="font-medium text-gray-700">colloquio</span> — convocata</div>
      </div>
      {/* Lista candidature */}
      <div className="px-4 mt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {filterStato === 'tutti' ? 'Nessuna candidatura ancora.' : `Nessuna candidatura con stato "${filterStato}".`}
          </div>
        )}
        {filtered.map(app => (
          <div
            key={app.id}
            onClick={() => setDetail(app)}
            className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{app.azienda}</div>
                {app.ruolo && <div className="text-sm text-gray-600 truncate">{app.ruolo}</div>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${STATO_COLORS[app.stato]}`}>
                {app.stato}
              </span>
            </div>
            <div className="mt-2 space-y-0.5">
              {app.canale && <div className="text-xs text-gray-400">📨 {app.canale}</div>}
              {app.data_invio && <div className="text-xs text-gray-400">📅 Inviata: {app.data_invio}</div>}
              {app.prossimo_followup && <div className="text-xs text-amber-600">⏰ Follow-up: {app.prossimo_followup}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Pulsante aggiungi */}
      <button
        onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
        className="fixed bottom-20 right-6 bg-blue-600 text-white w-14 h-14 rounded-full text-2xl shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
      >
        +
      </button>

      {/* Detail panel */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setDetail(null)}>
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{detail.azienda}</h3>
                {detail.ruolo && <div className="text-gray-600">{detail.ruolo}</div>}
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATO_COLORS[detail.stato]}`}>
                {detail.stato}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              {detail.canale && <div>📨 Canale: {detail.canale}</div>}
              {detail.fonte && <div>🔍 Fonte: {detail.fonte}</div>}
              {detail.data_offerta && <div>📋 Data offerta: {detail.data_offerta}</div>}
              {detail.data_invio && <div>📅 Data invio: {detail.data_invio}</div>}
              {detail.prossimo_followup && <div>⏰ Prossimo follow-up: {detail.prossimo_followup}</div>}
              {detail.solleciti_inviati > 0 && <div>🔔 Solleciti inviati: {detail.solleciti_inviati}</div>}
              {detail.url_offerta && (
                <div>🔗 <a href={detail.url_offerta} target="_blank" rel="noreferrer" className="text-blue-600 underline">Link offerta</a></div>
              )}
              {detail.note && <div className="mt-3 bg-gray-50 rounded-lg p-3">📝 {detail.note}</div>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => openEdit(detail)}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm"
              >
                Modifica
              </button>
              <button
                onClick={() => deleteApplication(detail.id)}
                className="px-4 bg-red-50 text-red-600 py-2.5 rounded-lg font-medium text-sm"
              >
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
              {editingId ? 'Modifica candidatura' : 'Nuova candidatura'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Azienda *</label>
                <input type="text" value={form.azienda} onChange={e => setForm(f => ({...f, azienda: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                <input type="text" value={form.ruolo} onChange={e => setForm(f => ({...f, ruolo: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
                  <select value={form.stato} onChange={e => setForm(f => ({...f, stato: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATI.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Canale</label>
                  <select value={form.canale} onChange={e => setForm(f => ({...f, canale: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CANALI.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
<div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data offerta</label>
                <input type="date" value={form.data_offerta} onChange={e => setForm(f => ({...f, data_offerta: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data invio</label>
                <input type="date" value={form.data_invio} onChange={e => setForm(f => ({...f, data_invio: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prossimo follow-up</label>
                <input type="date" value={form.prossimo_followup} onChange={e => setForm(f => ({...f, prossimo_followup: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link offerta</label>
                <input type="url" value={form.url_offerta} onChange={e => setForm(f => ({...f, url_offerta: e.target.value}))}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea value={form.note} onChange={e => setForm(f => ({...f, note: e.target.value}))}
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium text-sm">
                Annulla
              </button>
              <button onClick={saveApplication} disabled={saving || !form.azienda}
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
