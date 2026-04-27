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
