export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, location, category, radius = 20, page = 1 } = req.body
  if (!query && !category) return res.status(400).json({ error: 'Missing query' })

  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  try {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '10',
      page: String(page),
      where: location || 'Italy',
      distance: String(radius),
      content_type: 'application/json',
      ...(query && { what: query }),
      ...(category && { category }),
    })

    const url = `https://api.adzuna.com/v1/api/jobs/it/search/${page}?${params}`
    const response = await fetch(url)

    if (!response.ok) {
      const text = await response.text()
      console.error('Adzuna error:', text)
      return res.status(502).json({ error: 'Errore Adzuna', detail: text })
    }

    const data = await response.json()
    return res.status(200).json({
      results: data.results || [],
      count: data.count || 0,
      page
    })
  } catch (e) {
    console.error('Jobs API error:', e)
    return res.status(500).json({ error: 'Errore interno' })
  }
}
