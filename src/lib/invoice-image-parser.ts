import Tesseract from 'tesseract.js'
import type { C6InvoiceItem, C6ParseOutcome } from './invoice-csv-parser'

/**
 * Pre-processes an image to improve OCR accuracy:
 * - Increases contrast
 * - Converts to grayscale
 * - Sharpens text
 */
async function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!

      // Draw original
      ctx.drawImage(img, 0, 0)

      // Get image data and increase contrast
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const contrast = 50 // Increase contrast by 50%
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))

      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale first
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        // Apply contrast
        const newVal = Math.min(255, Math.max(0, factor * (gray - 128) + 128))
        data[i] = newVal     // R
        data[i + 1] = newVal // G
        data[i + 2] = newVal // B
      }

      ctx.putImageData(imageData, 0, 0)

      canvas.toBlob((blob) => {
        resolve(blob || new Blob())
      }, 'image/png')
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Runs OCR on a single image file and returns the extracted text.
 * Pre-processes the image for better accuracy, uses English+Portuguese languages.
 */
export async function extractTextFromImage(file: File): Promise<string> {
  const processedBlob = await preprocessImage(file)
  const { data } = await Tesseract.recognize(processedBlob, 'eng+por', {
    logger: () => {},
  })
  return data.text
}

/**
 * Runs OCR on multiple image files and returns combined text.
 * Processes images sequentially to avoid memory issues.
 */
export async function extractTextFromImages(
  files: File[],
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  const texts: string[] = []

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length)
    const text = await extractTextFromImage(files[i])
    texts.push(text)
  }

  return texts.join('\n')
}

/**
 * Parses a Brazilian decimal number string like "1.234,56" or "1234,56" to a number.
 */
function parseBrDecimal(value: string): number {
  if (!value) return NaN
  const trimmed = value.trim()
  const hasDot = trimmed.includes('.')
  const hasComma = trimmed.includes(',')

  if (hasDot && hasComma) {
    return parseFloat(trimmed.replace(/\./g, '').replace(',', '.'))
  } else if (hasComma && !hasDot) {
    return parseFloat(trimmed.replace(',', '.'))
  } else {
    return parseFloat(trimmed)
  }
}

/**
 * Infers the year for a given month number.
 * If the month is greater than the current month, assumes previous year.
 */
function inferYear(month: number): number {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  return month > currentMonth ? currentYear - 1 : currentYear
}

/** Month abbreviation mapping for Bradesco format */
const MONTH_MAP: Record<string, string> = {
  Jan: '01',
  Fev: '02',
  Mar: '03',
  Abr: '04',
  Mai: '05',
  Jun: '06',
  Jul: '07',
  Ago: '08',
  Set: '09',
  Out: '10',
  Nov: '11',
  Dez: '12',
}

/** Month abbreviations list for detection */
const MONTH_ABBREVS = Object.keys(MONTH_MAP)

/**
 * Detects the bank from OCR text.
 * - "Cartão final" (lowercase 'final') → C6
 * - "Final" (uppercase F) + month abbreviations → Bradesco
 * - Default to C6 if unclear
 */
function detectBank(text: string): 'C6' | 'Bradesco' | 'Riachuelo' {
  // Riachuelo: contains "RIACHUELO" in descriptions
  if (/RIACHUELO/i.test(text) && (/Titular/i.test(text) || /Total de gastos/i.test(text) || /Faturas/i.test(text))) return 'Riachuelo'

  // C6: contains "Cartão final" with lowercase 'final'
  if (/Cart[aã]o final/.test(text)) return 'C6'

  // Bradesco: contains "Final" (uppercase F) AND month abbreviations
  const hasUpperFinal = /Final\s+\d{4}/.test(text)
  const hasMonthAbbrev = MONTH_ABBREVS.some((m) =>
    new RegExp(`\\b${m}\\b`, 'i').test(text),
  )
  if (hasUpperFinal && hasMonthAbbrev) return 'Bradesco'

  // Bradesco: "Fatura do cartão" header (without "Cartão final" which is C6)
  if (/Fatura do cart[aã]o/i.test(text) && hasUpperFinal) return 'Bradesco'

  // Bradesco: "Lançamentos" section with "Final XXXX"
  if (/Lan[cç]amentos/i.test(text) && hasUpperFinal) return 'Bradesco'

  // Also detect Bradesco by month abbreviations alone on lines
  const lines = text.split(/\n/).map((l) => l.trim())
  for (const line of lines) {
    if (MONTH_ABBREVS.some((m) => m.toLowerCase() === line.toLowerCase())) {
      return 'Bradesco'
    }
  }

  // Default to C6
  return 'C6'
}

