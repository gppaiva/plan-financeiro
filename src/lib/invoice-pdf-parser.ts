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

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 }) // Higher scale = better OCR

    // Create canvas and render page
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport }).promise

    // Run OCR on the canvas
    const { data } = await Tesseract.recognize(canvas, 'por', {
      logger: () => {}, // Suppress progress logs
    })

    pages.push(data.text)
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
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      pages.push(pageText)
    }

    const fullText = pages.join('\n')

    // If text is empty or very short, try OCR as fallback
    if (fullText.trim().length < 20) {
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
 * Main regex-based line parser for PDF invoice lines.
 * Matches lines like: DD/MM  DESCRIPTION  1.234,56
 */
function parseTransactionLines(text: string, year: number, banco: string): C6InvoiceItem[] {
  const items: C6InvoiceItem[] = []
  const lines = text.split(/\n/)

  // Pattern: DD/MM followed by description and a value at the end
  const lineRegex = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d.,]+)\s*$/

  for (const rawLine of lines) {
    // PDF text extraction can produce lines with extra spaces; normalize
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line) continue

    const match = line.match(lineRegex)
    if (!match) continue

    const [, dateStr, descricao, valorStr] = match

    // Skip payment/credit lines
    const upperDesc = descricao.toUpperCase()
    if (
      upperDesc.includes('PAGAMENTO') ||
      upperDesc.includes('PGTO') ||
      upperDesc.includes('CRÉDITO') ||
      upperDesc.includes('CREDITO') ||
      upperDesc.includes('ESTORNO')
    ) {
      continue
    }

    const valor = parseBrDecimal(valorStr)
    if (isNaN(valor) || valor <= 0) continue

    // Build ISO date from DD/MM + year
    const [day, month] = dateStr.split('/')
    const dataCompra = `${year}-${month}-${day}`

    // Try to extract parcela from description (e.g., "LOJA XYZ 1/3")
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

  return items
}

/**
 * Bradesco PDF parser.
 * Bradesco invoices have lines like: DD/MM  DESCRICAO DO ESTABELECIMENTO  VALOR
 */
function parseBradescoPdf(text: string): C6ParseOutcome {
  const year = extractYear(text)
  const items = parseTransactionLines(text, year, 'Bradesco')

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

    // Skip payment/credit lines
    const upperDesc = descricao.toUpperCase()
    if (
      upperDesc.includes('PAGAMENTO') ||
      upperDesc.includes('PGTO') ||
      upperDesc.includes('CRÉDITO') ||
      upperDesc.includes('CREDITO') ||
      upperDesc.includes('ESTORNO')
    ) {
      continue
    }

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
