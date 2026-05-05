import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import Tesseract from 'tesseract.js'
import type { C6InvoiceItem, C6ParseResult, C6ParseOutcome } from './invoice-csv-parser'

// Set worker source for pdf.js — use bundled worker via Vite URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Extracts text from PDF pages using OCR (Tesseract.js).
 * Renders each page to a canvas and runs OCR on the image.
 * This is slower but works for image-based/scanned PDFs.
 */
async function extractTextWithOcr(pdf: pdfjsLib.PDFDocumentProxy): Promise<string> {
  const pages: string[] = []

  console.log('[OCR] Total pages in PDF:', pdf.numPages)

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)

    // Try different scales — some PDFs read better at different resolutions
    let bestText = ''
    const scales = [2, 2.5, 3]

    for (const scale of scales) {
      const viewport = page.getViewport({ scale })

      // Create canvas and render page
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!

      await page.render({ canvasContext: ctx, viewport, canvas }).promise

      // Run OCR on the canvas
      const { data } = await Tesseract.recognize(canvas, 'por', {
        logger: () => {}, // Suppress progress logs
      })

      const lineCount = data.text.split('\n').filter((l: string) => l.trim()).length
      const dateCount = (data.text.match(/\d{2}\/\d{2}/g) || []).length
      console.log(`[OCR] Page ${i} (scale ${scale}): ${lineCount} lines, ${data.text.length} chars, ${dateCount} dates`)

      // Keep the result with the most dates (most relevant for invoices)
      const bestDateCount = (bestText.match(/\d{2}\/\d{2}/g) || []).length
      if (dateCount > bestDateCount || (dateCount === bestDateCount && data.text.length > bestText.length)) {
        bestText = data.text
      }

      // If we got a good result, stop trying
      if (dateCount >= 8) {
        console.log(`[OCR] Page ${i}: excellent result, stopping`)
        break
      }
    }

    pages.push(bestText)
  }

  return pages.join('\n')
}

/**
 * Extracts all text content from a PDF file.
 * Supports password-protected PDFs.
 * Throws 'PDF_NEEDS_PASSWORD' if password is required but not provided.
 */
export async function extractTextFromPdf(data: ArrayBuffer, password?: string): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data,
      password: password || undefined,
    })

    const pdf = await loadingTask.promise
    const pages: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      // Group text items by their Y position to reconstruct lines properly
      // This is critical for PDFs where text is positioned absolutely (like Bradesco)
      const items = textContent.items.filter(
        (item): item is typeof item & { str: string; transform: number[] } =>
          'str' in item && 'transform' in item && item.str.trim().length > 0,
      )

      if (items.length === 0) {
        pages.push('')
        continue
      }

      // Group by Y coordinate (transform[5] is the Y position)
      // Items on the same line have similar Y values (within 2px tolerance)
      const lineMap = new Map<number, { x: number; text: string }[]>()

      for (const item of items) {
        const y = Math.round(item.transform[5]) // Round Y to group nearby items
        const x = item.transform[4] // X position for ordering

        // Find existing line within tolerance
        let foundY: number | null = null
        for (const existingY of lineMap.keys()) {
          if (Math.abs(existingY - y) <= 3) {
            foundY = existingY
            break
          }
        }

        const targetY = foundY ?? y
        if (!lineMap.has(targetY)) {
          lineMap.set(targetY, [])
        }
        lineMap.get(targetY)!.push({ x, text: item.str })
      }

      // Sort lines by Y (descending because PDF Y goes bottom-to-top)
      const sortedLines = [...lineMap.entries()]
        .sort(([a], [b]) => b - a)
        .map(([, items]) => {
          // Sort items within a line by X position (left to right)
          return items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(' ')
        })

      pages.push(sortedLines.join('\n'))
    }

    const fullText = pages.join('\n')

    // Debug: log extracted text to console for troubleshooting
    console.log('[PDF Parser] Extracted text length:', fullText.length)
    console.log('[PDF Parser] Text content preview:', fullText.substring(0, 500))

    // If text is empty or very short, try OCR as fallback
    // Threshold: less than 100 chars means the PDF is likely image-based
    if (fullText.trim().length < 100) {
      console.log('[PDF Parser] Text too short, falling back to OCR...')
      // Use OCR to extract text from PDF pages rendered as images
      const ocrText = await extractTextWithOcr(pdf)
      if (ocrText.trim().length < 20) {
        throw new Error('Não foi possível extrair texto do PDF. O arquivo pode estar corrompido.')
      }
      return ocrText
    }

    return fullText
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string }
    if (error.name === 'PasswordException' || error.message?.includes('password')) {
      if (password) {
        throw new Error('Senha incorreta. Verifique e tente novamente.')
      }
      throw new Error('PDF_NEEDS_PASSWORD')
    }
    throw new Error(
      error.message || 'Erro ao processar o arquivo PDF. Verifique se o arquivo não está corrompido.',
    )
  }
}

