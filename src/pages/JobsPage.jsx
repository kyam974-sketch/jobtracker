import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/callAI'
import { useAuth } from '../context/AuthContext'

const SCORE_COLORS = {
  1: 'bg-green-500',
  2: 'bg-green-300',
  3: 'bg-yellow-400',
  4: 'bg-orange-400',
  5: 'bg-red-500',
}

const RISK_LABELS = {
  1: '✅ Affidabile',
  2: '🟢 Probabilmente ok',
  3: '🟡 Verificare',
  4: '🟠 Sospetta',
  5: '🔴 Evitare',
}

const ANALYSIS_PROMPT = (jobText, isDeep) => `Analizza questa offerta di lavoro e restituisci SOLO un JSON valido con questa struttura:
{
  "qualita": <numero 1-5 dove 1=ottima, 5=pessima>,
  "truffa": <numero 1-5 dove 1=affidabile, 5=probabile truffa>,
  "note": "<2-3 righe di commento sintetico>"
}

Criteri obbligatori da valutare:
- Presenza/assenza di RAL o range salariale (obbligatorio per legge - direttiva EU trasparenza retributiva): assenza abbassa qualità
- Presenza/assenza di tipo di contratto (indeterminato, determinato, ecc.): assenza abbassa qualità  
- Frasi come "stipendio in base alle capacità" o "retribuzione da definire" sono segnali negativi espliciti
- Descrizione troncata o vaga abbassa la qualità
- Segnali di truffa: richiesta di denaro, stipendi irrealistici, azienda non identificabile
${isDeep ? '- Questa è un\'analisi APPROFONDITA sul testo completo dell\'offerta: valuta con la massima precisione.' : '- ATTENZIONE: questa è un\'analisi RAPIDA su un\'anteprima parziale. Segnala nella nota se il testo sembra incompleto.'}

Offerta:
${jobText}`

