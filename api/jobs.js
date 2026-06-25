export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, location, radius = 20, page = 1 } = req.body
  if (!query) return res.status(400).json({ error: 'Missing query' })

  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '10',
      what: query,
      content_type: 'application/json',
    })

    if (location) params.append('where', location)
    if (radius) params.append('distance', String(radius))

    const url = `https://api.adzuna.com/v1/api/jobs/it/search/${page}?${params.toString()}`
    console.log('Adzuna URL:', url)

    const response = await fetch(url)
    const text = await response.text()

    if (!response.ok) {
      console.error('Adzuna error:', text)
      return res.status(502).json({ error: 'Errore Adzuna', detail: text.substring(0, 200) })
    }

    const data = JSON.parse(text)
    return res.status(200).json({
      results: data.results || [],
      count: data.count || 0,
      page
    })
  } catch (e) {
    console.error('Jobs API error:', e)
    return res.status(500).json({ error: 'Errore interno: ' + e.message })
  }
}
