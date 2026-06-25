export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'Missing url' })

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobTracker/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow'
    })

    if (!response.ok) {
      return res.status(502).json({ error: 'Impossibile raggiungere la pagina' })
    }

    const html = await response.text()

    // Estrai testo pulito rimuovendo HTML
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000) // limite ragionevole per Claude

    return res.status(200).json({ text })
  } catch (e) {
    console.error('Fetch job error:', e)
    return res.status(500).json({ error: 'Errore: ' + e.message })
  }
}
