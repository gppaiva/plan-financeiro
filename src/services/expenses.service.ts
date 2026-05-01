import { supabase } from '../lib/supabase'
import type { EditScope, Expense, ExpenseFilters, ExpenseOverride, ExpenseStatus } from '../types'
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

  // Get monthly overrides for recurring expenses
  const overrides = await getMonthlyOverrides(recurringIds, filters.month, filters.year)

  // Apply monthly status and overrides to recurring expenses
  const recurringWithStatus = filteredRecurring.map((expense: Expense) => {
    const override = overrides.find((o) => o.expense_id === expense.id)
    return {
      ...expense,
      ...(override?.valor != null && { valor: override.valor }),
      ...(override?.descricao != null && { descricao: override.descricao }),
      ...(override?.categoria != null && { categoria: override.categoria }),
      ...(override?.quinzena != null && { quinzena: override.quinzena }),
      ...(override?.dia_vencimento != null && {
        data_vencimento: `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(override.dia_vencimento).padStart(2, '0')}`,
      }),
      status: payments[expense.id] || 'pending' as ExpenseStatus,
    }
  })

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


/**
 * Gets monthly overrides for recurring expenses in a specific month.
 */
export async function getMonthlyOverrides(
  expenseIds: string[],
  month: number,
  year: number,
): Promise<ExpenseOverride[]> {
  if (expenseIds.length === 0) return []

  const { data, error } = await supabase
    .from('expense_overrides')
    .select('*')
    .in('expense_id', expenseIds)
    .eq('mes', month)
    .eq('ano', year)

  if (error) throw new Error(error.message)
  return (data ?? []) as ExpenseOverride[]
}

/**
 * Creates or updates a monthly override for a recurring expense.
 */
export async function upsertExpenseOverride(
  expenseId: string,
  month: number,
  year: number,
  data: {
    valor?: number | null
    descricao?: string | null
    categoria?: string | null
    quinzena?: string | null
    dia_vencimento?: number | null
  },
): Promise<ExpenseOverride> {
  const { data: upserted, error } = await supabase
    .from('expense_overrides')
    .upsert(
      {
        expense_id: expenseId,
        mes: month,
        ano: year,
        ...data,
      },
      { onConflict: 'expense_id,mes,ano' },
    )
    .select()
    .single()

  if (error) throw new Error(error.message)
  return upserted as ExpenseOverride
}

/**
 * Updates an expense with scope awareness for recurring expenses.
 * - 'only_this_month': creates/updates a monthly override (base record unchanged)
 * - 'this_and_future': updates the base record directly
 */
export async function updateExpenseWithScope(
  id: string,
  data: Partial<ExpenseFormData>,
  scope: EditScope,
  month: number,
  year: number,
): Promise<Expense> {
  if (scope === 'only_this_month') {
    // Create/update override — base record stays unchanged
    const overrideData: Record<string, unknown> = {}
    if (data.valor !== undefined) overrideData.valor = data.valor
    if (data.descricao !== undefined) overrideData.descricao = data.descricao
    if (data.categoria !== undefined) overrideData.categoria = data.categoria
    if (data.quinzena !== undefined) overrideData.quinzena = data.quinzena
    if (data.data_vencimento !== undefined) {
      // Extract day from date string (YYYY-MM-DD)
      const day = parseInt(data.data_vencimento.split('-')[2], 10)
      overrideData.dia_vencimento = day
    }

    await upsertExpenseOverride(id, month, year, overrideData)

    // Return the expense with overridden fields applied (for UI update)
    const { data: expense, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw new Error(error.message)

    return {
      ...(expense as Expense),
      ...data,
    }
  }

  // scope === 'this_and_future': update the base record
  return updateExpense(id, data)
}