export default function JobsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(null)
  const [scores, setScores] = useState({})
  const [detail, setDetail] = useState(null)
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [saved, setSaved] = useState({})
  const [message, setMessage] = useState(null)

  useEffect(() => { loadProfile() }, [user])

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile(data)
      setQuery(data.sottosettore || data.settore || '')
      setLocation(data.citta_target || '')
    }
  }

  const searchJobs = async (p = 1) => {
    setLoading(true)
    setMessage(null)
    setPage(p)
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, location, radius: profile?.raggio_km || 20, page: p })
      })
      const data = await response.json()
      if (data.error) {
        setMessage({ type: 'error', text: 'Errore nella ricerca: ' + data.error })
        setJobs([])
      } else {
        setJobs(data.results || [])
        setTotalCount(data.count || 0)
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Errore di connessione.' })
    }
    setLoading(false)
  }

  const analyzeJob = async (job, deep = false) => {
    setAnalyzing(job.id + (deep ? '_deep' : '_quick'))
    
    let jobText = `Titolo: ${job.title}\nAzienda: ${job.company?.display_name || 'non specificata'}\nSede: ${job.location?.display_name || ''}\nStipendio: ${job.salary_min ? job.salary_min + '-' + job.salary_max + ' EUR' : 'non specificato'}\nDescrizione: ${job.description}`

    if (deep) {
      try {
        const fetchRes = await fetch('/api/fetch-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: job.redirect_url })
        })
        const fetchData = await fetchRes.json()
        if (fetchData.text) {
          jobText = `Titolo: ${job.title}\nAzienda: ${job.company?.display_name || 'non specificata'}\nSede: ${job.location?.display_name || ''}\n\nTesto completo offerta:\n${fetchData.text}`
        }
      } catch (e) {
        console.error('Fetch job failed:', e)
        // fallback all'anteprima
      }
    }

    try {
      const result = await callAI(
        ANALYSIS_PROMPT(jobText, deep),
        'Sei un esperto di selezione del personale e diritto del lavoro italiano. Rispondi SOLO con JSON valido, senza markdown.'
      )
      const clean = result.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setScores(s => ({ ...s, [job.id]: { ...parsed, deep } }))
    } catch (e) {
      setScores(s => ({ ...s, [job.id]: { qualita: 3, truffa: 3, note: 'Analisi non disponibile.', deep } }))
    }
    setAnalyzing(null)
  }

  const saveJob = async (job) => {
    const score = scores[job.id]
    await supabase.from('job_cache').insert({
      user_id: user.id,
      titolo: job.title,
      azienda: job.company?.display_name || '',
      url: job.redirect_url,
      fonte: 'Adzuna',
      testo_offerta: job.description,
      score_qualita: score?.qualita || null,
      score_truffa: score?.truffa || null,
      salvata: true,
    })
    setSaved(s => ({ ...s, [job.id]: true }))
  }

  const addToApplications = async (job) => {
    await supabase.from('applications').insert({
      user_id: user.id,
      azienda: job.company?.display_name || 'Azienda non specificata',
      ruolo: job.title,
      url_offerta: job.redirect_url,
      fonte: 'Adzuna',
      stato: 'bozza',
      canale: 'email',
    })
    setMessage({ type: 'success', text: 'Aggiunta alle candidature!' })
    setTimeout(() => setMessage(null), 3000)
  }

  const ScoreBar = ({ score, label }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={`w-5 h-2 rounded-sm ${i <= score ? SCORE_COLORS[score] : 'bg-gray-200'}`} />
        ))}
      </div>
    </div>
  )

  const isAnalyzing = (jobId, type) => analyzing === jobId + (type === 'deep' ? '_deep' : '_quick')

  return (
    <div className="px-4 pt-4 pb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Cerca offerte</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ruolo / parole chiave</label>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="es. make-up artist, beauty advisor..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Città</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="es. Milano"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => searchJobs(1)} disabled={loading}
          className="w-full bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
          {loading ? '🔍 Ricerca in corso...' : '🔍 Cerca offerte'}
        </button>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm mb-4 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {totalCount > 0 && (
        <div className="text-xs text-gray-500 mb-3">{totalCount} offerte trovate — pagina {page}</div>
      )}

      <div className="space-y-3">
        {jobs.map(job => {
          const score = scores[job.id]
          return (
            <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm leading-tight">{job.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{job.company?.display_name || 'Azienda n.d.'}</div>
                  <div className="text-xs text-gray-400">{job.location?.display_name}</div>
                </div>
                {job.salary_min && (
                  <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg shrink-0">
                    €{Math.round(job.salary_min/1000)}k
                  </div>
                )}
              </div>

              {score && (
                <div className="space-y-1 mb-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {score.deep ? '🔍 Analisi approfondita' : '⚡ Analisi rapida'}
                    </span>
                  </div>
                  <ScoreBar score={score.qualita} label="Qualità" />
                  <ScoreBar score={score.truffa} label="Rischio" />
                  <div className="text-xs text-gray-500 mt-1">{RISK_LABELS[score.truffa]}</div>
                  {score.note && <div className="text-xs text-gray-600 mt-1 italic">{score.note}</div>}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setDetail(job)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                  Dettagli
                </button>
                {!score && (
                  <>
                    <button onClick={() => analyzeJob(job, false)}
                      disabled={!!analyzing}
                      className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium disabled:opacity-50">
                      {isAnalyzing(job.id, 'quick') ? '⏳...' : '⚡ Rapida'}
                    </button>
                    <button onClick={() => analyzeJob(job, true)}
                      disabled={!!analyzing}
                      className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium disabled:opacity-50">
                      {isAnalyzing(job.id, 'deep') ? '⏳...' : '🔍 Approfondita'}
                    </button>
                  </>
                )}
                {score && !score.deep && (
                  <button onClick={() => analyzeJob(job, true)}
                    disabled={!!analyzing}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium disabled:opacity-50">
                    {isAnalyzing(job.id, 'deep') ? '⏳...' : '🔍 Approfondisci'}
                  </button>
                )}
                <button onClick={() => addToApplications(job)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                  + Candidature
                </button>
                {!saved[job.id] ? (
                  <button onClick={() => saveJob(job)}
                    className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-medium">
                    💾 Salva
                  </button>
                ) : (
                  <span className="px-3 py-1.5 text-green-600 text-xs">✓ Salvata</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {jobs.length > 0 && (
        <div className="flex gap-3 mt-4 justify-center">
          {page > 1 && (
            <button onClick={() => searchJobs(page - 1)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600">
              ← Precedente
            </button>
          )}
          {jobs.length === 10 && (
            <button onClick={() => searchJobs(page + 1)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600">
              Successiva →
            </button>
          )}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end" onClick={() => setDetail(null)}>
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{detail.title}</h3>
            <div className="text-sm text-gray-600 mb-1">{detail.company?.display_name}</div>
            <div className="text-xs text-gray-400 mb-4">{detail.location?.display_name}</div>
            {detail.salary_min && (
              <div className="text-sm text-green-700 mb-3">
                Stipendio: €{detail.salary_min?.toLocaleString()} – €{detail.salary_max?.toLocaleString()}
              </div>
            )}
            <div className="text-sm text-gray-700 mb-4 leading-relaxed">{detail.description}</div>
            <div className="flex gap-3">
              <a href={detail.redirect_url} target="_blank" rel="noreferrer"
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium text-center">
                Apri offerta
              </a>
              <button onClick={() => setDetail(null)}
                className="px-4 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
