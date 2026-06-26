import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/callAI'
import { useAuth } from '../context/AuthContext'

export default function CVPage() {
  const { user } = useAuth()
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [mode, setMode] = useState('migliora')
  const [offertaTesto, setOffertaTesto] = useState('')
  const [nuoveEsperienze, setNuoveEsperienze] = useState('')
  const [result, setResult] = useState('')
  const [savingName, setSavingName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadVersions() }, [user])

  const loadVersions = async () => {
    setLoading(true)
    const { data } = await supabase.from('cv_versions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setVersions(data || [])
    setLoading(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setMessage({ type: 'error', text: 'Carica un file PDF.' })
      return
    }
    setUploading(true)
    setMessage(null)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const base64 = evt.target.result.split(',')[1]
      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Estrai tutto il testo da questo CV in modo strutturato, mantenendo la gerarchia delle sezioni (esperienza, formazione, competenze, ecc.). Restituisci solo il testo estratto, senza commenti.',
            systemPrompt: 'Sei un assistente specializzato nell\'estrazione di testo da documenti PDF.',
            pdfBase64: base64
          })
        })
        const data = await response.json()
        if (data.result) {
          const nome = `CV caricato ${new Date().toLocaleDateString('it-IT')}`
          await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: nome, testo: data.result })
          await supabase.from('profiles').upsert({ user_id: user.id, cv_testo: data.result, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          setMessage({ type: 'success', text: `CV caricato e salvato come "${nome}"` })
          loadVersions()
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Errore durante il caricamento. Riprova.' })
      }
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const analyzeCV = async () => {
    if (!selectedVersion) return
    setAnalyzing(true)
    setResult('')

    const systemPrompt = `Sei un esperto di career coaching e selezione del personale. 
Dai feedback precisi, diretti e utili sui CV. Non essere generico.`

    const prompts = {
      migliora: `Analizza questo CV e fornisci:
1. PUNTI DI FORZA (2-3 elementi)
2. PUNTI DA MIGLIORARE (specifici, non generici)
3. CV RISCRITTO: riscrivi il CV completo migliorandolo — struttura più chiara, esperienze con numeri e risultati dove possibile, rimozione delle parti deboli o banali.

CV originale:
${selectedVersion.testo}`,

      aggiorna: `Questo è il mio CV attuale. Ho nuove esperienze da aggiungere.
Integra le nuove esperienze nel CV in modo coerente con il resto, mantenendo lo stile e aggiornando le sezioni pertinenti.
Restituisci il CV completo aggiornato.

CV attuale:
${selectedVersion.testo}

Nuove esperienze da aggiungere:
${nuoveEsperienze}`,

      adatta: `Adatta questo CV per la seguente offerta di lavoro.
Riscrivi il CV completo enfatizzando le competenze ed esperienze più rilevanti per questa posizione.
Aggiungi o modifica sezioni per allinearsi meglio all'offerta.

CV originale:
${selectedVersion.testo}

Offerta di lavoro:
${offertaTesto}`
    }

    try {
      const res = await callAI(prompts[mode], systemPrompt)
      setResult(res)
    } catch (e) {
      setResult('Errore nella generazione. Riprova.')
    }
    setAnalyzing(false)
  }

  const saveAsNewVersion = async () => {
    if (!result || !savingName.trim()) return
    setSaving(true)
    // Estrai solo la parte del CV riscritto dal risultato
    const cvText = result.includes('CV RISCRITTO') || result.includes('CV completo')
      ? result
      : result
    await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: savingName.trim(), testo: cvText })
    // Aggiorna anche il cv_testo nel profilo se è il CV principale
    if (savingName.toLowerCase().includes('principale') || savingName.toLowerCase().includes('aggiornato')) {
      await supabase.from('profiles').upsert({ user_id: user.id, cv_testo: cvText, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    }
    setSaving(false)
    setSavingName('')
    setResult('')
    setMessage({ type: 'success', text: 'Nuova versione salvata!' })
    loadVersions()
  }

  const deleteVersion = async (id) => {
    if (!confirm('Eliminare questa versione?')) return
    await supabase.from('cv_versions').delete().eq('id', id)
    setShowDetail(false)
    setSelectedVersion(null)
    loadVersions()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Caricamento...</div>
    </div>
  )

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-5">CV Manager</h2>

      {/* Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="text-sm font-medium text-gray-700 mb-3">Carica CV (PDF)</div>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 transition-colors">
          <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
          {uploading ? (
            <span className="text-gray-500 text-sm">⏳ Caricamento in corso...</span>
          ) : (
            <span className="text-gray-500 text-sm">📄 Tocca per caricare un PDF</span>
          )}
        </label>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Versioni salvate */}
      {versions.length > 0 && (
        <div className="mb-5">
          <div className="text-sm font-medium text-gray-700 mb-3">Versioni salvate ({versions.length})</div>
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id}
                onClick={() => { setSelectedVersion(v); setShowDetail(true) }}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-colors ${selectedVersion?.id === v.id ? 'border-blue-400' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{v.nome_versione}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(v.created_at).toLocaleDateString('it-IT')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={e => { e.stopPropagation(); setSelectedVersion(v); setShowDetail(false) }}
                      className={`text-xs px-2 py-1 rounded-lg ${selectedVersion?.id === v.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {selectedVersion?.id === v.id ? '✓ Selezionato' : 'Seleziona'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analisi AI */}
      {selectedVersion && !showDetail && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-3">
            AI — <span className="text-blue-600">{selectedVersion.nome_versione}</span>
          </div>

          <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
            {[['migliora','✨ Migliora'],['aggiorna','📝 Aggiorna'],['adatta','🎯 Adatta']].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${mode === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'aggiorna' && (
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Descrivi le nuove esperienze da aggiungere</label>
              <textarea value={nuoveEsperienze} onChange={e => setNuoveEsperienze(e.target.value)}
                placeholder="es. Da gennaio 2024 lavoro come Beauty Advisor da Douglas. Ho partecipato al corso XYZ..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          )}

          {mode === 'adatta' && (
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Testo dell'offerta di lavoro</label>
              <textarea value={offertaTesto} onChange={e => setOffertaTesto(e.target.value)}
                placeholder="Incolla il testo dell'offerta..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          )}

          <button onClick={analyzeCV}
            disabled={analyzing || (mode === 'adatta' && !offertaTesto.trim()) || (mode === 'aggiorna' && !nuoveEsperienze.trim())}
            className="w-full bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            {analyzing ? '✨ Elaborazione in corso...' : mode === 'migliora' ? '✨ Migliora e riscrivi CV' : mode === 'aggiorna' ? '📝 Aggiorna CV' : '🎯 Adatta a offerta'}
          </button>
        </div>
      )}

      {/* Risultato */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-3">Risultato</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap mb-4 max-h-96 overflow-y-auto">{result}</div>
          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs text-gray-500 mb-2">Salva come nuova versione</div>
            <div className="flex gap-2">
              <input type="text" value={savingName} onChange={e => setSavingName(e.target.value)}
                placeholder="Nome versione (es. CV aggiornato giugno 2026)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={saveAsNewVersion} disabled={saving || !savingName.trim()}
                className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {saving ? '...' : 'Salva'}
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-1">💡 Se il nome contiene "principale" o "aggiornato", verrà usato anche per generare le mail</div>
          </div>
        </div>
      )}

      {/* Detail modale */}
      {showDetail && selectedVersion && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setShowDetail(false)}>
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedVersion.nome_versione}</h3>
            <div className="text-xs text-gray-400 mb-4">{new Date(selectedVersion.created_at).toLocaleDateString('it-IT')}</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap mb-6 bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
              {selectedVersion.testo}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDetail(false) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium">
                Chiudi
              </button>
              <button onClick={() => deleteVersion(selectedVersion.id)}
                className="px-4 bg-red-50 text-red-600 py-2.5 rounded-lg text-sm font-medium">
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
