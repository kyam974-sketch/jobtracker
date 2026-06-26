import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/callAI'
import { useAuth } from '../context/AuthContext'

export default function MailPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [selectedApp, setSelectedApp] = useState(null)
  const [tipo, setTipo] = useState('candidatura')
  const [destinatario, setDestinatario] = useState({ nome: '', email: '', azienda: '', ruolo: '', testo_annuncio: '', url_azienda: '' })
  const [generating, setGenerating] = useState(false)
  const [fetchingAnnuncio, setFetchingAnnuncio] = useState(false)
  const [mailText, setMailText] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    setProfile(prof)
    const { data: apps } = await supabase.from('applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setApplications(apps || [])
  }

  const handleSelectApp = async (app) => {
    setSelectedApp(app)
    setDestinatario(d => ({ ...d, azienda: app.azienda, ruolo: app.ruolo || '' }))

    // Auto-fetch testo annuncio se c'è un URL
    if (app.url_offerta) {
      setFetchingAnnuncio(true)
      try {
        const res = await fetch('/api/fetch-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: app.url_offerta })
        })
        const data = await res.json()
        if (data.text) {
          setDestinatario(d => ({ ...d, testo_annuncio: data.text.substring(0, 3000) }))
        }
      } catch (e) { /* ignora errori silenziosamente */ }
      setFetchingAnnuncio(false)
    }
  }


  const fetchAziendaInfo = async () => {
    if (!destinatario.url_azienda) return
    setFetchingAnnuncio(true)
    try {
      const res = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: destinatario.url_azienda })
      })
      const data = await res.json()
      if (data.text) {
        setDestinatario(d => ({ ...d, testo_annuncio: 'Info dal sito aziendale: ' + data.text.substring(0, 2000) }))
      }
    } catch (e) {}
    setFetchingAnnuncio(false)
  }

  const generateMail = async () => {
    setGenerating(true)
    setMailText('')
    setCopied(false)
    setSaved(false)

    const nome = (profile?.nome || '') + ' ' + (profile?.cognome || '')
    const esperienza = profile?.cv_testo ? '\n\nEsperienze dal CV:\n' + profile.cv_testo.substring(0, 1500) : ''
    const profiloTesto = profile ? `
Mittente: ${nome.trim()}
Telefono: ${profile.telefono || ''}
Settore: ${profile.settore || ''} — ${profile.sottosettore || ''}
Lingue: ${(profile.lingue || []).join(', ')}
Portfolio: ${profile.portfolio_url || ''}
Note: ${profile.note_profilo || ''}`.trim() : ''

    const contestoAzienda = destinatario.testo_annuncio
      ? '\n\nTesto offerta/note azienda:\n' + destinatario.testo_annuncio.substring(0, 2000)
      : ''

    const systemPrompt = `Sei un assistente che aiuta a scrivere mail di candidatura.
Scrivi in prima persona, in modo diretto e autentico. 
REGOLE RIGIDE:
- Non copiare frasi dall'annuncio
- Non usare entusiasmo artificiale ("sono appassionata", "mi affascina profondamente")
- Non dire mai "la vostra missione", "i vostri valori", "la vostra realtà"
- Niente formule preconfezionate da HR ("dinamica", "proattiva", "teamwork")
- Tono professionale ma umano, come se la persona scrivesse davvero
- Massimo 120 parole nel corpo
- Includi oggetto in cima
- Firma con nome e cognome + telefono se disponibile`

    const prompts = {
      candidatura: `Scrivi una mail di candidatura in italiano per:
${profiloTesto}
Destinatario: ${destinatario.nome ? destinatario.nome + ', ' : ''}${destinatario.azienda}${destinatario.ruolo ? ', posizione: ' + destinatario.ruolo : ''}${contestoAzienda}

La mail deve presentare il profilo in modo diretto, senza adulazione. Evidenzia 1-2 elementi concreti del profilo (incluse le esperienze reali se disponibili) rilevanti per il ruolo/azienda. Proponi un colloquio.${esperienza}`,

      followup: `Scrivi una mail di follow-up in italiano per:
${profiloTesto}
Azienda: ${destinatario.azienda}${destinatario.ruolo ? ', posizione: ' + destinatario.ruolo : ''}

Candidatura già inviata, nessuna risposta. Mail breve (max 60 parole nel corpo), diretta, senza pressione eccessiva.${esperienza}`,

      spontanea: `Scrivi una mail di candidatura spontanea in italiano per:
${profiloTesto}
Azienda: ${destinatario.azienda}${destinatario.nome ? ', referente: ' + destinatario.nome : ''}${contestoAzienda}

Presenta il profilo in modo conciso, spiega perché questa azienda specifica (usa le info disponibili, ma non essere servile). Proponi un colloquio conoscitivo.${esperienza}`
    }

    try {
      const result = await callAI(prompts[tipo], systemPrompt)
      setMailText(result)
    } catch (e) {
      setMailText('Errore nella generazione. Riprova.')
    }
    setGenerating(false)
  }

  const copyMail = () => {
    navigator.clipboard.writeText(mailText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openInMail = () => {
    const lines = mailText.split('\n')
    const oggettoLine = lines.find(l => l.toLowerCase().startsWith('oggetto:'))
    const oggetto = oggettoLine ? oggettoLine.replace(/^oggetto:\s*/i, '') : ''
    const corpo = oggettoLine ? lines.filter(l => l !== oggettoLine).join('\n').trim() : mailText
    const mailto = `mailto:${destinatario.email || ''}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`
    window.location.href = mailto
  }

  const saveMail = async () => {
    if (!selectedApp || !mailText) return
    await supabase.from('applications').update({ testo_mail: mailText }).eq('id', selectedApp.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Genera mail</h2>

      {/* Tipo mail */}
      <div className="flex rounded-lg bg-gray-100 p-1 mb-5">
        {[['candidatura','Candidatura'],['followup','Follow-up'],['spontanea','Spontanea']].map(([id, label]) => (
          <button key={id} onClick={() => setTipo(id)}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${tipo === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Collega candidatura */}
      {applications.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Collega a candidatura <span className="text-gray-400 font-normal">(carica l'annuncio in automatico)</span>
          </label>
          <select value={selectedApp?.id || ''}
            onChange={e => {
              const app = applications.find(a => a.id === e.target.value)
              if (app) { setDestinatario(d => ({...d, testo_annuncio: ''})); handleSelectApp(app) }
              else { setSelectedApp(null); setDestinatario({nome: '', email: '', azienda: '', ruolo: '', testo_annuncio: ''}) }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">-- Nessuna --</option>
            {applications.map(a => (
              <option key={a.id} value={a.id}>{a.azienda}{a.ruolo ? ` – ${a.ruolo}` : ''}</option>
            ))}
          </select>
          {fetchingAnnuncio && <div className="text-xs text-blue-500 mt-1">⏳ Caricamento annuncio...</div>}
        </div>
      )}

      {/* Dati destinatario */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 mb-5">
        <div className="text-sm font-medium text-gray-700">Destinatario</div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Azienda *</label>
          <input type="text" value={destinatario.azienda}
            onChange={e => setDestinatario(d => ({...d, azienda: e.target.value}))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome referente</label>
            <input type="text" value={destinatario.nome}
              onChange={e => setDestinatario(d => ({...d, nome: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ruolo cercato</label>
            <input type="text" value={destinatario.ruolo}
              onChange={e => setDestinatario(d => ({...d, ruolo: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email destinatario</label>
          <input type="email" value={destinatario.email}
            onChange={e => setDestinatario(d => ({...d, email: e.target.value}))}
            placeholder="hr@azienda.it"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sito / LinkedIn azienda <span className="text-gray-400">(per candidature spontanee)</span></label>
          <div className="flex gap-2">
            <input type="url" value={destinatario.url_azienda}
              onChange={e => setDestinatario(d => ({...d, url_azienda: e.target.value}))}
              placeholder="https://azienda.it o linkedin.com/company/..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={fetchAziendaInfo} disabled={fetchingAnnuncio || !destinatario.url_azienda}
              className="bg-purple-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap">
              {fetchingAnnuncio ? '⏳' : '🔍 Leggi'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Testo annuncio / note <span className="text-gray-400">(opzionale — caricato automaticamente se colleghi una candidatura)</span>
          </label>
          <textarea value={destinatario.testo_annuncio}
            onChange={e => setDestinatario(d => ({...d, testo_annuncio: e.target.value}))}
            placeholder="Incolla il testo dell'offerta o aggiungi note sull'azienda..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <button onClick={generateMail} disabled={generating || !destinatario.azienda}
        className="w-full bg-blue-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl mb-5 transition-colors">
        {generating ? '✨ Generazione in corso...' : '✨ Genera mail'}
      </button>

      {mailText && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">Mail generata</div>
            <div className="flex gap-2 flex-wrap justify-end">
              {selectedApp && (
                <button onClick={saveMail}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${saved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {saved ? '✓ Salvata' : 'Salva'}
                </button>
              )}
              <button onClick={openInMail}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700">
                📧 Apri in Mail
              </button>
              <button onClick={copyMail}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${copied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {copied ? '✓ Copiata' : 'Copia'}
              </button>
            </div>
          </div>
          <textarea value={mailText} onChange={e => setMailText(e.target.value)}
            rows={12}
            className="w-full text-sm text-gray-700 resize-none focus:outline-none" />
        </div>
      )}
    </div>
  )
}
