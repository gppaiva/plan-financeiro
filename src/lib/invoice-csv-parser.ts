import JSZip from 'jszip'

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
 * Extracts CSV content from a ZIP file using JSZip.
 * Looks for the first .csv file inside the ZIP.
 */
export async function extractCsvFromZip(zipData: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(zipData)

  const csvFileName = Object.keys(zip.files).find((name) =>
    name.toLowerCase().endsWith('.csv'),
  )

  if (!csvFileName) {
    throw new Error('Nenhum arquivo CSV encontrado no ZIP')
  }

  const csvContent = await zip.files[csvFileName].async('string')
  return csvContent
}

/** Parses a string with comma decimal separator to a number */
function parseCommaDecimal(value: string): number {
  if (!value || value === '-') return NaN
  // Remove dots (thousands separator) and replace comma with dot
  const cleaned = value.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned)
}

/** Formats a number to comma decimal string (C6 CSV format) */
function formatCommaDecimal(value: number): string {
  return value.toFixed(2).replace('.', ',')
}