/**
 * Parses extracted PDF text and returns invoice items.
 * Detects bank (Bradesco or C6) and uses the appropriate parser.
 * Falls back to a generic parser if bank is not detected.
 */
export function parsePdfInvoice(text: string): C6ParseOutcome {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Nenhum texto encontrado no PDF' }
  }

  const upperText = text.toUpperCase()

  if (upperText.includes('BRADESCO')) {
    return parseBradescoPdf(text)
  }

  if (upperText.includes('C6 BANK') || upperText.includes('C6')) {
    return parseC6Pdf(text)
  }

  // Fallback: try generic parser
  return parseGenericPdf(text)
}

/**
 * Extracts the invoice year from the PDF text.
 * Looks for patterns like "Vencimento: DD/MM/YYYY", "Vencimento DD/MM/YYYY",
 * "MES/ANO", or any full date DD/MM/YYYY in the header area.
 */
function extractYear(text: string): number {
  // Try "Vencimento" pattern first
  const vencimentoMatch = text.match(/[Vv]encimento[:\s]+(\d{2})\/(\d{2})\/(\d{4})/)
  if (vencimentoMatch) {
    return parseInt(vencimentoMatch[3], 10)
  }

  // Try any full date DD/MM/YYYY
  const fullDateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (fullDateMatch) {
    return parseInt(fullDateMatch[3], 10)
  }

  // Fallback to current year
  return new Date().getFullYear()
}

/** Parses a Brazilian decimal number string like "1.234,56" or "1234,56" to a number */
function parseBrDecimal(value: string): number {
  if (!value) return NaN
  const trimmed = value.trim()
  const hasDot = trimmed.includes('.')
  const hasComma = trimmed.includes(',')

  if (hasDot && hasComma) {
    // Brazilian format: 1.234,56
    return parseFloat(trimmed.replace(/\./g, '').replace(',', '.'))
  } else if (hasComma && !hasDot) {
    // Comma as decimal: 1234,56
    return parseFloat(trimmed.replace(',', '.'))
  } else {
    return parseFloat(trimmed)
  }
}

/**
 * Checks if a description should be skipped (payments, credits, balance lines).
 * Used by all parsers.
 */
function shouldSkipDescription(descricao: string): boolean {
  const upper = descricao.toUpperCase()
  return (
    upper.includes('PAGAMENTO') ||
    upper.includes('PGTO') ||
    upper.includes('CRÉDITO') ||
    upper.includes('CREDITO') ||
    upper.includes('ESTORNO') ||
    upper.includes('SALDO ANTERIOR') ||
    upper.includes('DEB EM C/C') ||
    upper.includes('POR DEB') ||
    upper.includes('TOTAL PARA') ||
    upper.includes('HISTÓRICO') ||
    upper.includes('HISTORICO') ||
    upper.includes('ENCARGOS') ||
    upper.includes('ANUIDADE') ||
    // Match "SALDO" only when it's a standalone word (not part of store names)
    /\bSALDO\b/.test(upper)
  )
}

/**
 * Main regex-based line parser for PDF invoice lines.
 * Matches lines that contain a DD/MM date followed by a description and values.
 * For Bradesco: DD/MM  DESCRIPTION  USD 0,00  R$ 0,00  R$ 260,10
 * Captures the LAST positive R$ value on the line as the BRL amount.
 * Handles multiple card blocks in the same PDF.
 */
