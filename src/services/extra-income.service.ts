import { supabase } from '../lib/supabase'
import type { ExtraIncome } from '../types'
import { extraIncomeSchema, createExtraIncomeSchema } from '../schemas/extra-income.schema'
import type { ExtraIncomeFormData } from '../schemas/extra-income.schema'

const TABLE = 'extra_incomes'

/**
 * Lists extra incomes for a user filtered by month/year date range.
 */
export async function listExtraIncomes(
  userId: string,
  month: number,
  year: number,
): Promise<ExtraIncome[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .gte('data', startDate)
    .lte('data', endDate)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ExtraIncome[]
}

/**
 * Creates a new extra income after validating with Zod schema.
 * Sets the `data` field to the first day of the selected month.
 * Accepts an optional cicloTipo to use the appropriate schema for validation.
 * For mensal users, quinzena is optional (null in DB).
 */
export async function createExtraIncome(
  userId: string,
  data: ExtraIncomeFormData & { quinzena?: string | null },
  month: number,
  year: number,
  cicloTipo?: string,
): Promise<ExtraIncome> {
  const schema = cicloTipo ? createExtraIncomeSchema(cicloTipo) : extraIncomeSchema
  const validated = schema.parse(data)

  const firstDayOfMonth = `${year}-${String(month).padStart(2, '0')}-01`

  const { data: created, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      descricao: validated.descricao,
      valor: validated.valor,
      quinzena: validated.quinzena ?? null,
      data: firstDayOfMonth,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created as ExtraIncome
}

/**
 * Updates an existing extra income's description and value.
 */
export async function updateExtraIncome(
  id: string,
  data: ExtraIncomeFormData,
): Promise<ExtraIncome> {
  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({
      descricao: data.descricao,
      valor: data.valor,
      quinzena: data.quinzena,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updated as ExtraIncome
}

/**
 * Deletes an extra income by id.
 */
export async function deleteExtraIncome(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}
