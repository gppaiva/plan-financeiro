import { supabase } from '../lib/supabase'
import type { ThirdPartyExpense, ExpenseStatus, PersonTotal } from '../types'
import { thirdPartyExpenseSchema } from '../schemas/third-party.schema'
import type { ThirdPartyExpenseFormData } from '../schemas/third-party.schema'

const TABLE = 'third_party_expenses'

/**
 * Lists all third-party expenses for a user, ordered by due date ascending.
 */
export async function listThirdPartyExpenses(
  userId: string,
): Promise<ThirdPartyExpense[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('data_vencimento', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ThirdPartyExpense[]
}

/**
 * Creates a new third-party expense after validating with Zod schema.
 */
export async function createThirdPartyExpense(
  userId: string,
  data: ThirdPartyExpenseFormData,
): Promise<ThirdPartyExpense> {
  const validated = thirdPartyExpenseSchema.parse(data)

  const { data: created, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, ...validated })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created as ThirdPartyExpense
}

/**
 * Updates an existing third-party expense.
 */
export async function updateThirdPartyExpense(
  id: string,
  data: Partial<ThirdPartyExpenseFormData>,
): Promise<ThirdPartyExpense> {
  const { data: updated, error } = await supabase
    .from(TABLE)
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updated as ThirdPartyExpense
}

/**
 * Deletes a third-party expense by id.
 */
export async function deleteThirdPartyExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Toggles third-party expense status between 'paid' and 'pending'.
 */
export async function toggleThirdPartyStatus(
  id: string,
  currentStatus: ExpenseStatus,
): Promise<ThirdPartyExpense> {
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

  return updated as ThirdPartyExpense
}

/**
 * Returns the total expense amount grouped by person (pessoa) for a user.
 */
export async function getTotalByPerson(
  userId: string,
): Promise<PersonTotal[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  const expenses = (data ?? []) as ThirdPartyExpense[]

  const totalsMap = new Map<string, number>()
  for (const expense of expenses) {
    const current = totalsMap.get(expense.pessoa) ?? 0
    totalsMap.set(expense.pessoa, current + expense.valor)
  }

  const result: PersonTotal[] = []
  for (const [pessoa, total] of totalsMap) {
    result.push({ pessoa, total })
  }

  return result
}
