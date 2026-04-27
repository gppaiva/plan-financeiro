import { supabase } from '../lib/supabase'
import type { Expense } from '../types'

// ── Result Types ─────────────────────────────────────────────────────

export interface CategoryBreakdownItem {
  categoria: string
  total: number
  percentual: number
}

export interface MonthlyEvolutionItem {
  month: number
  receita: number
  despesa: number
}

// ── Pure Functions ───────────────────────────────────────────────────

/**
 * Groups expenses by category, calculating the total and percentage for each.
 * Returns an array sorted by total descending.
 *
 * Pure function — no Supabase calls.
 */
export function getCategoryBreakdown(expenses: Expense[]): CategoryBreakdownItem[] {
  if (expenses.length === 0) {
    return []
  }

  // Aggregate totals by category
  const totalsMap = new Map<string, number>()
  for (const expense of expenses) {
    const current = totalsMap.get(expense.categoria) ?? 0
    totalsMap.set(expense.categoria, current + expense.valor)
  }

  // Calculate grand total
  const grandTotal = Array.from(totalsMap.values()).reduce((sum, val) => sum + val, 0)

  // Build result with percentages
  const result: CategoryBreakdownItem[] = []
  for (const [categoria, total] of totalsMap) {
    result.push({
      categoria,
      total,
      percentual: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    })
  }

  // Sort by total descending
  result.sort((a, b) => b.total - a.total)

  return result
}

/**
 * Builds monthly evolution data from pre-fetched expenses and a fixed monthly income.
 * Returns an array with 12 entries (months 1–12), each containing the month number,
 * the income (receita), and the total expenses (despesa) for that month.
 *
 * Pure function — no Supabase calls.
 */
export function getMonthlyEvolutionFromData(
  expenses: Expense[],
  monthlyIncome: number,
): MonthlyEvolutionItem[] {
  // Initialize all 12 months
  const monthlyTotals = new Map<number, number>()
  for (let m = 1; m <= 12; m++) {
    monthlyTotals.set(m, 0)
  }

  // Aggregate expense values by month
  for (const expense of expenses) {
    const date = new Date(expense.data_vencimento)
    const month = date.getMonth() + 1 // getMonth() is 0-indexed
    const current = monthlyTotals.get(month) ?? 0
    monthlyTotals.set(month, current + expense.valor)
  }

  // Build result
  const result: MonthlyEvolutionItem[] = []
  for (let m = 1; m <= 12; m++) {
    result.push({
      month: m,
      receita: monthlyIncome,
      despesa: monthlyTotals.get(m) ?? 0,
    })
  }

  return result
}

// ── Async Functions (Supabase) ──────────────────────────────────────

/**
 * Fetches all expenses for a user in a given year and returns monthly evolution data.
 * Uses the user's salary (monthlyIncome) as the income for each month.
 */
export async function getMonthlyEvolution(
  userId: string,
  year: number,
  monthlyIncome: number,
): Promise<MonthlyEvolutionItem[]> {
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('data_vencimento', startDate)
    .lte('data_vencimento', endDate)
    .order('data_vencimento', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const expenses = (data ?? []) as Expense[]

  return getMonthlyEvolutionFromData(expenses, monthlyIncome)
}
