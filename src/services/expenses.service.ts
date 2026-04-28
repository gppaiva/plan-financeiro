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
  // RLS handles user filtering, but we add user_id for extra safety
  let query = supabase.from(TABLE).select('*')

  // Only filter by user_id if provided (RLS already handles access control)
  if (userId) {
    query = query.eq('user_id', userId)
  }

  if (filters) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate)

    if (filters.quinzena) {
      query = query.eq('quinzena', filters.quinzena)
    }
    if (filters.category) {
      query = query.eq('categoria', filters.category)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
  }

  query = query.order('data_vencimento', { ascending: true })

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Expense[]
}

/**
 * Creates a new expense after validating with Zod schema.
 */
export async function createExpense(
  userId: string,
  data: ExpenseFormData,
): Promise<Expense> {
  // Validate data with Zod schema
  const validated = expenseSchema.parse(data)

  const { data: created, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, ...validated })
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
 */
export async function toggleExpenseStatus(
  id: string,
  currentStatus: ExpenseStatus,
): Promise<Expense> {
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