/**
 * Parses OCR text from C6 app screenshots.
 *
 * Format variations:
 *   1) DD/MM alone on line, then DESCRIPTION R$ VALUE on next line, then Cartão final XXXX
 *   2) DD/MM DESCRIPTION R$ VALUE all on one line (OCR joins them)
 *   3) DESCRIPTION R$ VALUE without date prefix — uses last known date context
 *
 * Skips negative values, estornos, pagamentos.
 */
function parseC6Text(text: string): C6InvoiceItem[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  const items: C6InvoiceItem[] = []

  const skipPatterns = [
    /^(Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro|Janeiro|Fevereiro|Março)/i,
    /Fatura do cart/i,
    /^Fatura aberta/i,
    /Subtotal/i,
    /^Valor$/i,
    /^Valor a pagar/i,
    /^Valor\s+R\$/i,
    /^Vence em/i,
    /^R\$ [\d.,]+$/,
    /^\d{2}:\d{2}/,
    /^</,
    /Em processamento/i,
    /Inclusao de Pagamento/i,
    /^Cart[aã]o virtual/i,
    /^Cart[aã]o \d{4}$/i,
    /^Gr[aá]fico de gastos/i,
    /^Detalhes da fatura/i,
    /^Lan[cç]amentos desta fatura/i,
    /^Melhor dia de compra/i,
    /^Antecipar$/i,
    /^Maio$/i,
    /^Junho$/i,
  ]

  const skipDescriptions = [
    /PAGAMENTO/i,
    /INCLUSAO DE PAGAMENTO/i,
    /ESTORNO/i,
    /CR[EÉ]DITO/i,
    /SUBTOTAL/i,
    /VALOR A PAGAR/i,
  ]

  let currentDay = '01'
  let currentMonth = '05'

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Skip known non-transaction lines
    if (skipPatterns.some((p) => p.test(line))) {
      i++
      continue
    }

    // Skip "Cartão final XXXX" lines that appear without a preceding transaction
    if (/^[Cc]art[aã]o\s+final\s+\d{4}/.test(line)) {
      i++
      continue
    }

    // Check for date line: DD/MM alone (OCR may read 0 as O)
    const dateOnlyMatch = line.match(/^([O0]?\d{1,2})\/([O0]?\d{1,2})\s*$/)
    if (dateOnlyMatch) {
      currentDay = dateOnlyMatch[1].replace(/O/g, '0').padStart(2, '0')
      currentMonth = dateOnlyMatch[2].replace(/O/g, '0').padStart(2, '0')
      i++

      // Next line should be: "DESCRIPTION R$ VALUE"
      if (i >= lines.length) break
      const descLine = lines[i]

      // Skip if next line is a skip pattern or another date
      if (skipPatterns.some((p) => p.test(descLine)) || /^[O0]?\d{1,2}\/[O0]?\d{1,2}\s*$/.test(descLine)) continue

      const valorMatch = descLine.match(/R\$\s*([-]?[\d.,]+)/)
      if (!valorMatch) {
        // Fallback: OCR may garble "R$" but the numeric value might still be readable
        // Look for a number pattern like "1324.82", "77,82", "1.324,82" etc.
        const numericFallback = descLine.match(/\b(\d+(?:[.,]\d{2,3})*[.,]\d{2})\b/)
        if (numericFallback) {
          const valorBrl = parseBrDecimal(numericFallback[1])
          if (valorBrl > 0 && !isNaN(valorBrl)) {
            // Extract description: everything before the numeric value
            let descricao = descLine.substring(0, descLine.indexOf(numericFallback[1])).trim()
            // Clean up garbled R$ prefix (like "Li", "Rá", "Rs")
            descricao = descricao.replace(/\s+\S{1,3}$/, '').trim()

            if (descricao && descricao.length >= 2 && !skipDescriptions.some((p) => p.test(descricao))) {
              i++
              let finalCartao = ''
              let parcela = 'Única'

              // Check for parcela in same line
              const afterValue = descLine.substring(descLine.indexOf(numericFallback[1]) + numericFallback[1].length)
              const inlineParcela = afterValue.match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/)
              if (inlineParcela) parcela = `${inlineParcela[1]}/${inlineParcela[2]}`

              if (i < lines.length) {
                const cm = lines[i].match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
                if (cm) { finalCartao = cm[1]; const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/); if (pm) parcela = `${pm[1]}/${pm[2]}`; i++ }
              }
              if (i < lines.length && /^[Pp]arcela/.test(lines[i])) {
                const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/); if (pm) parcela = `${pm[1]}/${pm[2]}`; i++
              }

              const monthNum = parseInt(currentMonth, 10)
              const year = inferYear(monthNum)
              items.push({
                dataCompra: `${year}-${currentMonth}-${currentDay}`,
                nomeCartao: '', finalCartao, categoriaC6: '', descricao, parcela,
                valorUsd: 0, cotacao: 0, valorBrl: Math.round(valorBrl * 100) / 100,
              })
              continue
            }
          }
        }
        // No R$ and no numeric fallback — just continue, date is set as context
        continue
      }

      const rawValue = valorMatch[1]
      i++

      // Skip negative values
      if (rawValue.startsWith('-')) {
        if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
        continue
      }

      const valorBrl = parseBrDecimal(rawValue)
      let descricao = descLine.substring(0, descLine.indexOf('R$')).trim()

      if (!descricao || descricao.length < 2) continue
      if (skipDescriptions.some((p) => p.test(descricao))) {
        if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
        continue
      }

      let finalCartao = ''
      let parcela = 'Única'

      // Check for parcela in the same line as the value
      const afterValue = descLine.substring(descLine.indexOf(rawValue) + rawValue.length)
      const inlineParcela = afterValue.match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/)
      if (inlineParcela) {
        parcela = `${inlineParcela[1]}/${inlineParcela[2]}`
      }

      // Check next line for "Cartão final XXXX"
      if (i < lines.length) {
        const cartaoMatch = lines[i].match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
        if (cartaoMatch) {
          finalCartao = cartaoMatch[1]
          const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/)
          if (pm) parcela = `${pm[1]}/${pm[2]}`
          i++
        }
      }
      // Check for parcela on separate line
      if (i < lines.length && /^[Pp]arcela/.test(lines[i])) {
        const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/)
        if (pm) parcela = `${pm[1]}/${pm[2]}`
        i++
      }

      if (valorBrl <= 0 || isNaN(valorBrl)) continue

      const monthNum = parseInt(currentMonth, 10)
      const year = inferYear(monthNum)
      items.push({
        dataCompra: `${year}-${currentMonth}-${currentDay}`,
        nomeCartao: '', finalCartao, categoriaC6: '', descricao, parcela,
        valorUsd: 0, cotacao: 0, valorBrl: Math.round(valorBrl * 100) / 100,
      })
      continue
    }

    // Check for inline: "DD/MM DESCRIPTION R$ VALUE" (OCR may read 0 as O)
    const inlineMatch = line.match(/^([O0]?\d{1,2})\/([O0]?\d{1,2})\s+(.+?)\s+R\$\s*([-]?[\d.,]+)/)
    if (inlineMatch) {
      currentDay = inlineMatch[1].replace(/O/g, '0').padStart(2, '0')
      currentMonth = inlineMatch[2].replace(/O/g, '0').padStart(2, '0')
      const rawValue = inlineMatch[4]
      let descricao = inlineMatch[3].trim()
      i++

      if (rawValue.startsWith('-') || skipDescriptions.some((p) => p.test(descricao))) {
        if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
        continue
      }

      const valorBrl = parseBrDecimal(rawValue)
      let finalCartao = ''
      let parcela = 'Única'

      if (i < lines.length) {
        const cm = lines[i].match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
        if (cm) { finalCartao = cm[1]; const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/); if (pm) parcela = `${pm[1]}/${pm[2]}`; i++ }
      }
      if (i < lines.length && /^[Pp]arcela/.test(lines[i])) {
        const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/); if (pm) parcela = `${pm[1]}/${pm[2]}`; i++
      }

      if (valorBrl > 0 && !isNaN(valorBrl) && descricao.length >= 2) {
        const monthNum = parseInt(currentMonth, 10)
        const year = inferYear(monthNum)
        items.push({
          dataCompra: `${year}-${currentMonth}-${currentDay}`,
          nomeCartao: '', finalCartao, categoriaC6: '', descricao, parcela,
          valorUsd: 0, cotacao: 0, valorBrl: Math.round(valorBrl * 100) / 100,
        })
      }
      continue
    }

    // Fallback: line has "DESCRIPTION R$ VALUE" without date prefix
    // Only accept if next line confirms it's a transaction (contains "Cartão final")
    const fallbackMatch = line.match(/^(.+?)\s+R\$\s*([-]?[\d.,]+)/)
    if (fallbackMatch) {
      const rawValue = fallbackMatch[2]
      let descricao = fallbackMatch[1].trim()
      i++

      if (rawValue.startsWith('-') || skipDescriptions.some((p) => p.test(descricao))) {
        if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
        continue
      }

      if (!descricao || descricao.length < 2) continue
      if (skipPatterns.some((p) => p.test(descricao))) continue

      // Only accept if next line is "Cartão final XXXX"
      if (i < lines.length && /[Cc]art[aã]o\s+final\s+\d{4}/.test(lines[i])) {
        const valorBrl = parseBrDecimal(rawValue)
        let finalCartao = ''
        let parcela = 'Única'

        // Check for parcela in the same line as the value
        const afterValue = line.substring(line.indexOf(rawValue) + rawValue.length)
        const inlineParcela = afterValue.match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/)
        if (inlineParcela) {
          parcela = `${inlineParcela[1]}/${inlineParcela[2]}`
        }

        const cm = lines[i].match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
        if (cm) { finalCartao = cm[1]; const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/); if (pm) parcela = `${pm[1]}/${pm[2]}`; i++ }

        if (i < lines.length && /^[Pp]arcela/.test(lines[i])) {
          const pm = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/); if (pm) parcela = `${pm[1]}/${pm[2]}`; i++
        }

        if (valorBrl > 0 && !isNaN(valorBrl)) {
          const monthNum = parseInt(currentMonth, 10)
          const year = inferYear(monthNum)
          items.push({
            dataCompra: `${year}-${currentMonth}-${currentDay}`,
            nomeCartao: '', finalCartao, categoriaC6: '', descricao, parcela,
            valorUsd: 0, cotacao: 0, valorBrl: Math.round(valorBrl * 100) / 100,
          })
        }
      }
      continue
    }

    i++
  }

  return items
}

