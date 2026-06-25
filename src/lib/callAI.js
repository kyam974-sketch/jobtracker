export async function callAI(prompt, systemPrompt = '') {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemPrompt })
  })
  if (!response.ok) throw new Error('Errore AI')
  const data = await response.json()
  return data.result
}
