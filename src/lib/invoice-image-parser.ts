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
 * Actual OCR format from C6 screenshots:
 *   DD/MM                                    ← date alone on line
 *   DESCRIPTION R$ VALUE                     ← description + value on SAME line
 *   Cartão final XXXX                        ← card number on next line
 *
 * Some items may have the value on the "Cartão final" line instead.
 * Skips negative values (payments), "Valor" total line, and header lines.
 */
export function parseC6ScreenshotText(text: string, year: number): C6ParseOutcome {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Nenhum texto extraído das imagens' }
  }

  const lines = text.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  const items: C6InvoiceItem[] = []

  let i = 0
  while (i < lines.length) {
    // Skip known non-transaction lines
    const line = lines[i]
    if (
      /^(Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro|Janeiro|Fevereiro|Março)/i.test(line) ||
      /Fatura do cart/i.test(line) ||
      /Subtotal/i.test(line) ||
      /^Valor$/i.test(line) ||
      /^Vence em/i.test(line) ||
      /^R\$ [\d.,]+$/.test(line) ||
      /^\d{2}:\d{2}/.test(line) || // Time stamps like "20:23"
      /^</.test(line) // Navigation elements
    ) {
      i++
      continue
    }

    // Look for a date line: DD/MM alone (or with minimal trailing chars)
    const dateMatch = line.match(/^(\d{2})\/(\d{2})\s*$/)
    if (!dateMatch) {
      i++
      continue
    }

    const day = dateMatch[1]
    const month = dateMatch[2]
    i++

    // Next line should be: "DESCRIPTION R$ VALUE" or just "DESCRIPTION"
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
        // Skip the "Cartão final" line too
        if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
        continue
      }
      valorBrl = parseBrDecimal(rawValue)
      // Description is everything before "R$"
      descricao = descLine.substring(0, descLine.indexOf('R$')).trim()
    }

    // Skip if description is empty or looks like a header/total
    if (!descricao || descricao.length < 2) {
      continue
    }

    // Skip payment/credit descriptions
    const upperDesc = descricao.toUpperCase()
    if (
      upperDesc.includes('PAGAMENTO') ||
      upperDesc.includes('INCLUSAO DE PAGAMENTO') ||
      upperDesc.includes('ESTORNO') ||
      upperDesc.includes('CRÉDITO') ||
      upperDesc.includes('CREDITO')
    ) {
      // Skip the "Cartão final" line too
      if (i < lines.length && /[Cc]art[aã]o/i.test(lines[i])) i++
      continue
    }

    // Check next line for "Cartão final XXXX" and optionally extract value from it
    if (i < lines.length) {
      const cartaoLine = lines[i]
      const cartaoMatch = cartaoLine.match(/[Cc]art[aã]o\s+final\s+(\d{4})/)
      if (cartaoMatch) {
        finalCartao = cartaoMatch[1]
        // If we didn't find a value yet, check if it's on this line
        if (valorBrl === 0) {
          const cartaoValorMatch = cartaoLine.match(/R\$\s*([\d.,]+)/)
          if (cartaoValorMatch) {
            valorBrl = parseBrDecimal(cartaoValorMatch[1])
          }
        }
        // Check for parcela info on this line
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

    // Skip if no value found or invalid
    if (valorBrl <= 0 || isNaN(valorBrl)) continue

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
