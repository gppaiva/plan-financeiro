import Tesseract from 'tesseract.js'
import type { C6InvoiceItem, C6ParseOutcome } from './invoice-csv-parser'

/**
 * Runs OCR on a single image file and returns the extracted text.
 * Uses Tesseract.js with Portuguese language.
 */
export async function extractTextFromImage(file: File): Promise<string> {
  const { data } = await Tesseract.recognize(file, 'por', {
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
function detectBank(text: string): 'C6' | 'Bradesco' {
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
 * Format:
 *   DD/MM                        ← date alone on line
 *   DESCRIPTION R$ VALUE         ← description + value on same line
 *   Cartão final XXXX            ← card number on next line
 *
 * Skips negative values (payments like "Inclusao de Pagamento R$ -3.361,67")
 * Skips "Valor", "Vence em", "Subtotal", "Fatura do cartão", timestamps, month names
 */
function parseC6Text(text: string): C6InvoiceItem[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  const items: C6InvoiceItem[] = []

  const skipPatterns = [
    /^(Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro|Janeiro|Fevereiro|Março)/i,
    /Fatura do cart/i,
    /Subtotal/i,
    /^Valor$/i,
    /^Vence em/i,
    /^R\$ [\d.,]+$/,
    /^\d{2}:\d{2}/,
    /^</,
    /Em processamento/i,
    /Inclusao de Pagamento/i,
  ]

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Skip known non-transaction lines
    if (skipPatterns.some((p) => p.test(line))) {
      i++
      continue
    }

    // Look for a date line: DD/MM alone
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\s*$/)
    if (!dateMatch) {
      i++
      continue
    }

    const day = dateMatch[1]
    const month = dateMatch[2]
    i++

    // Next line should be: "DESCRIPTION R$ VALUE"
    if (i >= lines.length) break
    const descLine = lines[i]
    i++

    // Try to extract R$ value from the description line
    const valorMatch = descLine.match(/R\$\s*([-]?[\d.,]+)/)
    let valorBrl = 0
    let descricao = descLine
    let finalCartao = ''
    let parcela = 'Única'

    if (valorMatch) {
      const rawValue = valorMatch[1]
      // Skip negative values (payments/credits)
      if (rawValue.startsWith('-')) {
        if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
        continue
      }
      valorBrl = parseBrDecimal(rawValue)
      descricao = descLine.substring(0, descLine.indexOf('R$')).trim()
    }

    // Skip if description is empty or looks like a header
    if (!descricao || descricao.length < 2) continue

    // Skip payment/credit descriptions
    const upperDesc = descricao.toUpperCase()
    if (
      upperDesc.includes('PAGAMENTO') ||
      upperDesc.includes('INCLUSAO DE PAGAMENTO') ||
      upperDesc.includes('ESTORNO') ||
      upperDesc.includes('CRÉDITO') ||
      upperDesc.includes('CREDITO')
    ) {
      if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
      continue
    }

    // Check next line for "Cartão final XXXX"
    if (i < lines.length) {
      const cartaoLine = lines[i]
      const cartaoMatch = cartaoLine.match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
      if (cartaoMatch) {
        finalCartao = cartaoMatch[1]
        if (valorBrl === 0) {
          const cartaoValorMatch = cartaoLine.match(/R\$\s*([\d.,]+)/)
          if (cartaoValorMatch) {
            valorBrl = parseBrDecimal(cartaoValorMatch[1])
          }
        }
        const parcelaMatch = cartaoLine.match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/)
        if (parcelaMatch) {
          parcela = `${parcelaMatch[1]}/${parcelaMatch[2]}`
        }
        i++
      }
    }

    // Check next line for parcela info (sometimes on separate line)
    if (i < lines.length) {
      const parcelaMatch = lines[i].match(/[Pp]arcela[s]?\s+(\d+)\s+de\s+(\d+)/)
      if (parcelaMatch) {
        parcela = `${parcelaMatch[1]}/${parcelaMatch[2]}`
        i++
      }
    }

    if (valorBrl <= 0 || isNaN(valorBrl)) continue

    const monthNum = parseInt(month, 10)
    const year = inferYear(monthNum)
    const dataCompra = `${year}-${month}-${day}`

    items.push({
      dataCompra,
      nomeCartao: '',
      finalCartao,
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
 * Parses OCR text from Bradesco app screenshots.
 *
 * Real format from Bradesco app:
 *   DD                            ← day number (bold, on its own or with month)
 *   Mês                           ← month abbreviation (Abr, Mai, Jun, etc.)
 *     ● DESCRIPTION         R$ VALUE  >
 *     Parcela X de Y (optional, on next line)
 *
 * Multiple transactions on same day share the date header.
 * The parser works line-by-line tracking the current day/month context.
 */
function parseBradescoText(text: string): C6InvoiceItem[] {
  const items: C6InvoiceItem[] = []
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)

  const skipPatterns = [
    /SALDO ANTERIOR/i,
    /Total de lan/i,
    /Resumo da fatura/i,
    /Total da fatura/i,
    /Gustavo P Paiva/i,
    /Data\s+Descri/i,
    /Lan[cç]amentos/i,
    /Busque por nome/i,
    /Cart[oõ]es da fatura/i,
    /Voltar ao topo/i,
    /Consulte o hist/i,
    /Conhe[cç]a as taxas/i,
    /Valor pago/i,
    /Fatura do cart/i,
    /Final\s+\d{4}/i,
    /PAGTO/i,
    /POR DEB/i,
    /Fatura fechada/i,
    /Fatura em d[eé]bito/i,
    /Vencimento/i,
    /Ver em PDF/i,
    /Parcelar/i,
    /Total da fatura anterior/i,
    /Lan[cç]amentos nacionais/i,
    /Lan[cç]amentos internacionais/i,
    /Valor pago.*cr[eé]ditos/i,
    /Cart[oõ]es da fatura/i,
    /R\$\s*0,00\s*$/,
  ]

  let currentDay = '01'
  let currentMonth = '05' // Default May

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip known non-transaction lines
    if (skipPatterns.some((p) => p.test(line))) continue

    // Detect day + month on same line: "07 Mai" or "25 Abr"
    const dayMonthMatch = line.match(/^[O0]?(\d{1,2})\s+(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\s*$/i)
    if (dayMonthMatch) {
      const dayNum = parseInt(dayMonthMatch[1], 10)
      if (dayNum >= 1 && dayNum <= 31) {
        currentDay = dayNum.toString().padStart(2, '0')
      }
      const monthKey = Object.keys(MONTH_MAP).find(
        (m) => m.toLowerCase() === dayMonthMatch[2].toLowerCase(),
      )
      if (monthKey) currentMonth = MONTH_MAP[monthKey]
      continue
    }

    // Detect standalone day number: "07", "25", "11" (OCR may read as "O7", "O1")
    const dayOnlyMatch = line.match(/^[O0]?(\d{1,2})\s*$/)
    if (dayOnlyMatch) {
      const dayNum = parseInt(dayOnlyMatch[1], 10)
      if (dayNum >= 1 && dayNum <= 31) {
        currentDay = dayNum.toString().padStart(2, '0')
      }
      continue
    }

    // Detect standalone month abbreviation: "Mai", "Abr", "Set"
    const monthOnlyMatch = line.match(/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\s*$/i)
    if (monthOnlyMatch) {
      const monthKey = Object.keys(MONTH_MAP).find(
        (m) => m.toLowerCase() === monthOnlyMatch[1].toLowerCase(),
      )
      if (monthKey) currentMonth = MONTH_MAP[monthKey]
      continue
    }

    // Detect transaction line: contains R$ with a value
    // Format: "● DESCRIPTION R$ VALUE >" or "DESCRIPTION R$ VALUE >"
    // Also handles OCR variants: "e DESCRIPTION R$ VALUE", "o DESCRIPTION R$ VALUE"
    const txMatch = line.match(/^[●•·eo°.,-]*\s*(.+?)\s+R\$\s*([-]?[\d.,]+)\s*>?\s*$/i)
    if (!txMatch) {
      // Also try: line has R$ somewhere with description before it
      const txMatch2 = line.match(/^(.+?)\s+R\$\s*([-]?[\d.,]+)\s*>?\s*$/i)
      if (!txMatch2) continue

      let descricao = txMatch2[1].trim()
      const rawValue = txMatch2[2]

      // Skip negative values (payments/credits)
      if (rawValue.startsWith('-')) continue

      // Skip lines that are totals or summaries
      if (/total/i.test(descricao)) continue

      const valorBrl = parseBrDecimal(rawValue)
      if (isNaN(valorBrl) || valorBrl <= 0) continue

      // Clean description - remove leading bullets and OCR artifacts
      descricao = descricao.replace(/^[●•·eo°.,-]+\s*/i, '').trim()
      // Remove leading day+month that leaked into description line
      descricao = descricao.replace(/^\d{1,2}\s+(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\s+/i, '').trim()
      descricao = descricao.replace(/^\d{1,2}\s+/, '').trim()

      if (!descricao || descricao.length < 3) continue
      if (skipPatterns.some((p) => p.test(descricao))) continue

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
      continue
    }

    let descricao = txMatch[1].trim()
    const rawValue = txMatch[2]

    // Skip negative values (payments/credits)
    if (rawValue.startsWith('-')) continue

    // Skip lines that are totals or summaries
    if (/total/i.test(descricao)) continue

    const valorBrl = parseBrDecimal(rawValue)
    if (isNaN(valorBrl) || valorBrl <= 0) continue

    // Clean description - remove leading bullets and OCR artifacts
    descricao = descricao.replace(/^[●•·eo°.,-]+\s*/i, '').trim()
    // Remove leading day+month that leaked into description
    descricao = descricao.replace(/^\d{1,2}\s+(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\s+/i, '').trim()
    descricao = descricao.replace(/^\d{1,2}\s+/, '').trim()

    if (!descricao || descricao.length < 3) continue
    if (skipPatterns.some((p) => p.test(descricao))) continue

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

  // Deduplicate: remove items with same value + similar description
  // (screenshots may overlap and show the same transactions twice)
  // Uses fuzzy matching: normalize description by removing spaces/special chars
  // and compare first 10 chars + value
  const uniqueItems: C6InvoiceItem[] = []
  const seen = new Set<string>()

  for (const item of items) {
    // Normalize: lowercase, remove non-alphanumeric, take first 12 chars
    const normalizedDesc = item.descricao
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 12)
    const key = `${normalizedDesc}|${item.valorBrl}`

    if (seen.has(key)) continue
    seen.add(key)
    uniqueItems.push(item)
  }

  return uniqueItems
}

/**
 * Parses OCR text from invoice screenshots (C6 or Bradesco).
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

  const items = banco === 'C6' ? parseC6Text(text) : parseBradescoText(text)

  console.log('[Screenshot Parser] Items found:', items.length)
  items.forEach((item, idx) => console.log(`[Screenshot] Item ${idx}: ${item.descricao} = ${item.valorBrl} (${item.dataCompra})`))


  if (items.length === 0) {
    const bancoMsg = banco === 'C6'
      ? 'Verifique se as imagens são screenshots do app C6.'
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
