import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/callAI'
import { generateCVPdf, generateCVDocx } from '../lib/generateCV'
import { useAuth } from '../context/AuthContext'

const FORM_VUOTO = {
  nome: '', cognome: '', titolo: '', telefono: '', email: '', citta: '', patente: '',
  profilo: '',
  esperienze: [{ ruolo: '', azienda: '', periodo: '', punti: '' }],
  formazione: [{ titolo: '', istituto: '', anno: '', note: '' }],
  competenze: '',
  lingue: [{ lingua: '', livello: '' }],
  hobby: '',
  altroInfo: '',
}

export default function CVPage() {
  const { user } = useAuth()
  const [versions, setVersions] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null) // null | 'incolla' | 'form' | 'ai'
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [showDetail, setShowDetail] = useState(false)

  // Incolla testo
  const [testoCV, setTestoCV] = useState('')
  const [nomeVersione, setNomeVersione] = useState('')
  const [saving, setSaving] = useState(false)

  // Form
  const [formData, setFormData] = useState(FORM_VUOTO)
  const [generatingFromForm, setGeneratingFromForm] = useState(false)

  // AI
  const [aiMode, setAiMode] = useState('riscrivi')
  const [offertaTesto, setOffertaTesto] = useState('')
  const [nuoveEsperienze, setNuoveEsperienze] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState('')
  const [savingResult, setSavingResult] = useState(false)
  const [savingResultName, setSavingResultName] = useState('')

  // Foto e download
  const [photoUrl, setPhotoUrl] = useState(null)
  const [cloudConfig, setCloudConfig] = useState({ cloudName: '', uploadPreset: '' })
  const [showCloudSetup, setShowCloudSetup] = useState(false)
  const [savingCloud, setSavingCloud] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState(null)

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
    if (prof?.cloudinary_cloud_name) setCloudConfig({ cloudName: prof.cloudinary_cloud_name, uploadPreset: prof.cloudinary_upload_preset || '' })
    setLoading(false)
  }

  const saveCloudConfig = async () => {
    setSavingCloud(true)
    await supabase.from('profiles').upsert({ user_id: user.id, cloudinary_cloud_name: cloudConfig.cloudName, cloudinary_upload_preset: cloudConfig.uploadPreset, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setSavingCloud(false)
    setShowCloudSetup(false)
    setMessage({ type: 'success', text: 'Configurazione salvata!' })
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!cloudConfig.cloudName || !cloudConfig.uploadPreset) { setShowCloudSetup(true); return }
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', cloudConfig.uploadPreset)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/image/upload`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.secure_url) {
        setPhotoUrl(data.secure_url)
        await supabase.from('profiles').upsert({ user_id: user.id, foto_url: data.secure_url, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        setMessage({ type: 'success', text: 'Foto caricata!' })
      }
    } catch { setMessage({ type: 'error', text: 'Errore caricamento foto.' }) }
    setUploadingPhoto(false)
  }

  const saveTestoCV = async () => {
    if (!testoCV.trim() || !nomeVersione.trim()) return
    setSaving(true)
    await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: nomeVersione.trim(), testo: testoCV.trim() })
    await supabase.from('profiles').upsert({ user_id: user.id, cv_testo: testoCV.trim(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setSaving(false)
    setTestoCV('')
    setNomeVersione('')
    setMode(null)
    setMessage({ type: 'success', text: 'CV salvato!' })
    loadData()
  }

  const generateFromForm = async () => {
    setGeneratingFromForm(true)
    const esperienzeTesto = formData.esperienze.map(e =>
      `${e.ruolo}${e.azienda ? ' | ' + e.azienda : ''}${e.periodo ? ' | ' + e.periodo : ''}\n${e.punti}`
    ).join('\n\n')
    const formazioneTesto = formData.formazione.map(f =>
      `${f.titolo}${f.istituto ? ' | ' + f.istituto : ''}${f.anno ? ' | ' + f.anno : ''}${f.note ? '\n' + f.note : ''}`
    ).join('\n')
    const lingueTesto = formData.lingue.map(l => `${l.lingua}${l.livello ? ': ' + l.livello : ''}`).join(', ')

    const prompt = `Crea un CV professionale completo in italiano per questa persona. Restituisci SOLO il testo del CV, senza commenti. Struttura con sezioni in MAIUSCOLO.

DATI ANAGRAFICI:
Nome: ${formData.nome} ${formData.cognome}
Titolo professionale: ${formData.titolo}
Telefono: ${formData.telefono}
Email: ${formData.email}
Città: ${formData.citta}
${formData.patente ? 'Patente: ' + formData.patente : ''}

PROFILO PROFESSIONALE:
${formData.profilo}

ESPERIENZA LAVORATIVA:
${esperienzeTesto}

FORMAZIONE:
${formazioneTesto}

COMPETENZE:
${formData.competenze}

LINGUE:
${lingueTesto}

${formData.hobby ? 'HOBBY E INTERESSI:\n' + formData.hobby : ''}
${formData.altroInfo ? 'ALTRE INFORMAZIONI:\n' + formData.altroInfo : ''}`

    try {
      const res = await callAI(prompt, 'Sei un esperto di career coaching. Scrivi CV professionali in italiano con sezioni in MAIUSCOLO.')
      const nome = `CV ${formData.nome} ${formData.cognome} ${new Date().toLocaleDateString('it-IT')}`
      await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: nome, testo: res })
      await supabase.from('profiles').upsert({ user_id: user.id, cv_testo: res, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      setMode(null)
      setFormData(FORM_VUOTO)
      setMessage({ type: 'success', text: 'CV generato e salvato!' })
      loadData()
    } catch { setMessage({ type: 'error', text: 'Errore generazione. Riprova.' }) }
    setGeneratingFromForm(false)
  }

  const analyzeCV = async () => {
    if (!selectedVersion) return
    setAnalyzing(true)
    setResult('')
    const prompts = {
      riscrivi: `Riscrivi questo CV in modo professionale. Restituisci SOLO il testo del CV riscritto, senza commenti. Inizia con il nome della persona.\n\nREGOLE ASSOLUTE:\n- Mantieni TUTTE le sezioni presenti (Formazione, Lingue, Competenze, Certificazioni, ecc.)\n- Non perdere NESSUNA informazione: titoli di studio, lingue con livello, certificazioni, date\n\nLinee guida:\n- Titoli sezioni in MAIUSCOLO\n- Profilo professionale concreto in apertura\n- Tono professionale e diretto\n\nCV originale (non perdere nulla):\n${selectedVersion.testo}`,
      analizza: `Analizza questo CV e fornisci feedback:\n1. PUNTI DI FORZA\n2. PUNTI CRITICI\n3. AZIONI CONSIGLIATE\n\nCV:\n${selectedVersion.testo}`,
      aggiorna: `Aggiorna questo CV integrando le nuove informazioni. REGOLE:\n- Restituisci il CV COMPLETO con TUTTE le sezioni originali\n- Non perdere nessuna informazione già presente\n- Solo testo CV, senza commenti\n\nCV attuale:\n${selectedVersion.testo}\n\nNuove informazioni:\n${nuoveEsperienze}`,
      adatta: `Adatta questo CV per questa offerta. Restituisci SOLO il testo del CV adattato, senza commenti.\n\nCV originale:\n${selectedVersion.testo}\n\nOfferta:\n${offertaTesto}`
    }
    try {
      const res = await callAI(prompts[aiMode], 'Sei un esperto di career coaching italiano. Scrivi in italiano.')
      setResult(res)
      setSavingResultName(
        aiMode === 'riscrivi' ? `CV riscritto ${new Date().toLocaleDateString('it-IT')}` :
        aiMode === 'analizza' ? `Analisi ${new Date().toLocaleDateString('it-IT')}` :
        aiMode === 'aggiorna' ? `CV aggiornato ${new Date().toLocaleDateString('it-IT')}` :
        `CV adattato ${new Date().toLocaleDateString('it-IT')}`
      )
    } catch { setResult('Errore. Riprova.') }
    setAnalyzing(false)
  }

  const saveResult = async () => {
    if (!result || !savingResultName.trim()) return
    setSavingResult(true)
    await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: savingResultName.trim(), testo: result })
    setSavingResult(false)
    setSavingResultName('')
    setResult('')
    setMessage({ type: 'success', text: 'Versione salvata!' })
    loadData()
  }

  const downloadCV = async (version, format) => {
    setDownloading(true)
    try {
      if (format === 'pdf') await generateCVPdf(version.testo, profile, profile?.foto_url || photoUrl || null)
      else await generateCVDocx(version.testo, profile)
    } catch (e) { setMessage({ type: 'error', text: 'Errore download: ' + e.message }) }
    setDownloading(false)
  }

  const deleteVersion = async (id) => {
    if (!confirm('Eliminare questa versione?')) return
    await supabase.from('cv_versions').delete().eq('id', id)
    if (selectedVersion?.id === id) setSelectedVersion(null)
    setShowDetail(false)
    loadData()
  }

  const addEsperienza = () => setFormData(f => ({ ...f, esperienze: [...f.esperienze, { ruolo: '', azienda: '', periodo: '', punti: '' }] }))
  const addFormazione = () => setFormData(f => ({ ...f, formazione: [...f.formazione, { titolo: '', istituto: '', anno: '', note: '' }] }))
  const addLingua = () => setFormData(f => ({ ...f, lingue: [...f.lingue, { lingua: '', livello: '' }] }))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400 text-sm">Caricamento...</div></div>

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-5">CV Manager</h2>

      {/* Foto */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-4">
          {photoUrl
            ? <img src={photoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
            : <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl">👤</div>
          }
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700 mb-2">Foto per il CV</div>
            <div className="flex gap-2 flex-wrap">
              <label className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${uploadingPhoto ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white'}`}>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                {uploadingPhoto ? '⏳...' : photoUrl ? '🔄 Cambia' : '📷 Carica foto'}
              </label>
              <button onClick={() => setShowCloudSetup(!showCloudSetup)} className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs">
                ⚙️ {cloudConfig.cloudName ? 'Cloudinary ✓' : 'Config'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCloudSetup && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="text-sm font-medium text-blue-800 mb-3">⚙️ Configurazione Cloudinary</div>
          <div className="space-y-2 mb-3">
            <input type="text" value={cloudConfig.cloudName} onChange={e => setCloudConfig(c => ({...c, cloudName: e.target.value}))}
              placeholder="Cloud Name (es. dgnmueqyu)"
              className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white" />
            <input type="text" value={cloudConfig.uploadPreset} onChange={e => setCloudConfig(c => ({...c, uploadPreset: e.target.value}))}
              placeholder="Upload Preset (es. jobtracker)"
              className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveCloudConfig} disabled={savingCloud} className="flex-1 bg-blue-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
              {savingCloud ? '...' : 'Salva'}
            </button>
            <button onClick={() => setShowCloudSetup(false)} className="px-4 border border-blue-300 text-blue-600 py-2 rounded-lg text-sm">Chiudi</button>
          </div>
        </div>
      )}

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Aggiungi nuovo CV */}
      {!mode && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-3">Aggiungi CV</div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMode('incolla')}
              className="bg-blue-50 text-blue-700 border border-blue-200 py-3 rounded-xl text-sm font-medium text-center">
              📋 Incolla testo
            </button>
            <button onClick={() => setMode('form')}
              className="bg-green-50 text-green-700 border border-green-200 py-3 rounded-xl text-sm font-medium text-center">
              ✏️ Compila form
            </button>
          </div>
        </div>
      )}

      {/* Modalità: Incolla testo */}
      {mode === 'incolla' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">Incolla il testo del CV</div>
            <button onClick={() => setMode(null)} className="text-gray-400 text-xs">✕ Annulla</button>
          </div>
          <textarea value={testoCV} onChange={e => setTestoCV(e.target.value)}
            placeholder="Incolla qui il testo completo del tuo CV. Puoi copiarlo da Word, dal tuo CV attuale, o da qualsiasi altro documento..."
            rows={10}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3" />
          <input type="text" value={nomeVersione} onChange={e => setNomeVersione(e.target.value)}
            placeholder="Nome versione (es. CV base, CV retail, CV freelance...)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
          <button onClick={saveTestoCV} disabled={saving || !testoCV.trim() || !nomeVersione.trim()}
            className="w-full bg-blue-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">
            {saving ? 'Salvataggio...' : 'Salva CV'}
          </button>
        </div>
      )}

      {/* Modalità: Compila form */}
      {mode === 'form' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-700">Compila il CV</div>
            <button onClick={() => setMode(null)} className="text-gray-400 text-xs">✕ Annulla</button>
          </div>
          <div className="space-y-4">
            {/* Dati base */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome</label>
                <input type="text" value={formData.nome} onChange={e => setFormData(f => ({...f, nome: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cognome</label>
                <input type="text" value={formData.cognome} onChange={e => setFormData(f => ({...f, cognome: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Titolo professionale</label>
              <input type="text" value={formData.titolo} onChange={e => setFormData(f => ({...f, titolo: e.target.value}))}
                placeholder="es. MUA & Hair Stylist freelance"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Telefono</label>
                <input type="tel" value={formData.telefono} onChange={e => setFormData(f => ({...f, telefono: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData(f => ({...f, email: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Città</label>
                <input type="text" value={formData.citta} onChange={e => setFormData(f => ({...f, citta: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Patente</label>
                <input type="text" value={formData.patente} onChange={e => setFormData(f => ({...f, patente: e.target.value}))}
                  placeholder="es. B"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Profilo */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Profilo professionale</label>
              <textarea value={formData.profilo} onChange={e => setFormData(f => ({...f, profilo: e.target.value}))}
                placeholder="Descrivi brevemente chi sei e cosa sai fare..."
                rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>

            {/* Esperienze */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Esperienze lavorative</label>
              {formData.esperienze.map((esp, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Ruolo" value={esp.ruolo}
                      onChange={e => { const n = [...formData.esperienze]; n[i].ruolo = e.target.value; setFormData(f => ({...f, esperienze: n})) }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="text" placeholder="Azienda" value={esp.azienda}
                      onChange={e => { const n = [...formData.esperienze]; n[i].azienda = e.target.value; setFormData(f => ({...f, esperienze: n})) }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                  <input type="text" placeholder="Periodo (es. 01/2023 – Presente)" value={esp.periodo}
                    onChange={e => { const n = [...formData.esperienze]; n[i].periodo = e.target.value; setFormData(f => ({...f, esperienze: n})) }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                  <textarea placeholder="Descrizione attività (una per riga)" value={esp.punti} rows={2}
                    onChange={e => { const n = [...formData.esperienze]; n[i].punti = e.target.value; setFormData(f => ({...f, esperienze: n})) }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs resize-none" />
                </div>
              ))}
              <button onClick={addEsperienza} className="text-blue-600 text-xs font-medium">+ Aggiungi esperienza</button>
            </div>

            {/* Formazione */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Formazione</label>
              {formData.formazione.map((f, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Titolo/Diploma" value={f.titolo}
                      onChange={e => { const n = [...formData.formazione]; n[i].titolo = e.target.value; setFormData(fd => ({...fd, formazione: n})) }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="text" placeholder="Anno" value={f.anno}
                      onChange={e => { const n = [...formData.formazione]; n[i].anno = e.target.value; setFormData(fd => ({...fd, formazione: n})) }}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                  <input type="text" placeholder="Istituto/Scuola" value={f.istituto}
                    onChange={e => { const n = [...formData.formazione]; n[i].istituto = e.target.value; setFormData(fd => ({...fd, formazione: n})) }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              ))}
              <button onClick={addFormazione} className="text-blue-600 text-xs font-medium">+ Aggiungi formazione</button>
            </div>

            {/* Lingue */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Lingue</label>
              {formData.lingue.map((l, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" placeholder="Lingua" value={l.lingua}
                    onChange={e => { const n = [...formData.lingue]; n[i].lingua = e.target.value; setFormData(f => ({...f, lingue: n})) }}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                  <input type="text" placeholder="Livello (es. C1)" value={l.livello}
                    onChange={e => { const n = [...formData.lingue]; n[i].livello = e.target.value; setFormData(f => ({...f, lingue: n})) }}
                    className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              ))}
              <button onClick={addLingua} className="text-blue-600 text-xs font-medium">+ Aggiungi lingua</button>
            </div>

            {/* Competenze */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Competenze</label>
              <textarea value={formData.competenze} onChange={e => setFormData(f => ({...f, competenze: e.target.value}))}
                placeholder="es. Trucco cinematografico, Acconciature sposa, Airbrush..."
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>

            {/* Hobby */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hobby e interessi (opzionale)</label>
              <textarea value={formData.hobby} onChange={e => setFormData(f => ({...f, hobby: e.target.value}))}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>

            <button onClick={generateFromForm} disabled={generatingFromForm || !formData.nome.trim()}
              className="w-full bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">
              {generatingFromForm ? '⏳ Generazione in corso...' : '✨ Genera CV'}
            </button>
          </div>
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
                    className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium disabled:opacity-50">📥 PDF</button>
                  <button onClick={() => downloadCV(v, 'docx')} disabled={downloading}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium disabled:opacity-50">📥 Word</button>
                  <button onClick={() => { setSelectedVersion(v); setShowDetail(true) }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">👁 Leggi</button>
                  <button onClick={() => deleteVersion(v.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI */}
      {selectedVersion && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-1">Elabora con AI</div>
          <div className="text-xs text-gray-400 mb-3">Selezionato: {selectedVersion.nome_versione}</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[['riscrivi','✨ Riscrivi'],['analizza','🔍 Analizza'],['aggiorna','📝 Aggiorna'],['adatta','🎯 Adatta']].map(([id, label]) => (
              <button key={id} onClick={() => setAiMode(id)}
                className={`py-2 rounded-lg text-xs font-medium ${aiMode === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {aiMode === 'aggiorna' && (
            <textarea value={nuoveEsperienze} onChange={e => setNuoveEsperienze(e.target.value)}
              placeholder="Descrivi le nuove esperienze da aggiungere..."
              rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 resize-none" />
          )}
          {aiMode === 'adatta' && (
            <textarea value={offertaTesto} onChange={e => setOffertaTesto(e.target.value)}
              placeholder="Incolla il testo dell'offerta..."
              rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 resize-none" />
          )}
          <button onClick={analyzeCV}
            disabled={analyzing || (aiMode === 'adatta' && !offertaTesto.trim()) || (aiMode === 'aggiorna' && !nuoveEsperienze.trim())}
            className="w-full bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
            {analyzing ? '⏳ Elaborazione...' : aiMode === 'riscrivi' ? '✨ Riscrivi CV' : aiMode === 'analizza' ? '🔍 Analizza' : aiMode === 'aggiorna' ? '📝 Aggiorna CV' : '🎯 Adatta a offerta'}
          </button>
        </div>
      )}

      {/* Risultato AI */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-3">{aiMode === 'analizza' ? 'Analisi CV' : 'CV generato'}</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap mb-4 max-h-80 overflow-y-auto bg-gray-50 rounded-lg p-3">{result}</div>
          {aiMode !== 'analizza' && (
            <div className="flex gap-2 mb-4">
              <button onClick={() => downloadCV({ testo: result }, 'pdf')} disabled={downloading}
                className="flex-1 bg-red-50 text-red-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50">📥 PDF</button>
              <button onClick={() => downloadCV({ testo: result }, 'docx')} disabled={downloading}
                className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50">📥 Word</button>
            </div>
          )}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex gap-2">
              <input type="text" value={savingResultName} onChange={e => setSavingResultName(e.target.value)}
                placeholder="Nome versione..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <button onClick={saveResult} disabled={savingResult || !savingResultName.trim()}
                className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {savingResult ? '...' : 'Salva'}
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
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto mb-4">{selectedVersion.testo}</div>
            <button onClick={() => setShowDetail(false)} className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium">Chiudi</button>
          </div>
        </div>
      )}
    </div>
  )
}
