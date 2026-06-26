import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/callAI'
import { generateCVPdf, generateCVDocx } from '../lib/generateCV'
import { useAuth } from '../context/AuthContext'

export default function CVPage() {
  const { user } = useAuth()
  const [versions, setVersions] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [mode, setMode] = useState('riscrivi')
  const [offertaTesto, setOffertaTesto] = useState('')
  const [nuoveEsperienze, setNuoveEsperienze] = useState('')
  const [result, setResult] = useState('')
  const [savingName, setSavingName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [cloudConfig, setCloudConfig] = useState({ cloudName: '', uploadPreset: '' })
  const [showCloudSetup, setShowCloudSetup] = useState(false)
  const [savingCloud, setSavingCloud] = useState(false)

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    setLoading(true)
    const [{ data: vers }, { data: prof }] = await Promise.all([
      supabase.from('cv_versions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('user_id', user.id).single()
    ])
    setVersions(vers || [])
    setProfile(prof)
    if (prof?.foto_url) setPhotoUrl(prof.foto_url)
    if (prof?.cloudinary_cloud_name) {
      setCloudConfig({
        cloudName: prof.cloudinary_cloud_name,
        uploadPreset: prof.cloudinary_upload_preset || ''
      })
    }
    setLoading(false)
  }

  const saveCloudConfig = async () => {
    setSavingCloud(true)
    await supabase.from('profiles').upsert({
      user_id: user.id,
      cloudinary_cloud_name: cloudConfig.cloudName,
      cloudinary_upload_preset: cloudConfig.uploadPreset,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
    setSavingCloud(false)
    setShowCloudSetup(false)
    setMessage({ type: 'success', text: 'Configurazione salvata nel profilo.' })
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || file.type !== 'application/pdf') {
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
            prompt: 'Estrai tutto il testo da questo CV in modo strutturato, mantenendo la gerarchia delle sezioni (ESPERIENZA LAVORATIVA, FORMAZIONE, COMPETENZE, ecc.). Restituisci solo il testo estratto del CV, senza commenti aggiuntivi.',
            systemPrompt: 'Sei un assistente specializzato nell\'estrazione di testo da PDF. Estrai solo il contenuto del CV.',
            pdfBase64: base64
          })
        })
        const data = await response.json()
        if (data.result) {
          const nome = `CV caricato ${new Date().toLocaleDateString('it-IT')}`
          await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: nome, testo: data.result })
          await supabase.from('profiles').upsert({ user_id: user.id, cv_testo: data.result, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          setMessage({ type: 'success', text: `CV caricato come "${nome}"` })
          loadData()
        }
      } catch { setMessage({ type: 'error', text: 'Errore durante il caricamento.' }) }
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!cloudConfig.cloudName || !cloudConfig.uploadPreset) {
      setShowCloudSetup(true)
      setMessage({ type: 'error', text: 'Prima configura Cloudinary.' })
      return
    }
    setUploadingPhoto(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', cloudConfig.uploadPreset)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/image/upload`, {
        method: 'POST', body: formData
      })
      const data = await res.json()
      if (data.secure_url) {
        setPhotoUrl(data.secure_url)
        await supabase.from('profiles').upsert({
          user_id: user.id,
          foto_url: data.secure_url,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        setMessage({ type: 'success', text: 'Foto caricata e salvata!' })
      } else {
        setMessage({ type: 'error', text: 'Errore Cloudinary: ' + (data.error?.message || 'risposta non valida') })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore caricamento foto: ' + err.message })
    }
    setUploadingPhoto(false)
  }

  const downloadCV = async (version, format) => {
    setDownloading(true)
    // Carica sempre la foto aggiornata dal profilo
    const currentPhotoUrl = profile?.foto_url || photoUrl || null
    try {
      if (format === 'pdf') {
        await generateCVPdf(version.testo, profile, currentPhotoUrl)
      } else {
        await generateCVDocx(version.testo, profile)
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Errore nel download: ' + e.message })
    }
    setDownloading(false)
  }

  const analyzeCV = async () => {
    if (!selectedVersion) return
    setAnalyzing(true)
    setResult('')

    const systemPrompt = 'Sei un esperto di career coaching italiano. Scrivi in italiano. Sii diretto e preciso.'

    const prompts = {
      riscrivi: `Riscrivi questo CV in modo professionale. Restituisci SOLO il testo del CV riscritto, senza titoli come "CV RISCRITTO", senza analisi, senza commenti. Inizia direttamente con il nome della persona.

Linee guida:
- Sezioni con titoli in MAIUSCOLO (PROFILO PROFESSIONALE, ESPERIENZA LAVORATIVA, FORMAZIONE, COMPETENZE, LINGUE)
- Profilo professionale concreto di 3-4 righe in apertura
- Esperienze con risultati/numeri dove possibile
- Rimuovi voci banali e ridondanti
- Tono professionale e diretto

CV originale:
${selectedVersion.testo}`,

      analizza: `Analizza questo CV e fornisci feedback strutturato:

1. PUNTI DI FORZA (2-3 elementi concreti)
2. PUNTI CRITICI (specifici, con esempi dal testo)
3. AZIONI CONSIGLIATE (cosa aggiungere, cosa togliere, come riformulare)

CV:
${selectedVersion.testo}`,

      aggiorna: `Integra queste nuove esperienze nel CV e restituisci il CV COMPLETO aggiornato. Solo il testo del CV, senza commenti.

CV attuale:
${selectedVersion.testo}

Nuove esperienze da integrare:
${nuoveEsperienze}`,

      adatta: `Adatta questo CV per questa offerta specifica. Restituisci SOLO il testo del CV adattato, senza commenti. Inizia con il nome della persona.

CV originale:
${selectedVersion.testo}

Offerta:
${offertaTesto}`
    }

    try {
      const res = await callAI(prompts[mode], systemPrompt)
      setResult(res)
      setSavingName(
        mode === 'riscrivi' ? `CV riscritto ${new Date().toLocaleDateString('it-IT')}` :
        mode === 'analizza' ? `Analisi ${new Date().toLocaleDateString('it-IT')}` :
        mode === 'aggiorna' ? `CV aggiornato ${new Date().toLocaleDateString('it-IT')}` :
        `CV adattato ${new Date().toLocaleDateString('it-IT')}`
      )
    } catch { setResult('Errore nella generazione. Riprova.') }
    setAnalyzing(false)
  }

  const saveAsNewVersion = async () => {
    if (!result || !savingName.trim()) return
    setSaving(true)
    await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: savingName.trim(), testo: result })
    setSaving(false)
    setSavingName('')
    setResult('')
    setMessage({ type: 'success', text: 'Versione salvata!' })
    loadData()
  }

  const deleteVersion = async (id) => {
    if (!confirm('Eliminare questa versione?')) return
    await supabase.from('cv_versions').delete().eq('id', id)
    if (selectedVersion?.id === id) setSelectedVersion(null)
    setShowDetail(false)
    loadData()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400 text-sm">Caricamento...</div></div>

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-5">CV Manager</h2>

      {/* Foto */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-4">
          {photoUrl ? (
            <img src={photoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl">👤</div>
          )}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700 mb-2">Foto per il CV</div>
            <div className="flex gap-2 flex-wrap">
              <label className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${uploadingPhoto ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white'}`}>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                {uploadingPhoto ? '⏳ Caricamento...' : photoUrl ? '🔄 Cambia' : '📷 Carica foto'}
              </label>
              <button onClick={() => setShowCloudSetup(!showCloudSetup)}
                className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs">
                ⚙️ {cloudConfig.cloudName ? 'Cloudinary ✓' : 'Config Cloudinary'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Config Cloudinary */}
      {showCloudSetup && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="text-sm font-medium text-blue-800 mb-3">⚙️ Cloudinary — configurazione foto</div>
          <div className="space-y-3 mb-3">
            <div>
              <label className="block text-xs text-blue-700 mb-1">Cloud Name</label>
              <input type="text" value={cloudConfig.cloudName}
                onChange={e => setCloudConfig(c => ({...c, cloudName: e.target.value}))}
                placeholder="es. dgnmueqyu"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Upload Preset (Unsigned)</label>
              <input type="text" value={cloudConfig.uploadPreset}
                onChange={e => setCloudConfig(c => ({...c, uploadPreset: e.target.value}))}
                placeholder="es. jobtracker"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveCloudConfig} disabled={savingCloud}
              className="flex-1 bg-blue-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {savingCloud ? 'Salvataggio...' : 'Salva nel profilo'}
            </button>
            <button onClick={() => setShowCloudSetup(false)}
              className="px-4 border border-blue-300 text-blue-600 py-2 rounded-lg text-sm">
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Upload PDF */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="text-sm font-medium text-gray-700 mb-3">Carica CV (PDF)</div>
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-5 cursor-pointer hover:border-blue-400 transition-colors">
          <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
          <span className="text-gray-500 text-sm">{uploading ? '⏳ Caricamento...' : '📄 Tocca per caricare un PDF'}</span>
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
              <div key={v.id} className={`bg-white rounded-xl border p-4 transition-colors ${selectedVersion?.id === v.id ? 'border-blue-400' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{v.nome_versione}</div>
                    <div className="text-xs text-gray-400">{new Date(v.created_at).toLocaleDateString('it-IT')}</div>
                  </div>
                  <button onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                    className={`text-xs px-2 py-1 rounded-lg shrink-0 ${selectedVersion?.id === v.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedVersion?.id === v.id ? '✓' : 'Usa'}
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => downloadCV(v, 'pdf')} disabled={downloading}
                    className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium disabled:opacity-50">
                    📥 PDF
                  </button>
                  <button onClick={() => downloadCV(v, 'docx')} disabled={downloading}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium disabled:opacity-50">
                    📥 Word
                  </button>
                  <button onClick={() => { setSelectedVersion(v); setShowDetail(true) }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                    👁 Leggi
                  </button>
                  <button onClick={() => deleteVersion(v.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analisi AI */}
      {selectedVersion && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-1">Elabora con AI</div>
          <div className="text-xs text-gray-400 mb-3">Selezionato: {selectedVersion.nome_versione}</div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[['riscrivi','✨ Riscrivi'],['analizza','🔍 Analizza'],['aggiorna','📝 Aggiorna'],['adatta','🎯 Adatta']].map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)}
                className={`py-2 rounded-lg text-xs font-medium transition-all ${mode === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'aggiorna' && (
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Descrivi le nuove esperienze</label>
              <textarea value={nuoveEsperienze} onChange={e => setNuoveEsperienze(e.target.value)}
                placeholder="es. Da gennaio 2024 lavoro come Beauty Advisor da Douglas a Porta di Roma. Ho partecipato a..."
                rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          )}

          {mode === 'adatta' && (
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Testo offerta di lavoro</label>
              <textarea value={offertaTesto} onChange={e => setOffertaTesto(e.target.value)}
                placeholder="Incolla il testo dell'offerta..."
                rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          )}

          <button onClick={analyzeCV}
            disabled={analyzing || (mode === 'adatta' && !offertaTesto.trim()) || (mode === 'aggiorna' && !nuoveEsperienze.trim())}
            className="w-full bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
            {analyzing ? '⏳ Elaborazione in corso...' :
              mode === 'riscrivi' ? '✨ Riscrivi CV' :
              mode === 'analizza' ? '🔍 Analizza' :
              mode === 'aggiorna' ? '📝 Aggiorna CV' : '🎯 Adatta a offerta'}
          </button>
        </div>
      )}

      {/* Risultato */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-3">
            {mode === 'analizza' ? 'Analisi CV' : 'CV generato'}
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap mb-4 max-h-80 overflow-y-auto bg-gray-50 rounded-lg p-3">{result}</div>

          {mode !== 'analizza' && (
            <div className="flex gap-2 mb-4">
              <button onClick={() => downloadCV({ testo: result }, 'pdf')} disabled={downloading}
                className="flex-1 bg-red-50 text-red-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                📥 PDF
              </button>
              <button onClick={() => downloadCV({ testo: result }, 'docx')} disabled={downloading}
                className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                📥 Word
              </button>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs text-gray-500 mb-2">Salva come versione</div>
            <div className="flex gap-2">
              <input type="text" value={savingName} onChange={e => setSavingName(e.target.value)}
                placeholder="Nome versione..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={saveAsNewVersion} disabled={saving || !savingName.trim()}
                className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {saving ? '...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modale */}
      {showDetail && selectedVersion && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setShowDetail(false)}>
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedVersion.nome_versione}</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto mb-4">
              {selectedVersion.testo}
            </div>
            <button onClick={() => setShowDetail(false)}
              className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium">
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
