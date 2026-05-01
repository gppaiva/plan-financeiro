import type { Quinzena } from '../types'

/**
 * Returns a human-readable label for a quinzena value.
 */
export function getQuinzenaLabel(q: Quinzena): string {
  return q === '1' ? 'Dia 15' : 'Último dia útil'
}

/**
 * Filters items by quinzena. When filter is 'all', returns all items.
 * Items with quinzena === null are included in 'all' and excluded in specific filters.
 */
export function filterByQuinzena<T extends { quinzena: Quinzena | null }>(
  items: T[],
  filter: 'all' | Quinzena,
): T[] {
  if (filter === 'all') return items
  return items.filter((item) => item.quinzena === filter)
}

/**
 * Returns true if the given cicloTipo represents a monthly payment cycle.
 */
export function isMensal(cicloTipo: string | undefined): boolean {
  return cicloTipo === 'mensal'
}

/**
 * Returns the last business day (excluding weekends) of the given month.
 * Month is 1-indexed (1 = January, 12 = December).
 */
export function getLastBusinessDay(year: number, month: number): number {
  // Day 0 of the next month gives us the last day of the current month
  const lastDay = new Date(year, month, 0)
  let day = lastDay.getDate()
  let dayOfWeek = lastDay.getDay()

  // Move backwards from the last day until we find a weekday (Mon-Fri)
  while (dayOfWeek === 0 || dayOfWeek === 6) {
    day--
    dayOfWeek = new Date(year, month - 1, day).getDay()
  }

  return day
}

/**
 * Calculates the total value of paid expenses.
 */
export function calculatePaidTotal(
  expenses: Array<{ status: string; valor: number }>,
): number {
  return expenses
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.valor, 0)
}

/**
 * Calculates the total value of pending expenses.
 */
export function calculatePendingTotal(
  expenses: Array<{ status: string; valor: number }>,
): number {
  return expenses
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.valor, 0)
}
