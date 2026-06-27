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
}

export default function CVPage() {
  const { user } = useAuth()
  const [versions, setVersions] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(FORM_VUOTO)
  const [generatingFromForm, setGeneratingFromForm] = useState(false)
  const [parsingCV, setParsingCV] = useState(false)
  const [addMode, setAddMode] = useState(null) // 'esperienza' | 'formazione' | 'lingua'
  const [addData, setAddData] = useState({})
  const [addingSaving, setAddingSaving] = useState(false)
  const [addTargetId, setAddTargetId] = useState('all')
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [editingVersion, setEditingVersion] = useState(null) // versione in modifica
  const [editingTesto, setEditingTesto] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // AI
  const [aiMode, setAiMode] = useState('riscrivi')
  const [offertaTesto, setOffertaTesto] = useState('')
  const [nuoveEsperienze, setNuoveEsperienze] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState('')
  const [savingResult, setSavingResult] = useState(false)
  const [savingResultName, setSavingResultName] = useState('')

  // Foto
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
    if (prof?.cv_form_data) setFormData(prof.cv_form_data)
    setLoading(false)
  }


  useEffect(() => {
    if (user && formData.nome) {
      const timer = setTimeout(() => saveFormData(formData), 1500)
      return () => clearTimeout(timer)
    }
  }, [formData])

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
      const fd = new FormData()
      fd.append('file', file)
      fd.append('upload_preset', cloudConfig.uploadPreset)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudConfig.cloudName}/image/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.secure_url) {
        setPhotoUrl(data.secure_url)
        await supabase.from('profiles').upsert({ user_id: user.id, foto_url: data.secure_url, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        setMessage({ type: 'success', text: 'Foto caricata!' })
      }
    } catch { setMessage({ type: 'error', text: 'Errore caricamento foto.' }) }
    setUploadingPhoto(false)
  }


  const saveFormData = async (data) => {
    await supabase.from('profiles').upsert({
      user_id: user.id,
      cv_form_data: data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
  }

  const generateFromForm = async () => {
    setGeneratingFromForm(true)
    const esperienzeTesto = formData.esperienze.filter(e => e.ruolo || e.azienda).map(e =>
      `${e.ruolo}${e.azienda ? ' | ' + e.azienda : ''}${e.periodo ? ' | ' + e.periodo : ''}\n${e.punti}`
    ).join('\n\n')
    const formazioneTesto = formData.formazione.filter(f => f.titolo).map(f =>
      `${f.titolo}${f.istituto ? ' | ' + f.istituto : ''}${f.anno ? ' | ' + f.anno : ''}${f.note ? '\n' + f.note : ''}`
    ).join('\n')
    const lingueTesto = formData.lingue.filter(l => l.lingua).map(l => `${l.lingua}${l.livello ? ': ' + l.livello : ''}`).join(', ')

    const prompt = `Crea un CV professionale completo in italiano. Restituisci SOLO il testo del CV, senza commenti. Struttura con sezioni in MAIUSCOLO. Inizia con il nome.

NOME: ${formData.nome} ${formData.cognome}
TITOLO PROFESSIONALE: ${formData.titolo}
TELEFONO: ${formData.telefono}
EMAIL: ${formData.email}
CITTÀ: ${formData.citta}
${formData.patente ? 'PATENTE: ' + formData.patente : ''}

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
${formData.hobby ? '\nHOBBY E INTERESSI:\n' + formData.hobby : ''}`

    try {
      const res = await callAI(prompt, 'Sei un esperto di career coaching. Scrivi CV professionali in italiano. Sezioni in MAIUSCOLO. Solo testo CV, nessun commento.')
      const nome = `CV ${formData.nome} ${formData.cognome} ${new Date().toLocaleDateString('it-IT')}`
      await supabase.from('cv_versions').insert({ user_id: user.id, nome_versione: nome, testo: res })
      await supabase.from('profiles').upsert({ user_id: user.id, cv_testo: res, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      setShowForm(false)
      setMessage({ type: 'success', text: 'CV generato e salvato!' })
      loadData()
    } catch { setMessage({ type: 'error', text: 'Errore generazione. Riprova.' }) }
    setGeneratingFromForm(false)
  }

  const openEdit = (v) => {
    setEditingVersion(v)
    setEditingTesto(v.testo)
    setShowDetail(false)
  }

  const saveEdit = async () => {
    if (!editingVersion || !editingTesto.trim()) return
    setSavingEdit(true)
    await supabase.from('cv_versions').update({ testo: editingTesto.trim() }).eq('id', editingVersion.id)
    setSavingEdit(false)
    setEditingVersion(null)
    setEditingTesto('')
    setMessage({ type: 'success', text: 'Modifiche salvate!' })
    loadData()
  }


  const parseVersionToForm = async (version) => {
    setParsingCV(true)
    try {
      const prompt = 'Analizza questo CV e restituisci SOLO un JSON valido con questa struttura: {"nome":"","cognome":"","titolo":"","telefono":"","email":"","citta":"","patente":"","profilo":"","esperienze":[{"ruolo":"","azienda":"","periodo":"","punti":""}],"formazione":[{"titolo":"","istituto":"","anno":"","note":""}],"lingue":[{"lingua":"","livello":""}],"competenze":"","hobby":""}\n\nCV:\n' + version.testo
      const result = await callAI(prompt, 'Sei un assistente che estrae dati strutturati da CV. Rispondi SOLO con JSON valido, senza markdown.')
      const clean = result.replace(/```json|```/g, '').trim()
      const start = clean.indexOf('{')
      const end = clean.lastIndexOf('}')
      if (start !== -1 && end !== -1) {
        const parsed = JSON.parse(clean.substring(start, end + 1))
        setFormData({
          nome: parsed.nome || '',
          cognome: parsed.cognome || '',
          titolo: parsed.titolo || '',
          telefono: parsed.telefono || '',
          email: parsed.email || '',
          citta: parsed.citta || '',
          patente: parsed.patente || '',
          profilo: parsed.profilo || '',
          esperienze: parsed.esperienze?.length ? parsed.esperienze : [{ ruolo: '', azienda: '', periodo: '', punti: '' }],
          formazione: parsed.formazione?.length ? parsed.formazione : [{ titolo: '', istituto: '', anno: '', note: '' }],
          lingue: parsed.lingue?.length ? parsed.lingue : [{ lingua: '', livello: '' }],
          competenze: parsed.competenze || '',
          hobby: parsed.hobby || '',
        })
        setShowForm(true)
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Errore nel parsing. Usa il form vuoto.' })
      setShowForm(true)
    }
    setParsingCV(false)
  }


  const addToCV = async () => {
    setAddingSaving(true)
    let nuovoTesto = ''
    if (addMode === 'esperienza') {
      nuovoTesto = `${addData.ruolo || ''}${addData.azienda ? ' | ' + addData.azienda : ''}${addData.periodo ? ' | ' + addData.periodo : ''}\n${addData.punti || ''}`
    } else if (addMode === 'formazione') {
      nuovoTesto = `${addData.titolo || ''}${addData.istituto ? ' | ' + addData.istituto : ''}${addData.anno ? ' | ' + addData.anno : ''}${addData.note ? '\n' + addData.note : ''}`
    } else if (addMode === 'lingua') {
      nuovoTesto = `${addData.lingua || ''}${addData.livello ? ': ' + addData.livello : ''}`
    }

    const sezione = addMode === 'esperienza' ? 'ESPERIENZA LAVORATIVA' : addMode === 'formazione' ? 'FORMAZIONE' : 'LINGUE'
    const targets = addTargetId === 'all' ? versions : versions.filter(v => v.id === addTargetId)

    try {
      for (const version of targets) {
        const prompt = `Aggiungi questa nuova voce al CV nella sezione ${sezione}. Restituisci SOLO il CV completo aggiornato, senza commenti, mantenendo tutto il resto invariato.\n\nNuova voce: ${nuovoTesto}\n\nCV attuale:\n${version.testo}`
        const res = await callAI(prompt, 'Sei un esperto di career coaching. Integra la nuova voce nel CV. Solo testo CV, nessun commento.')
        await supabase.from('cv_versions').update({ testo: res }).eq('id', version.id)
      }
      setAddMode(null)
      setAddData({})
      setAddTargetId('all')
      const msg = targets.length > 1 ? `Aggiornati ${targets.length} CV!` : 'CV aggiornato!'
      setMessage({ type: 'success', text: msg })
      loadData()
    } catch (e) {
      setMessage({ type: 'error', text: 'Errore. Riprova.' })
    }
    setAddingSaving(false)
  }

  const analyzeCV = async () => {
    if (!selectedVersion) return
    setAnalyzing(true)
    setResult('')
    const prompts = {
      riscrivi: `Riscrivi questo CV in modo professionale. Restituisci SOLO il testo del CV riscritto, senza commenti. Inizia con il nome.\n\nREGOLE ASSOLUTE:\n- Mantieni TUTTE le sezioni (Formazione, Lingue, Competenze, ecc.)\n- Non perdere NESSUNA informazione\n- Sezioni in MAIUSCOLO\n- Profilo professionale concreto in apertura\n- Tono diretto e professionale\n\nCV:\n${selectedVersion.testo}`,
      analizza: `Analizza questo CV e fornisci feedback strutturato:\n1. PUNTI DI FORZA\n2. PUNTI CRITICI (con esempi concreti)\n3. AZIONI CONSIGLIATE\n\nCV:\n${selectedVersion.testo}`,
      aggiorna: `Aggiorna questo CV aggiungendo le nuove informazioni. REGOLE:\n- Restituisci il CV COMPLETO con TUTTE le sezioni originali intatte\n- Non perdere nessuna informazione già presente\n- Solo testo CV, nessun commento\n\nCV attuale:\n${selectedVersion.testo}\n\nNuove informazioni:\n${nuoveEsperienze}`,
      adatta: `Adatta questo CV per questa offerta specifica. REGOLE:\n- Mantieni TUTTE le sezioni originali\n- Solo testo CV, nessun commento\n\nCV:\n${selectedVersion.testo}\n\nOfferta:\n${offertaTesto}`
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
    } catch (e) { setMessage({ type: 'error', text: 'Errore download.' }) }
    setDownloading(false)
  }

  const deleteVersion = async (id) => {
    if (!confirm('Eliminare questa versione?')) return
    await supabase.from('cv_versions').delete().eq('id', id)
    if (selectedVersion?.id === id) setSelectedVersion(null)
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

      {/* Bottone crea CV */}
      {!showForm && !editingVersion && !addMode && (
        <div className="flex gap-3 mb-5">
          <button onClick={() => setShowForm(true)}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-white"
            style={{background:'#16a34a'}}>
            ✏️ Crea nuovo CV
          </button>
          {versions.length > 0 && (
            <button onClick={() => { setAddMode('esperienza'); setAddData({}) }}
              className="flex-1 py-3 rounded-xl text-sm font-medium"
              style={{background:'linear-gradient(135deg, var(--violet), var(--accent))',color:'white'}}>
              ➕ Aggiungi al CV
            </button>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium text-gray-700">Compila il CV</div>
            <button onClick={() => setShowForm(false)} className="text-gray-400 text-xs">✕ Annulla</button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome *</label>
                <input type="text" value={formData.nome} onChange={e => setFormData(f => ({...f, nome: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cognome *</label>
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">Profilo professionale</label>
              <textarea value={formData.profilo} onChange={e => setFormData(f => ({...f, profilo: e.target.value}))}
                placeholder="Descrivi brevemente chi sei e cosa sai fare..."
                rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>

            {/* Esperienze */}
            <div>
              <label className="block text-xs text-gray-700 font-medium mb-2">Esperienze lavorative</label>
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
                  <textarea placeholder="Attività svolte (una per riga)" value={esp.punti} rows={2}
                    onChange={e => { const n = [...formData.esperienze]; n[i].punti = e.target.value; setFormData(f => ({...f, esperienze: n})) }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs resize-none" />
                </div>
              ))}
              <button onClick={addEsperienza} className="text-blue-600 text-xs font-medium">+ Aggiungi esperienza</button>
            </div>

            {/* Formazione */}
            <div>
              <label className="block text-xs text-gray-700 font-medium mb-2">Formazione</label>
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
                  <input type="text" placeholder="Note (es. voto, certificazione)" value={f.note}
                    onChange={e => { const n = [...formData.formazione]; n[i].note = e.target.value; setFormData(fd => ({...fd, formazione: n})) }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              ))}
              <button onClick={addFormazione} className="text-blue-600 text-xs font-medium">+ Aggiungi formazione</button>
            </div>

            {/* Lingue */}
            <div>
              <label className="block text-xs text-gray-700 font-medium mb-2">Lingue</label>
              {formData.lingue.map((l, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" placeholder="Lingua" value={l.lingua}
                    onChange={e => { const n = [...formData.lingue]; n[i].lingua = e.target.value; setFormData(f => ({...f, lingue: n})) }}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                  <input type="text" placeholder="Livello" value={l.livello}
                    onChange={e => { const n = [...formData.lingue]; n[i].livello = e.target.value; setFormData(f => ({...f, lingue: n})) }}
                    className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                </div>
              ))}
              <button onClick={addLingua} className="text-blue-600 text-xs font-medium">+ Aggiungi lingua</button>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Competenze</label>
              <textarea value={formData.competenze} onChange={e => setFormData(f => ({...f, competenze: e.target.value}))}
                placeholder="es. Trucco cinematografico, Acconciature sposa, Airbrush makeup..."
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
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

      {/* Modifica versione */}
      {editingVersion && (
        <div className="bg-white rounded-xl border border-blue-300 p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">✏️ Modifica — {editingVersion.nome_versione}</div>
            <button onClick={() => { setEditingVersion(null); setEditingTesto('') }} className="text-gray-400 text-xs">✕ Annulla</button>
          </div>
          <textarea value={editingTesto} onChange={e => setEditingTesto(e.target.value)}
            rows={15} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3" />
          <button onClick={saveEdit} disabled={savingEdit}
            className="w-full bg-blue-600 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium">
            {savingEdit ? 'Salvataggio...' : '💾 Salva modifiche'}
          </button>
        </div>
      )}

      {/* Versioni salvate */}
      {versions.length > 0 && !showForm && !editingVersion && (
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
                  <button onClick={() => openEdit(v)}
                    className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium">✏️ Modifica</button>
                  <button onClick={() => deleteVersion(v.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}




      {/* Mini form aggiungi */}
      {addMode && (
        <div className="rounded-xl p-4 mb-4" style={{background:'var(--noir-card)',border:'1px solid var(--violet)'}}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium" style={{color:'var(--accent)'}}>➕ Aggiungi al CV</div>
            <button onClick={() => { setAddMode(null); setAddData({}) }} style={{color:'var(--text-muted)'}} className="text-xs">✕</button>
          </div>
          {/* Tipo */}
          <div className="flex gap-2 mb-3">
            {[['esperienza','Esperienza'],['formazione','Formazione'],['lingua','Lingua']].map(([m,l]) => (
              <button key={m} onClick={() => { setAddMode(m); setAddData({}) }}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                style={{background: addMode===m ? 'var(--violet)' : 'var(--noir-mid)', color: addMode===m ? 'white' : 'var(--text-muted)', border:'1px solid var(--noir-border)'}}>
                {l}
              </button>
            ))}
          </div>
          {/* Selezione CV target */}
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{color:'var(--text-muted)'}}>Aggiungi a</label>
            <select value={addTargetId} onChange={e => setAddTargetId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}}>
              <option value="all">Tutti i CV</option>
              {versions.map(v => <option key={v.id} value={v.id}>{v.nome_versione}</option>)}
            </select>
          </div>

          {addMode === 'esperienza' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Ruolo" value={addData.ruolo || ''}
                  onChange={e => setAddData(d => ({...d, ruolo: e.target.value}))}
                  className="border rounded-lg px-3 py-2 text-sm"
                  style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
                <input type="text" placeholder="Azienda" value={addData.azienda || ''}
                  onChange={e => setAddData(d => ({...d, azienda: e.target.value}))}
                  className="border rounded-lg px-3 py-2 text-sm"
                  style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
              </div>
              <input type="text" placeholder="Periodo (es. 10/2025 – Presente)" value={addData.periodo || ''}
                onChange={e => setAddData(d => ({...d, periodo: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
              <textarea placeholder="Descrizione attività" value={addData.punti || ''} rows={2}
                onChange={e => setAddData(d => ({...d, punti: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
            </div>
          )}

          {addMode === 'formazione' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Titolo/Diploma" value={addData.titolo || ''}
                  onChange={e => setAddData(d => ({...d, titolo: e.target.value}))}
                  className="border rounded-lg px-3 py-2 text-sm"
                  style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
                <input type="text" placeholder="Anno" value={addData.anno || ''}
                  onChange={e => setAddData(d => ({...d, anno: e.target.value}))}
                  className="border rounded-lg px-3 py-2 text-sm"
                  style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
              </div>
              <input type="text" placeholder="Istituto" value={addData.istituto || ''}
                onChange={e => setAddData(d => ({...d, istituto: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
              <input type="text" placeholder="Note (es. voto, certificazione)" value={addData.note || ''}
                onChange={e => setAddData(d => ({...d, note: e.target.value}))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
            </div>
          )}

          {addMode === 'lingua' && (
            <div className="flex gap-2">
              <input type="text" placeholder="Lingua" value={addData.lingua || ''}
                onChange={e => setAddData(d => ({...d, lingua: e.target.value}))}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
              <input type="text" placeholder="Livello (es. B2)" value={addData.livello || ''}
                onChange={e => setAddData(d => ({...d, livello: e.target.value}))}
                className="w-28 border rounded-lg px-3 py-2 text-sm"
                style={{background:'var(--noir-mid)',border:'1px solid var(--noir-border)',color:'var(--text-primary)'}} />
            </div>
          )}

          <button onClick={addToCV} disabled={addingSaving}
            className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{background:'linear-gradient(135deg, var(--violet), var(--accent))'}}>
            {addingSaving ? '⏳ Aggiornamento...' : '✓ Aggiorna e sostituisci'}
          </button>
          <p className="text-xs mt-1 text-center" style={{color:'var(--text-muted)'}}>Il CV verrà aggiornato e quello precedente eliminato</p>
        </div>
      )}

      {/* AI */}
      {selectedVersion && !showForm && !editingVersion && (
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
      {result && !showForm && !editingVersion && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-3">{aiMode === 'analizza' ? 'Analisi CV' : 'CV generato'}</div>
          <textarea value={result} onChange={e => setResult(e.target.value)}
            rows={12} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-3" />
          {aiMode !== 'analizza' && (
            <div className="flex gap-2 mb-3">
              <button onClick={() => downloadCV({ testo: result }, 'pdf')} disabled={downloading}
                className="flex-1 bg-red-50 text-red-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50">📥 PDF</button>
              <button onClick={() => downloadCV({ testo: result }, 'docx')} disabled={downloading}
                className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-sm font-medium disabled:opacity-50">📥 Word</button>
            </div>
          )}
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
      )}

      {/* Detail modale */}
      {showDetail && selectedVersion && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setShowDetail(false)}>
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedVersion.nome_versione}</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto mb-4">{selectedVersion.testo}</div>
            <div className="flex gap-3">
              <button onClick={() => openEdit(selectedVersion)}
                className="flex-1 bg-yellow-50 text-yellow-700 py-2.5 rounded-lg text-sm font-medium">✏️ Modifica</button>
              <button onClick={() => setShowDetail(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium">Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
