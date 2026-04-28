/**
 * Utility functions for formatting currency and dates in Brazilian (pt-BR) locale.
 */

/**
 * Formats a number as Brazilian Real currency (R$ 1.234,56).
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/**
 * Formats an ISO date string (YYYY-MM-DD) to Brazilian format (DD/MM/AAAA).
 */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Formats an ISO date string (YYYY-MM-DD) to short Brazilian format (DD/MM).
 */
export function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}

/**
 * Parses a Brazilian currency string (e.g. "1.234,56" or "R$ 1.234,56") to a number.
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

/**
 * Formats a number for display in a currency input field (without the R$ prefix).
 * Returns empty string for zero values so the placeholder shows.
 */
export function formatCurrencyInput(value: number): string {
  if (value === 0) return ''
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
