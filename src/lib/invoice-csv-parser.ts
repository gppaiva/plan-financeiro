import { BlobReader, ZipReader, TextWriter } from '@zip.js/zip.js'

/** Represents an item extracted from a C6 CSV */
export interface C6InvoiceItem {
  dataCompra: string       // ISO format YYYY-MM-DD
  nomeCartao: string       // "GUSTAVO PAIVA"
  finalCartao: string      // "0083"
  categoriaC6: string      // Original C6 category
  descricao: string        // "NOVA BABY TRIGO"
  parcela: string          // "Única", "1/3", etc.
  valorUsd: number         // USD value (0 for domestic purchases)
  cotacao: number          // Exchange rate (0 for domestic purchases)
  valorBrl: number         // BRL value (always positive after filter)
}

/** Parsing result */
export interface C6ParseResult {
  items: C6InvoiceItem[]
  totalBrl: number
  banco: string            // "C6"
}

/** Parsing outcome with possible errors */
export type C6ParseOutcome =
  | { success: true; data: C6ParseResult }
  | { success: false; error: string }

/**
 * Parses CSV content in C6 format.
 * - Separator: semicolon
 * - Skips header (first line)
 * - Excludes lines with negative values (payments/credits)
 * - Ignores lines with invalid format
 * - Converts dates DD/MM/YYYY → ISO YYYY-MM-DD
 * - Converts comma decimals to numbers
 * - Trims string fields
 */
export function parseC6Csv(content: string): C6ParseOutcome {
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Arquivo vazio' }
  }

  const lines = content.trim().split(/\r?\n/)

  if (lines.length < 2) {
    return { success: false, error: 'Nenhuma compra encontrada no arquivo' }
  }

  // Validate header format
  const header = lines[0]
  if (!header.includes('Data de Compra') || !header.includes('Valor (em R$)')) {
    return { success: false, error: 'Formato de arquivo inválido. Esperado formato CSV do C6.' }
  }

  const items: C6InvoiceItem[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = line.split(';')
    if (cols.length < 9) continue

    const rawDate = cols[0].trim()
    const nomeCartao = cols[1].trim()
    const finalCartao = cols[2].trim()
    const categoriaC6 = cols[3].trim()
    const descricao = cols[4].trim()
    const parcela = cols[5].trim()
    const rawValorUsd = cols[6].trim()
    const rawCotacao = cols[7].trim()
    const rawValorBrl = cols[8].trim()

    // Convert date DD/MM/YYYY → YYYY-MM-DD
    const dateParts = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!dateParts) continue

    const dataCompra = `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`

    // Convert comma decimal values
    const valorBrl = parseCommaDecimal(rawValorBrl)
    if (isNaN(valorBrl)) continue

    // Exclude negative values (payments/credits)
    if (valorBrl <= 0) continue

    const valorUsd = parseCommaDecimal(rawValorUsd)
    const cotacao = parseCommaDecimal(rawCotacao)

    items.push({
      dataCompra,
      nomeCartao,
      finalCartao,
      categoriaC6,
      descricao,
      parcela: parcela || 'Única',
      valorUsd: isNaN(valorUsd) ? 0 : valorUsd,
      cotacao: isNaN(cotacao) ? 0 : cotacao,
      valorBrl,
    })
  }

  if (items.length === 0) {
    return { success: false, error: 'Nenhuma compra encontrada no arquivo' }
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
 * Converts a list of C6InvoiceItem back to C6 CSV format.
 * Used for round-trip validation.
 */
export function prettyPrintC6Csv(items: C6InvoiceItem[]): string {
  const header = 'Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)'

  const lines = items.map((item) => {
    // Convert ISO date back to DD/MM/YYYY
    const [year, month, day] = item.dataCompra.split('-')
    const dateStr = `${day}/${month}/${year}`

    return [
      dateStr,
      item.nomeCartao,
      item.finalCartao,
      item.categoriaC6,
      item.descricao,
      item.parcela,
      formatCommaDecimal(item.valorUsd),
      formatCommaDecimal(item.cotacao),
      formatCommaDecimal(item.valorBrl),
    ].join(';')
  })

  return [header, ...lines].join('\n')
}

/**
 * Extracts CSV content from a ZIP file using @zip.js/zip.js.
 * Supports password-protected ZIPs.
 * Looks for the first .csv file inside the ZIP.
 */
export async function extractCsvFromZip(zipData: ArrayBuffer, password?: string): Promise<string> {
  try {
    const blob = new Blob([zipData])
    const reader = new ZipReader(new BlobReader(blob), { password: password || undefined })
    const entries = await reader.getEntries()
    
    const csvEntry = entries.find((entry) => 
      entry.filename.toLowerCase().endsWith('.csv')
    )
    
    if (!csvEntry) {
      await reader.close()
      throw new Error('Nenhum arquivo CSV encontrado no ZIP')
    }
    
    if (!('getData' in csvEntry)) {
      await reader.close()
      throw new Error('Não foi possível ler o arquivo CSV do ZIP')
    }
    
    const csvContent = await (csvEntry as { getData: (writer: TextWriter) => Promise<string> }).getData(new TextWriter())
    await reader.close()
    return csvContent
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('password') || msg.includes('encrypted') || msg.includes('Invalid signature')) {
      if (password) {
        throw new Error('Senha incorreta. Verifique e tente novamente.')
      }
      throw new Error('ZIP_NEEDS_PASSWORD')
    }
    if (msg === 'Nenhum arquivo CSV encontrado no ZIP' || msg === 'Não foi possível ler o arquivo CSV do ZIP') {
      throw err
    }
    throw new Error('Erro ao abrir o arquivo ZIP. Verifique se o arquivo não está corrompido.')
  }
}

/** Parses a string with comma decimal separator to a number */
function parseCommaDecimal(value: string): number {
  if (!value || value === '-') return NaN
  const trimmed = value.trim()
  
  // Detect format: if has comma AND dot, comma is decimal (Brazilian: 1.234,56)
  // If has only dot, dot is decimal (US/C6: 1234.56 or 50.00)
  // If has only comma, comma is decimal (Brazilian: 50,00)
  const hasDot = trimmed.includes('.')
  const hasComma = trimmed.includes(',')
  
  if (hasDot && hasComma) {
    // Brazilian format: 1.234,56 → remove dots, replace comma with dot
    return parseFloat(trimmed.replace(/\./g, '').replace(',', '.'))
  } else if (hasComma && !hasDot) {
    // Comma as decimal: 50,00 → replace comma with dot
    return parseFloat(trimmed.replace(',', '.'))
  } else {
    // Dot as decimal or no separator: 50.00 or 50 → parse directly
    return parseFloat(trimmed)
  }
}

/** Formats a number to comma decimal string (C6 CSV format) */
function formatCommaDecimal(value: number): string {
  return value.toFixed(2).replace('.', ',')
}
