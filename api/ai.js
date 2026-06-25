export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, systemPrompt } = req.body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  // Prova Claude prima
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt || 'Sei un assistente professionale.',
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (response.ok) {
      const data = await response.json()
      return res.status(200).json({ result: data.content[0].text, provider: 'claude' })
    }
  } catch (e) {
    console.error('Claude error:', e)
  }

  // Fallback Gemini
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: (systemPrompt ? systemPrompt + '\n\n' : '') + prompt }] }]
        })
      }
    )
    if (response.ok) {
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return res.status(200).json({ result: text, provider: 'gemini' })
    }
  } catch (e) {
    console.error('Gemini error:', e)
  }

  return res.status(500).json({ error: 'Entrambi i provider AI non disponibili.' })
}