/**
 * Parses OCR text from Bradesco app screenshots.
 *   "O9 eo RIACHUELO 331 R$ 69,99 >"
 *   "O1 e sHOPPINGCNA R$ 66,55 >"
 *   "O9l e Wellhub Gustavo Pereira d R$ 99,99 >"
 *   "O8 o EBN*SPOTIFY R$ 40,90 >"
 *   "25 o JIMCOMXDCOSMETICOS R$ 260,10 >"
 *   "11 e ATACADAO 938 AS R$ 427,98 >"
 *
 * Pattern: [optional day][bullet chars] DESCRIPTION R$ VALUE [>] [month]
 *
 * Also standalone day/month lines that set context for subsequent transactions.
 */
function parseBradescoText(text: string): C6InvoiceItem[] {
  const items: C6InvoiceItem[] = []
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)

  const skipDescriptions = [
    /SALDO ANTERIOR/i,
    /Total/i,
    /Resumo/i,
    /Gustavo P Paiva/i,
    /Lan[cç]amentos/i,
    /Busque por nome/i,
    /Cart[oõ]es da fatura/i,
    /Voltar ao topo/i,
    /Consulte/i,
    /Conhe[cç]a/i,
    /Valor pago/i,
    /Fatura/i,
    /Final\s+\d{4}/i,
    /PAGTO/i,
    /POR DEB/i,
    /Vencimento/i,
    /Parcelar/i,
    /^Data\b/i,
    /^Descri/i,
    /^Valor$/i,
  ]

  let currentDay = '01'
  let currentMonth = '05' // Default May

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Try to match a transaction line: anything with R$ and a positive value
    // Main regex: captures everything before R$ as raw description, and the value after
    // Value can contain digits, dots, commas, and slashes (OCR reads comma as slash sometimes)
    const valueMatch = line.match(/^(.+?)\s+R\$\s*([-]?[\d.,/]+)\s*>?\s*(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)?\s*$/i)

    if (!valueMatch) {
      // Not a transaction line — check if it's a day or month marker
      const dayMonthMatch = line.match(/^[O0]?(\d{1,2})\s+(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\s*$/i)
      if (dayMonthMatch) {
        const dayNum = parseInt(dayMonthMatch[1], 10)
        if (dayNum >= 1 && dayNum <= 31) currentDay = dayNum.toString().padStart(2, '0')
        const monthKey = Object.keys(MONTH_MAP).find((m) => m.toLowerCase() === dayMonthMatch[2].toLowerCase())
        if (monthKey) currentMonth = MONTH_MAP[monthKey]
        continue
      }

      const dayOnlyMatch = line.match(/^[O0]?(\d{1,2})\s*$/)
      if (dayOnlyMatch) {
        const dayNum = parseInt(dayOnlyMatch[1], 10)
        if (dayNum >= 1 && dayNum <= 31) currentDay = dayNum.toString().padStart(2, '0')
        continue
      }

      const monthOnlyMatch = line.match(/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\s*$/i)
      if (monthOnlyMatch) {
        const monthKey = Object.keys(MONTH_MAP).find((m) => m.toLowerCase() === monthOnlyMatch[1].toLowerCase())
        if (monthKey) currentMonth = MONTH_MAP[monthKey]
        continue
      }

      continue
    }

    let rawDesc = valueMatch[1].trim()
    let rawValue = valueMatch[2]
    const trailingMonth = valueMatch[3]

    // Skip negative values
    if (rawValue.startsWith('-')) continue

    // Handle OCR reading comma as slash: "260/10" → "260,10"
    rawValue = rawValue.replace(/\//, ',')

    const valorBrl = parseBrDecimal(rawValue)
    if (isNaN(valorBrl) || valorBrl <= 0) continue

    // Extract day from the beginning of the description if present
    // Patterns: "O9 eo", "11 e", "O8 o", "25 o", "O7 e", "O9l e", "O9| e"
    const dayPrefixMatch = rawDesc.match(/^[O0]?(\d{1,2})[)l|I\]]*\s*(?:[eo]{1,2}|[●•·é])\s+(.+)$/i)
    if (dayPrefixMatch) {
      const dayNum = parseInt(dayPrefixMatch[1], 10)
      if (dayNum >= 1 && dayNum <= 31) {
        currentDay = dayNum.toString().padStart(2, '0')
      }
      rawDesc = dayPrefixMatch[2].trim()
    } else {
      // Try simpler prefix: just bullet without day number
      // "e DESCRIPTION", "o DESCRIPTION", "eo DESCRIPTION", "● DESCRIPTION"
      rawDesc = rawDesc.replace(/^[●•·°.,-]+\s*/, '').trim()
      rawDesc = rawDesc.replace(/^[SIl]?\s*[eo]{1,2}\s+/i, '').trim()
      rawDesc = rawDesc.replace(/^[éè]\s+/i, '').trim()
      // Remove standalone day number prefix without bullet
      rawDesc = rawDesc.replace(/^[O0]?\d{1,2}\s+/, '').trim()
    }

    // Update month from trailing month abbreviation if present
    if (trailingMonth) {
      const monthKey = Object.keys(MONTH_MAP).find((m) => m.toLowerCase() === trailingMonth.toLowerCase())
      if (monthKey) currentMonth = MONTH_MAP[monthKey]
    }

    // Final description cleanup
    let descricao = rawDesc
    if (!descricao || descricao.length < 3) continue

    // Skip known non-transaction descriptions
    if (skipDescriptions.some((p) => p.test(descricao))) continue

    // Check next line for parcela
    let parcela = 'Única'
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      const parcelaMatch = nextLine.match(/[Pp]arcela\s+(\d+)\s+de\s+(\d+)/)
      if (parcelaMatch) {
        parcela = `${parcelaMatch[1]}/${parcelaMatch[2]}`
        i++ // Skip parcela line
      }
    }

    const monthNum = parseInt(currentMonth, 10)
    const year = inferYear(monthNum)
    const dataCompra = `${year}-${currentMonth}-${currentDay}`

    items.push({
      dataCompra,
      nomeCartao: '',
      finalCartao: '',
      categoriaC6: '',
      descricao,
      parcela,
      valorUsd: 0,
      cotacao: 0,
      valorBrl: Math.round(valorBrl * 100) / 100,
    })
  }

  // Deduplicate: screenshots overlap, so the same transaction appears multiple times.
  // Use exact match on normalized description + value.
  // Normalize: lowercase, remove all non-alphanumeric chars.
  const uniqueItems: C6InvoiceItem[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const norm = item.descricao.toLowerCase().replace(/[^a-z0-9]/g, '')
    const key = `${norm}|${item.valorBrl}|${item.parcela}`
    if (seen.has(key)) continue
    seen.add(key)
    uniqueItems.push(item)
  }

  return uniqueItems
}

