# JobTracker — Specifica di progetto

App web per la gestione attiva della ricerca lavoro. Multi-utente, ogni account vede esclusivamente i propri dati. Progettata per essere generica e riutilizzabile da utenti con profili professionali diversi.

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Frontend | React + Tailwind CSS |
| Hosting | Vercel |
| Auth + Database | Supabase (progetto dedicato, separato dalle altre app) |
| AI primario | Claude API (Anthropic) — modello: claude-sonnet-4-6 |
| AI fallback | Gemini API (Google) |
| Ricerca offerte | Adzuna API (gratuita) + web search AI come fallback |

### Logica fallback AI

Tutte le chiamate AI passano per una funzione wrapper unica `callAI(prompt, systemPrompt)`:
1. Prova Claude
2. Se errore o timeout → ritenta automaticamente con Gemini con lo stesso prompt
3. L'utente non vede mai l'errore, vede solo il risultato

---

## Struttura database (Supabase)

Row Level Security (RLS) attiva su tutte le tabelle: ogni utente accede solo ai propri dati via `user_id`.

### `profiles`
Dati personali e preferenze di ricerca. Un record per utente.

```
user_id           uuid (FK → auth.users)
nome              text
cognome           text
settore           text          -- es. "beauty", "moda", "spettacolo", "tech"
sottosettore      text          -- es. "MUA freelance", "retail beauty", "teatro"
città_target      text
raggio_km         integer
lingue            text[]        -- es. ["italiano", "inglese C1", "spagnolo B2"]
portfolio_url     text
note_profilo      text          -- info extra da includere nelle mail AI
cv_testo          text          -- estratto testuale dall'ultimo CV caricato
```

### `cv_versions`
Storico versioni CV. Più versioni per utente (generica, adattata a offerta specifica, ecc.).

```
id                uuid
user_id           uuid
nome_versione     text          -- es. "CV generico", "CV per Sephora"
testo             text
data_creazione    timestamptz
```

### `applications`
Tracker candidature. Cuore dell'app.

```
id                uuid
user_id           uuid
azienda           text
ruolo             text
canale            text          -- "email" | "form" | "DM social" | "spontanea" | "agenzia"
url_offerta       text
fonte             text          -- "Adzuna" | "Indeed" | "manuale" | "spontanea"
data_offerta      date
data_invio        date
stato             text          -- "bozza" | "inviata" | "in attesa" | "risposta" | "rifiuto" | "colloquio"
note              text
solleciti_inviati integer       -- contatore follow-up inviati
prossimo_followup date          -- reminder automatico
testo_mail        text          -- mail generata dall'AI, archiviata
```

### `companies`
Rubrica aziende e agenzie salvate dall'utente.

```
id                uuid
user_id           uuid
nome              text
tipo              text          -- "azienda" | "agenzia" | "interinale"
settore           text
contatto_email    text
url               text
note              text
candidatura_spontanea boolean
```

### `job_cache`
Offerte trovate tramite API o ricerca AI. Cache locale per evitare duplicati e permettere il salvataggio.

```
id                uuid
user_id           uuid
titolo            text
azienda           text
url               text
fonte             text
testo_offerta     text
score_qualità     integer       -- 1-5, valutazione AI della pertinenza
score_truffa      integer       -- 1-5, valutazione AI del rischio (1=sicura, 5=sospetta)
salvata           boolean
scartata          boolean
data_trovata      timestamptz
```

---

## Sezioni dell'app

### 1. Dashboard
Panoramica attiva. Mostra:
- Candidature con follow-up in scadenza (entro 3/7 giorni)
- Nuove offerte trovate dall'ultima visita
- Contatori per stato (inviate, in attesa, colloqui, rifiuti)
- Accesso rapido alle sezioni principali

### 2. Profilo
Dati personali, settore, zona target, lingue, link portfolio.
Compilato una volta sola, alimenta automaticamente la generazione AI di mail e suggerimenti.