function parseTransactionLines(text: string, year: number, _banco: string): C6InvoiceItem[] {
  const items: C6InvoiceItem[] = []
  const lines = text.split(/\n/)

  for (const rawLine of lines) {
    // PDF text extraction / OCR can produce lines with extra spaces; normalize
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line) continue

    // Find DD/MM date anywhere in the line (OCR may add chars like º, °, or spaces after date)
    const dateMatch = line.match(/(\d{2}\/\d{2})[º°]?\s+/)
    if (!dateMatch) continue

    const dateStr = dateMatch[1]
    const afterDate = line.substring(line.indexOf(dateMatch[0]) + dateMatch[0].length)

    // Skip lines that are just headers or "Total para:" lines
    if (/total\s+para/i.test(line)) continue
    if (/^data\b/i.test(line.trim())) continue
    // Skip the header line "Data: DD/MM/YYYY"
    if (/data[:\s]+\d{2}\/\d{2}\/\d{4}/i.test(line)) continue

    // Find ALL R$ values in the line — format: R$ 260,10 or R$ 10.451,85 or R$260,10
    // Also handle negative values like -10.451,85 or R$ -10.451,85
    const rValues: { value: number; negative: boolean }[] = []

    // Match patterns: "R$ 260,10", "R$ 10.451,85", "R$260,10", "RS 260,10" (OCR misread)
    const rMatches = line.matchAll(/R[\$S]\s*(-?)([\d.]+,\d{2})/gi)
    for (const m of rMatches) {
      const isNeg = m[1] === '-'
      const val = parseBrDecimal(m[2])
      if (!isNaN(val)) {
        rValues.push({ value: val, negative: isNeg })
      }
    }

    // If no R$ prefix found, try to find the last decimal number on the line
    if (rValues.length === 0) {
      const valueMatches = line.match(/-?[\d.]+,\d{2}/g)
      if (valueMatches && valueMatches.length > 0) {
        const lastVal = valueMatches[valueMatches.length - 1]
        const isNeg = lastVal.startsWith('-')
        const cleanVal = lastVal.replace(/^-/, '')
        const val = parseBrDecimal(cleanVal)
        if (!isNaN(val)) {
          rValues.push({ value: val, negative: isNeg })
        }
      }
    }

    if (rValues.length === 0) continue

    // The LAST positive R$ value is the BRL amount we want
    const positiveValues = rValues.filter((v) => !v.negative && v.value > 0)
    if (positiveValues.length === 0) continue

    const valor = positiveValues[positiveValues.length - 1].value

    // Extract description: text between date and the first "USD" or "R$" or numeric column
    let descricao = afterDate
    // Remove leading dash/em-dash that OCR may add (from table borders)
    descricao = descricao.replace(/^[\s\-–—]+/, '').trim()
    // Remove from "USD" onwards
    descricao = descricao.replace(/\s+USD.*$/i, '').trim()
    // Remove from "R$" or "RS" (OCR) onwards
    descricao = descricao.replace(/\s+R[\$S].*$/i, '').trim()
    // Remove from "Moeda" onwards
    descricao = descricao.replace(/\s+Moeda.*$/i, '').trim()
    // Remove trailing numbers (values without R$ prefix)
    descricao = descricao.replace(/\s+[-\d.,]+\s*$/, '').trim()

    if (!descricao || descricao.length < 2) continue

    // Skip payment/credit/balance lines
    if (shouldSkipDescription(descricao)) continue

    // Build ISO date from DD/MM + year
    const [day, month] = dateStr.split('/')
    const dataCompra = `${year}-${month}-${day}`

    // Try to extract parcela from description (e.g., "LOJA XYZ 1/3")
    let parcela = 'Única'
    let cleanDescricao = descricao.trim()
    const parcelaMatch = cleanDescricao.match(/\s+(\d+\/\d+)\s*$/)
    if (parcelaMatch) {
      // Make sure it's a parcela (small numbers) not a date
      const [num1, num2] = parcelaMatch[1].split('/').map(Number)
      if (num1 <= 48 && num2 <= 48 && num1 <= num2) {
        parcela = parcelaMatch[1]
        cleanDescricao = cleanDescricao.replace(/\s+\d+\/\d+\s*$/, '').trim()
      }
    }

    items.push({
      dataCompra,
      nomeCartao: '',
      finalCartao: '',
      categoriaC6: '',
      descricao: cleanDescricao,
      parcela,
      valorUsd: 0,
      cotacao: 0,
      valorBrl: Math.round(valor * 100) / 100,
    })
  }

  return items
}

/**
 * Bradesco PDF parser.
 * Bradesco invoices have multiple card blocks, each with:
 *   GUSTAVO P PAIVA - VISA INFINITE    XXXX.XXXX.XXXX.0197
 *   Data | Histórico | Moeda de origem | US$ | Cotação US$ | R$
 *   DD/MM  DESCRICAO  USD 0,00  R$ 0,00  R$ 260,10
 *   ...
 *   Total para: GUSTAVO P PAIVA    R$ 689,08
 *
 * The parser scans ALL blocks and collects all valid transactions.
 */
