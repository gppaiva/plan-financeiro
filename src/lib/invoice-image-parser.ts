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

/**
 * Detects the bank from OCR text.
 * Returns "C6" or "Bradesco" based on text indicators.
 */
function detectBank(text: string): 'C6' | 'Bradesco' {
  // C6 indicators
  if (/Cartão final/i.test(text)) return 'C6'
  if (/Fatura do cart/i.test(text)) return 'C6'

  // Bradesco indicators
  if (/Lançamentos/i.test(text)) return 'Bradesco'
  if (/Lancamentos/i.test(text)) return 'Bradesco'

  // Check for month abbreviations alone on lines (Bradesco pattern)
  const monthAbbrevs = Object.keys(MONTH_MAP)
  const lines = text.split(/\n/).map((l) => l.trim())
  for (const line of lines) {
    if (monthAbbrevs.some((m) => new RegExp(`^${m}$`, 'i').test(line))) {
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
 * Format:
 *   DD                            ← day number (large, alone or with month below)
 *   Mês                           ← month abbreviation (Abr, Mai, Jun, etc.)
 *   ● DESCRIPTION           R$ VALUE >
 *   Parcela X de Y (optional)
 *
 * Multiple transactions on same day share the date.
 */
function parseBradescoText(text: string): C6InvoiceItem[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  const items: C6InvoiceItem[] = []

  const skipDescriptions = [
    'SALDO ANTERIOR',
    'Total de lançamentos',
    'Resumo da fatura',
    'Total da fatura',
    'Valor pago',
    'Lançamentos nacionais',
    'Lançamentos internacionais',
    'Voltar ao topo',
    'Busque por nome',
    'Cartões da fatura',
  ]

  let currentDay = ''
  let currentMonth = ''

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Check if line is a day number (1-2 digits alone on a line)
    const dayMatch = line.match(/^(\d{1,2})\s*$/)
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10)
      if (dayNum >= 1 && dayNum <= 31) {
        currentDay = dayNum.toString().padStart(2, '0')
        i++

        // Check if next line is a month abbreviation
        if (i < lines.length) {
          const monthLine = lines[i].trim()
          const monthKey = Object.keys(MONTH_MAP).find(
            (m) => m.toLowerCase() === monthLine.toLowerCase(),
          )
          if (monthKey) {
            currentMonth = MONTH_MAP[monthKey]
            i++
          }
        }
        continue
      }
    }

    // Check if line is a month abbreviation alone (sometimes appears without day)
    const monthKey = Object.keys(MONTH_MAP).find(
      (m) => m.toLowerCase() === line.toLowerCase(),
    )
    if (monthKey) {
      currentMonth = MONTH_MAP[monthKey]
      i++
      continue
    }

    // Skip if we don't have a valid date context yet
    if (!currentDay || !currentMonth) {
      i++
      continue
    }

    // Try to match a transaction line: ● DESCRIPTION R$ VALUE > or similar
    // The bullet (●) may be OCR'd as various characters or missing
    // Look for R$ value pattern in the line
    const valorMatch = line.match(/R\$\s*([-]?[\d.,]+)/)
    if (valorMatch) {
      const rawValue = valorMatch[1]

      // Skip negative values
      if (rawValue.startsWith('-')) {
        i++
        continue
      }

      const valorBrl = parseBrDecimal(rawValue)
      if (isNaN(valorBrl) || valorBrl <= 0) {
        i++
        continue
      }

      // Extract description: everything before "R$", removing leading bullet/dot
      let descricao = line.substring(0, line.indexOf('R$')).trim()
      descricao = descricao.replace(/^[●•·°\-–—]\s*/, '').trim()
      // Remove trailing ">" if present
      descricao = descricao.replace(/\s*>\s*$/, '').trim()

      if (!descricao || descricao.length < 2) {
        i++
        continue
      }

      // Check if description should be skipped
      const shouldSkip = skipDescriptions.some(
        (s) => descricao.toUpperCase().includes(s.toUpperCase()),
      )
      if (shouldSkip) {
        i++
        continue
      }

      // Also skip "Gustavo P Paiva" lines (cardholder name)
      if (/Gustavo\s+P\s+Paiva/i.test(descricao)) {
        i++
        continue
      }

      // Also skip "Final XXXX" lines
      if (/^Final\s+\d{4}$/i.test(descricao)) {
        i++
        continue
      }

      let parcela = 'Única'
      i++

      // Check next line for "Parcela X de Y"
      if (i < lines.length) {
        const parcelaMatch = lines[i].match(/[Pp]arcela\s+(\d+)\s+de\s+(\d+)/)
        if (parcelaMatch) {
          parcela = `${parcelaMatch[1]}/${parcelaMatch[2]}`
          i++
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
    } else {
      i++
    }
  }

  return items
}

/**
 * Parses OCR text from invoice screenshots (C6 or Bradesco).
 * Auto-detects the bank and applies the appropriate parser.
 */
export function parseInvoiceScreenshotText(text: string): C6ParseOutcome {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Nenhum texto extraído das imagens' }
  }

  const banco = detectBank(text)
  const items = banco === 'C6' ? parseC6Text(text) : parseBradescoText(text)

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
