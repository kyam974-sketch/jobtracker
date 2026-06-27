import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/callAI'
import { useAuth } from '../context/AuthContext'

export default function FormPrepPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const [selectedApp, setSelectedApp] = useState(null)
  const [azienda, setAzienda] = useState('')
  const [ruolo, setRuolo] = useState('')
  const [noteAzienda, setNoteAzienda] = useState('')
  const [generating, setGenerating] = useState(false)
  const [risposte, setRisposte] = useState(null)
  const [copied, setCopied] = useState({})
  const [message, setMessage] = useState(null)

  useEffect(() => { loadData() }, [user])

  const loadData = async () => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    setProfile(prof)
    const { data: apps } = await supabase.from('applications').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setApplications(apps || [])
  }

  const handleSelectApp = (app) => {
    setSelectedApp(app)
    setAzienda(app.azienda || '')
    setRuolo(app.ruolo || '')
  }

  const generate = async () => {
    setGenerating(true)
    setRisposte(null)

    const profiloTesto = profile ? `
Nome: ${profile.nome || ''} ${profile.cognome || ''}
Telefono: ${profile.telefono || ''}
Settore: ${profile.settore || ''} — ${profile.sottosettore || ''}
Lingue: ${(profile.lingue || []).join(', ')}
Portfolio: ${profile.portfolio_url || ''}
Note: ${profile.note_profilo || ''}
CV: ${profile.cv_testo?.substring(0, 2000) || ''}`.trim() : ''

    const prompt = `Genera risposte pronte per un form di candidatura online. Rispondi SOLO con un JSON valido con questa struttura:
{
  "presentazione": "testo pronto",
  "motivazione": "testo pronto",
  "punti_forza": "testo pronto",
  "disponibilita": "testo pronto",
  "aspettative": "testo pronto",
  "portfolio": "testo pronto"
}

Profilo candidata:
${profiloTesto}

Azienda: ${azienda}
Ruolo: ${ruolo}
${noteAzienda ? 'Note azienda: ' + noteAzienda : ''}

REGOLE:
- Tono diretto e professionale, non servile
- Risposte concise (2-4 righe ciascuna)
- Personalizzate per questa azienda e ruolo
- Prima persona singolare
- In italiano`

    try {
      const result = await callAI(prompt, 'Sei un esperto di ricerca lavoro. Genera risposte autentiche per form di candidatura. Rispondi SOLO con JSON valido.')
      const clean = result.replace(/```json|```/g, '').trim()
      const start = clean.indexOf('{')
      const end = clean.lastIndexOf('}')
      const parsed = JSON.parse(clean.substring(start, end + 1))
      setRisposte(parsed)
    } catch (e) {
      setMessage({ type: 'error', text: 'Errore nella generazione. Riprova.' })
    }
    setGenerating(false)
  }

  const copyField = (key, text) => {
    navigator.clipboard.writeText(text)
    setCopied(c => ({ ...c, [key]: true }))
    setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000)
  }

  const LABELS = {
    presentazione: { label: '👤 Presentazione', desc: 'Chi sei e la tua esperienza' },
    motivazione: { label: '💡 Motivazione', desc: 'Perché questa azienda/ruolo' },
    punti_forza: { label: '⭐ Punti di forza', desc: 'Le tue competenze chiave' },
    disponibilita: { label: '📅 Disponibilità', desc: 'Quando puoi iniziare' },
    aspettative: { label: '💰 Aspettative', desc: 'Retribuzione desiderata' },
    portfolio: { label: '🔗 Portfolio', desc: 'Link e riferimenti' },
  }

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold font-display mb-2" style={{ color: 'var(--text-primary)' }}>
        Prepara candidatura
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Genera risposte pronte per i form "Lavora con noi"
      </p>

      {/* Collega candidatura */}
      {applications.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Collega a candidatura esistente
          </label>
          <select value={selectedApp?.id || ''}
            onChange={e => {
              const app = applications.find(a => a.id === e.target.value)
              if (app) handleSelectApp(app)
              else { setSelectedApp(null); setAzienda(''); setRuolo('') }
            }}
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ background: 'var(--noir-mid)', border: '1px solid var(--noir-border)', color: 'var(--text-primary)' }}>
            <option value="">-- Nessuna --</option>
            {applications.map(a => (
              <option key={a.id} value={a.id}>{a.azienda}{a.ruolo ? ` – ${a.ruolo}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dati azienda */}
      <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Azienda *</label>
          <input type="text" value={azienda} onChange={e => setAzienda(e.target.value)}
            placeholder="es. Sephora Italia"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ background: 'var(--noir-mid)', border: '1px solid var(--noir-border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ruolo</label>
          <input type="text" value={ruolo} onChange={e => setRuolo(e.target.value)}
            placeholder="es. Beauty Advisor"
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ background: 'var(--noir-mid)', border: '1px solid var(--noir-border)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Note sull'azienda (opzionale)</label>
          <textarea value={noteAzienda} onChange={e => setNoteAzienda(e.target.value)}
            placeholder="Incolla info dall'annuncio o dal sito..."
            rows={3} className="w-full rounded-xl px-3 py-2 text-sm resize-none"
            style={{ background: 'var(--noir-mid)', border: '1px solid var(--noir-border)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {message && (
        <div className="rounded-xl px-4 py-3 text-sm mb-4"
          style={{ background: '#2E0A0A', border: '1px solid #6B1313', color: 'var(--red)' }}>
          {message.text}
        </div>
      )}

      <button onClick={generate} disabled={generating || !azienda.trim()}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 mb-6"
        style={{ background: 'linear-gradient(135deg, var(--violet), var(--accent))' }}>
        {generating ? '✨ Generazione in corso...' : '✨ Genera risposte'}
      </button>

      {/* Risposte */}
      {risposte && (
        <div className="space-y-3">
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Tocca 📋 per copiare ogni risposta
          </div>
          {Object.entries(LABELS).map(([key, { label, desc }]) => (
            risposte[key] ? (
              <div key={key} className="rounded-xl p-4"
                style={{ background: 'var(--noir-card)', border: '1px solid var(--noir-border)' }}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <button onClick={() => copyField(key, risposte[key])}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all"
                    style={{
                      background: copied[key] ? '#0A2E1E' : 'var(--noir-mid)',
                      color: copied[key] ? 'var(--green)' : 'var(--text-muted)',
                      border: `1px solid ${copied[key] ? '#0F5132' : 'var(--noir-border)'}`
                    }}>
                    {copied[key] ? '✓ Copiato' : '📋 Copia'}
                  </button>
                </div>
                <textarea
                  value={risposte[key]}
                  onChange={e => setRisposte(r => ({...r, [key]: e.target.value}))}
                  rows={3}
                  className="w-full text-sm leading-relaxed resize-none focus:outline-none rounded-lg p-2"
                  style={{ color: 'var(--text-primary)', background: 'var(--noir-mid)', border: '1px solid var(--noir-border)' }}
                />
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  )
}