function parseBradescoPdf(text: string): C6ParseOutcome {
  const year = extractYear(text)

  // Debug: log lines that contain dates to help troubleshoot
  const lines = text.split(/\n/)
  const dateLines = lines.filter((l) => /\d{2}\/\d{2}/.test(l))
  console.log('[Bradesco Parser] Total lines:', lines.length)
  console.log('[Bradesco Parser] Lines with dates:', dateLines.length)
  console.log('[Bradesco Parser] Year detected:', year)
  dateLines.forEach((l, i) => console.log(`[Bradesco] Date line ${i}:`, l.substring(0, 120)))

  const items = parseTransactionLines(text, year, 'Bradesco')

  console.log('[Bradesco Parser] Items found:', items.length)
  items.forEach((item) => console.log(`[Bradesco] Item: ${item.descricao} = ${item.valorBrl}`))

  if (items.length === 0) {
    return { success: false, error: 'Nenhuma compra encontrada na fatura Bradesco' }
  }

  const totalBrl = items.reduce((sum, item) => sum + item.valorBrl, 0)

  return {
    success: true,
    data: {
      items,
      totalBrl: Math.round(totalBrl * 100) / 100,
      banco: 'Bradesco',
    },
  }
}

/**
 * C6 PDF parser.
 * C6 PDF invoices follow a similar line format to Bradesco.
 */
function parseC6Pdf(text: string): C6ParseOutcome {
  const year = extractYear(text)
  const items = parseTransactionLines(text, year, 'C6')

  if (items.length === 0) {
    return { success: false, error: 'Nenhuma compra encontrada na fatura C6' }
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
 * Generic PDF parser fallback.
 * Tries to find lines with DD/MM or DD/MM/YYYY followed by text and a number.
 */
function parseGenericPdf(text: string): C6ParseOutcome {
  const year = extractYear(text)
  const items: C6InvoiceItem[] = []
  const lines = text.split(/\n/)

  // Try DD/MM/YYYY format first, then DD/MM
  const fullDateRegex = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d.,]+)\s*$/
  const shortDateRegex = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d.,]+)\s*$/

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line) continue

    let dateStr: string | null = null
    let descricao: string | null = null
    let valorStr: string | null = null
    let itemYear = year

    const fullMatch = line.match(fullDateRegex)
    if (fullMatch) {
      const [, fullDate, desc, val] = fullMatch
      const parts = fullDate.split('/')
      dateStr = `${parts[0]}/${parts[1]}`
      itemYear = parseInt(parts[2], 10)
      descricao = desc
      valorStr = val
    } else {
      const shortMatch = line.match(shortDateRegex)
      if (shortMatch) {
        ;[, dateStr, descricao, valorStr] = shortMatch
      }
    }

    if (!dateStr || !descricao || !valorStr) continue

    // Skip payment/credit/balance lines
    if (shouldSkipDescription(descricao)) continue

    const valor = parseBrDecimal(valorStr)
    if (isNaN(valor) || valor <= 0) continue

    const [day, month] = dateStr.split('/')
    const dataCompra = `${itemYear}-${month}-${day}`

    let parcela = 'Única'
    let cleanDescricao = descricao.trim()
    const parcelaMatch = cleanDescricao.match(/\s+(\d+\/\d+)\s*$/)
    if (parcelaMatch) {
      parcela = parcelaMatch[1]
      cleanDescricao = cleanDescricao.replace(/\s+\d+\/\d+\s*$/, '').trim()
    }

    items.push({
      dataCompra,
      nomeCartao: '',
      finalCartao: '',
      categoriaC6: '',
      descricao: cleanDescricao,
      parcela,
      valorUsd: 0,
      cotacao: 0,
      valorBrl: Math.round(valor * 100) / 100,
    })
  }

  if (items.length === 0) {
    return { success: false, error: 'Nenhuma compra encontrada no PDF. Formato não reconhecido.' }
  }

  const totalBrl = items.reduce((sum, item) => sum + item.valorBrl, 0)

  return {
    success: true,
    data: {
      items,
      totalBrl: Math.round(totalBrl * 100) / 100,
      banco: 'Desconhecido',
    },
  }
}

export type { C6InvoiceItem, C6ParseResult, C6ParseOutcome }