/**
 * Parses OCR text from Riachuelo app screenshots.
 *
 * Format:
 *   DESCRIÇÃO                    R$ VALOR
 *   DD/mês                         (X/Y)  ← parcela optional
 *
 * Skip patterns: "Faturas", "Valor a pagar", "Vencimento", "Aberta",
 * "Todos os cartões", "Buscar lançamentos", "Titular", "Total de gastos"
 */
function parseRiachueloText(text: string): C6InvoiceItem[] {
  const items: C6InvoiceItem[] = []
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)

  const skipPatterns = [
    /^Faturas$/i,
    /^Valor a pagar/i,
    /^Vencimento/i,
    /^Aberta$/i,
    /^Todos os cart/i,
    /^Buscar lan/i,
    /^Titular/i,
    /^Total de gastos/i,
    /^Mar\s+\d{4}/i,
    /^Abr\s+\d{4}/i,
    /^Mai\s+\d{4}/i,
    /^Jun\s+\d{4}/i,
    /^\d{4}$/,
    /^R\$ [\d.,]+$/,
  ]

  /** Maps month abbreviations (lowercase) used in Riachuelo dates */
  const riachueloMonthMap: Record<string, string> = {
    jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
    jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip known non-transaction lines
    if (skipPatterns.some((p) => p.test(line))) continue

    // Look for a line with R$ value
    const valueMatch = line.match(/^(.+?)\s+R\$\s*([\d.,]+)\s*$/)
    if (!valueMatch) continue

    let descricao = valueMatch[1].trim()
    const rawValue = valueMatch[2]

    const valorBrl = parseBrDecimal(rawValue)
    if (isNaN(valorBrl) || valorBrl <= 0) continue

    // Skip if description is a header/summary
    if (!descricao || descricao.length < 3) continue
    if (skipPatterns.some((p) => p.test(descricao))) continue

    // Next line should be: "DD/mês" optionally with "(X/Y)" parcela
    let day = '01'
    let month = '05'
    let parcela = 'Única'

    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      // Match "DD/mês" format like "24/dez", "16/abr", "08/mai"
      const dateMatch = nextLine.match(/^(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i)
      if (dateMatch) {
        day = dateMatch[1].padStart(2, '0')
        const monthKey = dateMatch[2].toLowerCase()
        if (riachueloMonthMap[monthKey]) month = riachueloMonthMap[monthKey]
        i++ // consume date line

        // Check for parcela on same line: "(X/Y)" or "(1/2)"
        const parcelaMatch = nextLine.match(/\((\d+)\/(\d+)\)/)
        if (parcelaMatch) {
          parcela = `${parcelaMatch[1]}/${parcelaMatch[2]}`
        }
      } else {
        // Maybe parcela is on the next line without date
        const parcelaOnly = nextLine.match(/^\((\d+)\/(\d+)\)\s*$/)
        if (parcelaOnly) {
          parcela = `${parcelaOnly[1]}/${parcelaOnly[2]}`
          i++
        }
      }
    }

    const monthNum = parseInt(month, 10)
    const year = inferYear(monthNum)
    const dataCompra = `${year}-${month}-${day}`

    items.push({
      dataCompra,
      nomeCartao: '',
      finalCartao: '',
      categoriaC6: '',
      descricao,
      parcela,
      valorUsd: 0,
      cotacao: 0,
      valorBrl: Math.round(valorBrl * 100) / 100,
    })
  }

  return items
}

