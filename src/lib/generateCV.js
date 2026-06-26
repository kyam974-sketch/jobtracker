import jsPDF from 'jspdf'

// Genera PDF del CV
export function generateCVPdf(cvTesto, profile, photoUrl = null) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const margin = 20
  const pageWidth = 210
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Font
  doc.setFont('helvetica')

  // Header con foto
  const headerY = y
  let textStartX = margin

  if (photoUrl) {
    try {
      doc.addImage(photoUrl, 'JPEG', margin, y, 30, 35)
      textStartX = margin + 35
    } catch (e) {}
  }

  // Nome
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  const nome = ((profile?.nome || '') + ' ' + (profile?.cognome || '')).trim()
  doc.text(nome || 'Nome Cognome', textStartX + 3, y + 10)

  // Settore
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  const settore = profile?.sottosettore || profile?.settori?.[0] || ''
  if (settore) doc.text(settore, textStartX + 3, y + 18)

  // Contatti
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  const contatti = [
    profile?.telefono,
    profile?.citta_target,
    profile?.portfolio_url
  ].filter(Boolean).join(' · ')
  if (contatti) doc.text(contatti, textStartX + 3, y + 25)

  y = Math.max(y + 40, headerY + 40)

  // Linea separatrice
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Corpo del CV
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(40, 40, 40)

  const linee = cvTesto.split('\n')
  for (const linea of linee) {
    const trimmed = linea.trim()
    if (!trimmed) { y += 3; continue }

    // Sezioni in grassetto (es. ESPERIENZA, FORMAZIONE, COMPETENZE)
    const isSezione = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 40
    if (isSezione) {
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 80, 160)
      doc.text(trimmed, margin, y)
      doc.setTextColor(40, 40, 40)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      y += 5
      doc.line(margin, y, pageWidth - margin, y)
      y += 4
      continue
    }

    // Testo normale con word wrap
    const wrappedLines = doc.splitTextToSize(linea, contentWidth)
    for (const wl of wrappedLines) {
      if (y > 280) { doc.addPage(); y = margin }
      doc.text(wl, margin, y)
      y += 5
    }
  }

  const nomeCognome = nome.replace(/ /g, '_') || 'CV'
  doc.save(`CV_${nomeCognome}.pdf`)
}

// Genera DOCX del CV
export async function generateCVDocx(cvTesto, profile) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } = await import('docx')

  const nome = ((profile?.nome || '') + ' ' + (profile?.cognome || '')).trim()
  const settore = profile?.sottosettore || profile?.settori?.[0] || ''
  const contatti = [profile?.telefono, profile?.citta_target, profile?.portfolio_url].filter(Boolean).join(' · ')

  const children = []

  // Header
  children.push(new Paragraph({
    children: [new TextRun({ text: nome || 'Nome Cognome', bold: true, size: 36, font: 'Arial' })],
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 }
  }))

  if (settore) children.push(new Paragraph({
    children: [new TextRun({ text: settore, size: 22, color: '555555', font: 'Arial' })],
    spacing: { after: 40 }
  }))

  if (contatti) children.push(new Paragraph({
    children: [new TextRun({ text: contatti, size: 18, color: '888888', font: 'Arial' })],
    spacing: { after: 200 }
  }))

  // Corpo CV
  const linee = cvTesto.split('\n')
  for (const linea of linee) {
    const trimmed = linea.trim()
    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 80 } }))
      continue
    }

    const isSezione = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 40
    if (isSezione) {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 22, color: '1E50A0', font: 'Arial' })],
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: 'single', size: 4, color: 'CCCCCC' } }
      }))
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: linea, size: 20, font: 'Arial' })],
        spacing: { after: 40 }
      }))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
      },
      children
    }]
  })

  const buffer = await Packer.toBlob(doc)
  const url = URL.createObjectURL(buffer)
  const a = document.createElement('a')
  const nomeCognome = nome.replace(/ /g, '_') || 'CV'
  a.href = url
  a.download = `CV_${nomeCognome}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// Suggerisci quale CV usare per un'offerta
export async function suggestBestCV(versions, offertaTesto) {
  if (!versions.length || !offertaTesto) return null

  const elenco = versions.map((v, i) => `${i + 1}. "${v.nome_versione}": ${v.testo?.substring(0, 200)}...`).join('\n')

  const { callAI } = await import('./callAI')
  const prompt = `Ho queste versioni del mio CV:
${elenco}

Offerta di lavoro:
${offertaTesto.substring(0, 1000)}

Quale versione del CV è più adatta per questa offerta? Rispondi SOLO con il numero (1, 2, 3...) senza altro testo.`

  try {
    const result = await callAI(prompt, 'Sei un esperto di selezione del personale. Rispondi SOLO con il numero della versione più adatta.')
    const num = parseInt(result.trim())
    if (num >= 1 && num <= versions.length) return versions[num - 1]
  } catch (e) {}
  return null
}
