import Tesseract from 'tesseract.js'
import type { C6InvoiceItem, C6ParseOutcome } from './invoice-csv-parser'

/**
 * Runs OCR on a single image file and returns the extracted text.
 * Uses Tesseract.js with Portuguese language.
 */
export async function extractTextFromImage(file: File): Promise<string> {
  const { data } = await Tesseract.recognize(file, 'por', {
    logger: () => {}, // Suppress progress logs
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
 * Parses OCR text from C6 app screenshots to extract transactions.
 *
 * C6 screenshot format:
 *   DD/MM
 *   TRANSACTION NAME
 *   Cartão final XXXX          R$ VALUE
 *   (optional) Parcela X de Y
 *
 * Skips negative values (payments shown in green).
 */
export function parseC6ScreenshotText(text: string, year: number): C6ParseOutcome {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Nenhum texto extraído das imagens' }
  }

  // Debug: log OCR text to help troubleshoot
  console.log('[Image Parser] OCR text length:', text.length)
  console.log('[Image Parser] OCR text preview:', text.substring(0, 2000))

  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  const items: C6InvoiceItem[] = []

  console.log('[Image Parser] Total lines:', lines.length)
  lines.forEach((l, idx) => console.log(`[Image] Line ${idx}:`, l))

  let i = 0
  while (i < lines.length) {
    // Look for a date line: DD/MM — can be alone or with extra chars from OCR
    const dateMatch = lines[i].match(/^(\d{2})\/(\d{2})\s*$/) || lines[i].match(/^(\d{2})\/(\d{2})\b/)
    if (!dateMatch) {
      i++
      continue
    }

    const day = dateMatch[1]
    const month = dateMatch[2]
    i++

    // Next non-empty line is the description
    if (i >= lines.length) break
    const descricao = lines[i].trim()
    i++

    // Skip if description looks like a payment/credit
    const upperDesc = descricao.toUpperCase()
    if (
      upperDesc.includes('PAGAMENTO') ||
      upperDesc.includes('INCLUSAO DE PAGAMENTO') ||
      upperDesc.includes('INCLUSÃO DE PAGAMENTO') ||
      upperDesc.includes('ESTORNO') ||
      upperDesc.includes('CRÉDITO') ||
      upperDesc.includes('CREDITO')
    ) {
      // Skip remaining lines of this transaction (value line + optional parcela)
      while (i < lines.length && !lines[i].match(/^\d{2}\/\d{2}$/)) {
        i++
      }
      continue
    }

    // Look for the value line containing "R$"
    let valorBrl = 0
    let finalCartao = ''
    let parcela = 'Única'
    let foundValue = false

    // Scan next few lines for value and parcela info
    const scanLimit = Math.min(i + 4, lines.length)
    while (i < scanLimit) {
      const line = lines[i]

      // Check for R$ value
      const valorMatch = line.match(/R\$\s*([-]?[\d.,]+)/)
      if (valorMatch) {
        const rawValue = valorMatch[1]
        // Skip negative values (payments)
        if (rawValue.startsWith('-')) {
          foundValue = true
          valorBrl = -1 // Mark as negative to skip later
          i++
          continue
        }
        valorBrl = parseBrDecimal(rawValue)
        foundValue = true

        // Extract card final number
        const cartaoMatch = line.match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
        if (cartaoMatch) {
          finalCartao = cartaoMatch[1]
        }
        i++
        continue
      }

      // Check for "Cartão final XXXX" on its own line
      const cartaoOnlyMatch = line.match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
      if (cartaoOnlyMatch && !finalCartao) {
        finalCartao = cartaoOnlyMatch[1]
        i++
        continue
      }

      // Check for parcela info
      const parcelaMatch = line.match(/[Pp]arcela\s+(\d+)\s+de\s+(\d+)/)
      if (parcelaMatch) {
        parcela = `${parcelaMatch[1]}/${parcelaMatch[2]}`
        i++
        continue
      }

      // If we already found the value and this line doesn't match parcela, stop
      if (foundValue) break

      // If this line looks like a new date, stop scanning
      if (line.match(/^\d{2}\/\d{2}$/)) break

      i++
    }

    // Skip if no value found or negative value
    if (!foundValue || valorBrl <= 0 || isNaN(valorBrl)) continue

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

  if (items.length === 0) {
    return { success: false, error: 'Nenhuma compra encontrada nas imagens. Verifique se as imagens são screenshots do app C6.' }
  }

  const totalBrl = items.reduce((sum, item) => sum + item.valorBrl, 0)

  return {
    success: true,
    data: {
      items,
      totalBrl: Math.round(totalBrl * 100) / 100,
      banco: 'C6',
    },
  }
}

/**
 * Full pipeline: OCR multiple images then parse C6 screenshot text.
 */
export async function parseC6Screenshots(
  files: File[],
  year: number,
  onProgress?: (current: number, total: number) => void,
): Promise<C6ParseOutcome> {
  const text = await extractTextFromImages(files, onProgress)
  return parseC6ScreenshotText(text, year)
}