/**
 * Parses OCR text from invoice screenshots (C6, Bradesco, or Riachuelo).
 * Auto-detects the bank and applies the appropriate parser.
 */
export function parseInvoiceScreenshotText(text: string): C6ParseOutcome {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Nenhum texto extraído das imagens' }
  }

  // Debug: log OCR text
  console.log('[Screenshot Parser] Text length:', text.length)
  console.log('[Screenshot Parser] First 3000 chars:', text.substring(0, 3000))

  const banco = detectBank(text)
  console.log('[Screenshot Parser] Detected bank:', banco)

  const items = banco === 'C6' ? parseC6Text(text) : banco === 'Riachuelo' ? parseRiachueloText(text) : parseBradescoText(text)

  console.log('[Screenshot Parser] Items found:', items.length)
  items.forEach((item, idx) => console.log(`[Screenshot] Item ${idx}: ${item.descricao} = ${item.valorBrl} (${item.dataCompra})`))


  if (items.length === 0) {
    const bancoMsg = banco === 'C6'
      ? 'Verifique se as imagens são screenshots do app C6.'
      : banco === 'Riachuelo'
      ? 'Verifique se as imagens são screenshots do app Riachuelo.'
      : 'Verifique se as imagens são screenshots do app Bradesco.'
    return { success: false, error: `Nenhuma compra encontrada nas imagens. ${bancoMsg}` }
  }

  const totalBrl = items.reduce((sum, item) => sum + item.valorBrl, 0)

  return {
    success: true,
    data: {
      items,
      totalBrl: Math.round(totalBrl * 100) / 100,
      banco,
    },
  }
}

/**
 * Full pipeline: OCR multiple images then parse invoice screenshot text.
 * Auto-detects bank (C6 or Bradesco) from OCR output.
 */
export async function parseInvoiceScreenshots(
  files: File[],
  onProgress?: (current: number, total: number) => void,
): Promise<C6ParseOutcome> {
  const text = await extractTextFromImages(files, onProgress)
  return parseInvoiceScreenshotText(text)
}
