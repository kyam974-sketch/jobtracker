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
  const [destinatario, setDestinatario] = useState({ nome: '', email: '', azienda: '', ruolo: '', testo_annuncio: '' })
  const [generating, setGenerating] = useState(false)
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

  const handleSelectApp = (app) => {
    setSelectedApp(app)
    setDestinatario(d => ({ ...d, azienda: app.azienda, ruolo: app.ruolo || '' }))
  }

  const generateMail = async () => {
    setGenerating(true)
    setMailText('')
    setCopied(false)
    setSaved(false)

    const profiloTesto = profile ? `
Nome: ${profile.nome || ''} ${profile.cognome || ''}
Settore: ${profile.settore || ''} - ${profile.sottosettore || ''}
Lingue: ${(profile.lingue || []).join(', ')}
Portfolio: ${profile.portfolio_url || 'non specificato'}
Note: ${profile.note_profilo || ''}
    `.trim() : ''

    const contestoAzienda = destinatario.testo_annuncio
      ? `\n\nTesto annuncio / informazioni sull'azienda:\n${destinatario.testo_annuncio}`
      : ''

    const prompts = {
      candidatura: `Scrivi una mail di candidatura professionale in italiano.
Mittente: ${profiloTesto}
Destinatario: ${destinatario.nome ? 'Attenzione ' + destinatario.nome : 'Ufficio Risorse Umane'}, azienda ${destinatario.azienda}${destinatario.ruolo ? ', per la posizione: ' + destinatario.ruolo : ''}.
${destinatario.email ? 'Email: ' + destinatario.email : ''}${contestoAzienda}
La mail deve essere professionale, personalizzata per il settore/ruolo e per la specifica azienda, concisa (max 200 parole), con oggetto incluso.
Includi un riferimento al portfolio se disponibile. Adatta tono e contenuto alle caratteristiche dell'azienda se disponibili.`,

      followup: `Scrivi una mail di follow-up/sollecito professionale in italiano.
Mittente: ${profiloTesto}
Azienda: ${destinatario.azienda}${destinatario.ruolo ? ', posizione: ' + destinatario.ruolo : ''}${contestoAzienda}
Contesto: candidatura già inviata, nessuna risposta ricevuta.
La mail deve essere cortese, breve (max 100 parole), con oggetto incluso.`,

      spontanea: `Scrivi una mail di candidatura spontanea professionale in italiano.
Mittente: ${profiloTesto}
Azienda: ${destinatario.azienda}
${destinatario.nome ? 'Referente: ' + destinatario.nome : ''}${contestoAzienda}
La mail deve esprimere interesse genuino per l'azienda (usa le info disponibili per personalizzare), presentare brevemente il profilo, proporre un colloquio conoscitivo. Max 180 parole. Includi oggetto.`
    }

    const systemPrompt = `Sei un esperto di comunicazione professionale e ricerca lavoro. 
Scrivi mail efficaci, autentiche e personalizzate. 
Rispondi SOLO con il testo della mail (oggetto + corpo), senza spiegazioni aggiuntive.`

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

      {/* Collega candidatura esistente */}
      {applications.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Collega a candidatura (opzionale)</label>
          <select
            value={selectedApp?.id || ''}
            onChange={e => {
              const app = applications.find(a => a.id === e.target.value)
              if (app) handleSelectApp(app)
              else setSelectedApp(null)
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Nessuna --</option>
            {applications.map(a => (
              <option key={a.id} value={a.id}>{a.azienda}{a.ruolo ? ` – ${a.ruolo}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dati destinatario */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 mb-5">
        <div className="text-sm font-medium text-gray-700">Destinatario</div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Azienda *</label>
          <input type="text" value={destinatario.azienda}
            onChange={e => setDestinatario(d => ({...d, azienda: e.target.value}))}
            placeholder="es. Sephora Italia"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome referente</label>
            <input type="text" value={destinatario.nome}
              onChange={e => setDestinatario(d => ({...d, nome: e.target.value}))}
              placeholder="es. Dott.ssa Rossi"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ruolo cercato</label>
            <input type="text" value={destinatario.ruolo}
              onChange={e => setDestinatario(d => ({...d, ruolo: e.target.value}))}
              placeholder="es. MUA"
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
          <label className="block text-xs text-gray-500 mb-1">
            Testo annuncio / note sull'azienda <span className="text-gray-400">(opzionale)</span>
          </label>
          <textarea value={destinatario.testo_annuncio}
            onChange={e => setDestinatario(d => ({...d, testo_annuncio: e.target.value}))}
            placeholder="Incolla il testo dell'offerta o aggiungi note sull'azienda. La mail verrà adattata di conseguenza."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      {/* Genera */}
      <button onClick={generateMail} disabled={generating || !destinatario.azienda}
        className="w-full bg-blue-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl mb-5 transition-colors">
        {generating ? '✨ Generazione in corso...' : '✨ Genera mail'}
      </button>

      {/* Risultato */}
      {mailText && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">Mail generata</div>
            <div className="flex gap-2">
              {selectedApp && (
                <button onClick={saveMail}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${saved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {saved ? '✓ Salvata' : 'Salva'}
                </button>
              )}
              <button onClick={copyMail}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {copied ? '✓ Copiata' : 'Copia'}
              </button>
            </div>
          </div>
          <textarea
            value={mailText}
            onChange={e => setMailText(e.target.value)}
            rows={12}
            className="w-full text-sm text-gray-700 resize-none focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