### 3. CV Manager
- Carica PDF → estrazione testo automatica
- Visualizza versioni salvate
- **"Migliora CV"**: Claude analizza il CV e suggerisce miglioramenti specifici per settore
- **"Adatta a offerta"**: incolla testo offerta → Claude genera versione CV ottimizzata per quella posizione
- Salva nuova versione con nome personalizzato

### 4. Cerca Offerte
- Ricerca automatica via Adzuna API filtrata per città/settore del profilo
- Ogni offerta mostra:
  - Barra colorata qualità (verde/giallo/rosso) basata su score AI
  - Indicatore rischio truffa (icona + colore)
  - Pulsanti: Salva / Scarta / Candidati
- Filtri manuali: ruolo, distanza, data, fonte
- Aggiornamento manuale o automatico (ogni N ore)

### 5. Aziende
Rubrica personale di aziende e agenzie di interesse.
- Aggiunta manuale o da offerta salvata
- Tag per tipo (azienda / agenzia / interinale)
- Pulsante "Candidatura spontanea" → avvia flusso generazione mail
- Lista precompilata di agenzie di settore suggerite in base al profilo (alimentata da AI)

### 6. Candidature
Tracker completo.
- Vista tabella con filtri per stato, data, canale
- Click su riga → dettaglio con note, mail inviata, storico follow-up
- Aggiornamento stato con un tap
- Reminder follow-up: notifica visiva in dashboard quando `prossimo_followup` si avvicina
- Export PDF del tracker (lista candidature con stati)

### 7. Genera Mail
- Seleziona destinatario (da Aziende o da Offerte)
- Seleziona versione CV da allegare/citare
- Claude genera mail personalizzata per settore, tono e destinatario
- Gemini come fallback automatico
- Modifica manuale prima dell'invio
- Salva nel record candidatura corrispondente

---

## Gestione candidature via form esterno

Quando un'offerta richiede registrazione su sito esterno, il pulsante **"Prepara candidatura"** apre un pannello con:
- Testo di presentazione pronto (generato da AI, copiabile con un click)
- Risposte precompilate alle domande tipiche (motivazione, disponibilità, ecc.)
- Link diretto al form esterno
- Dopo: prompt "Hai completato la candidatura?" → segna automaticamente nel tracker con stato "inviata" e data odierna

L'obiettivo è ridurre al minimo lo sforzo cognitivo per le candidature più faticose.

---

## Ordine di sviluppo consigliato

| Blocco | Contenuto | Note |
|---|---|---|
| 1 | Auth + Profilo | Base di tutto. Supabase Auth email. |
| 2 | Tracker candidature (manuale) | Subito utile, zero dipendenze esterne. |
| 3 | Genera Mail AI | Claude + fallback Gemini. |
| 4 | CV Manager | Upload PDF + miglioramento AI. |
| 5 | Cerca Offerte | Adzuna API + ranking AI. |
| 6 | Aziende + candidature spontanee | Rubrica + flusso mail. |
| 7 | Dashboard | Aggrega tutto, si fa per ultima. |
| 8 | Export PDF tracker | Funzionalità accessoria. |

---

## Variabili d'ambiente necessarie (Vercel)

```
SUPABASE_URL
SUPABASE_ANON_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
ADZUNA_APP_ID
ADZUNA_APP_KEY
```

---

## Repository GitHub

Da creare: `kyam974-sketch/jobtracker` (o nome a scelta)
Struttura consigliata:

```
/
├── README.md           ← questo file
├── /src
│   ├── /components
│   ├── /pages
│   ├── /lib
│   │   ├── supabase.js
│   │   ├── callAI.js   ← wrapper Claude/Gemini
│   │   └── adzuna.js
│   └── /styles
├── /api                ← serverless functions Vercel (proxy API key)
│   ├── claude.js
│   ├── gemini.js
│   └── adzuna.js
└── .env.local
```

---

*Documento aggiornato: giugno 2026*
