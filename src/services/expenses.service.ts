import { supabase } from '../lib/supabase'
import type { Expense, ExpenseFilters, ExpenseStatus } from '../types'
import { expenseSchema } from '../schemas/expense.schema'
import type { ExpenseFormData } from '../schemas/expense.schema'

const TABLE = 'expenses'

/**
 * Lists expenses for a user with optional filters (month/year, quinzena, category, status).
 */
export async function listExpenses(
  userId: string,
  filters?: ExpenseFilters,
): Promise<Expense[]> {
  if (!filters) {
    // No filters — return all expenses
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('data_vencimento', { ascending: true })

    if (error) throw new Error(error.message)
    return (data ?? []) as Expense[]
  }

  const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
  const lastDay = new Date(filters.year, filters.month, 0).getDate()
  const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // 1. Fetch non-recurring expenses for this month
  let normalQuery = supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('recorrente', false)
    .gte('data_vencimento', startDate)
    .lte('data_vencimento', endDate)

  if (filters.quinzena) normalQuery = normalQuery.eq('quinzena', filters.quinzena)
  if (filters.category) normalQuery = normalQuery.eq('categoria', filters.category)
  if (filters.status) normalQuery = normalQuery.eq('status', filters.status)

  const { data: normalData, error: normalError } = await normalQuery.order('data_vencimento', { ascending: true })
  if (normalError) throw new Error(normalError.message)

  // 2. Fetch recurring expenses that started on or before this month
  //    and haven't ended yet (data_final is null or >= start of this month)
  let recurringQuery = supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('recorrente', true)
    .lte('data_vencimento', endDate) // started on or before this month

  if (filters.quinzena) recurringQuery = recurringQuery.eq('quinzena', filters.quinzena)
  if (filters.category) recurringQuery = recurringQuery.eq('categoria', filters.category)
  if (filters.status) recurringQuery = recurringQuery.eq('status', filters.status)

  const { data: recurringData, error: recurringError } = await recurringQuery.order('data_vencimento', { ascending: true })
  if (recurringError) throw new Error(recurringError.message)

  // Filter recurring: only include if data_final is null or >= start of selected month
  const filteredRecurring = (recurringData ?? []).filter((expense: Expense) => {
    if (!expense.data_final) return true // no end date = always show
    return expense.data_final >= startDate // end date is on or after this month
  })

  // Get monthly payment status for recurring expenses
  const recurringIds = filteredRecurring.map((e: Expense) => e.id)
  const payments = await getMonthlyPayments(recurringIds, filters.month, filters.year)

  // Apply monthly status to recurring expenses
  const recurringWithStatus = filteredRecurring.map((expense: Expense) => ({
    ...expense,
    status: payments[expense.id] || 'pending' as ExpenseStatus,
  }))

  return [...(normalData ?? []) as Expense[], ...recurringWithStatus as Expense[]]
}

/**
 * Creates a new expense after validating with Zod schema.
 */
export async function createExpense(
  userId: string,
  data: ExpenseFormData & { data_final?: string },
): Promise<Expense> {
  // Validate data with Zod schema (data_final is not in the schema)
  const { data_final, ...formData } = data as ExpenseFormData & { data_final?: string }
  const validated = expenseSchema.parse(formData)

  const { data: created, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, ...validated, data_final: data_final || null })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created as Expense
}

/**
 * Updates an existing expense.
 */
export async function updateExpense(
  id: string,
  data: Partial<ExpenseFormData>,
): Promise<Expense> {
  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updated as Expense
}

/**
 * Deletes an expense by id.
 */
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Toggles expense status between 'paid' and 'pending'.
 * For recurring expenses, uses the expense_payments table to track per-month status.
 * For non-recurring, updates the expense directly.
 */
export async function toggleExpenseStatus(
  id: string,
  currentStatus: ExpenseStatus,
  month?: number,
  year?: number,
): Promise<Expense> {
  // Check if expense is recurring
  const { data: expense } = await supabase
    .from(TABLE)
    .select('recorrente')
    .eq('id', id)
    .single()

  if (expense?.recorrente && month && year) {
    // For recurring: toggle in expense_payments table
    if (currentStatus === 'pending') {
      // Mark as paid for this month
      await supabase
        .from('expense_payments')
        .upsert({ expense_id: id, mes: month, ano: year, status: 'paid' })
    } else {
      // Remove payment record for this month
      await supabase
        .from('expense_payments')
        .delete()
        .eq('expense_id', id)
        .eq('mes', month)
        .eq('ano', year)
    }

    // Return the expense with toggled status (for UI update)
    const { data: updated } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single()

    const newStatus: ExpenseStatus = currentStatus === 'paid' ? 'pending' : 'paid'
    return { ...(updated as Expense), status: newStatus }
  }

  // Non-recurring: update directly
  const newStatus: ExpenseStatus = currentStatus === 'paid' ? 'pending' : 'paid'

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updated as Expense
}

/**
 * Gets payment status for recurring expenses in a specific month.
 */
export async function getMonthlyPayments(
  expenseIds: string[],
  month: number,
  year: number,
): Promise<Record<string, ExpenseStatus>> {
  if (expenseIds.length === 0) return {}

  const { data } = await supabase
    .from('expense_payments')
    .select('expense_id, status')
    .in('expense_id', expenseIds)
    .eq('mes', month)
    .eq('ano', year)

  const result: Record<string, ExpenseStatus> = {}
  for (const payment of (data ?? [])) {
    result[payment.expense_id] = payment.status as ExpenseStatus
  }
  return result
}
