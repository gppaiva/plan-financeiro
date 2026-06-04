import { supabase } from '../lib/supabase'
import type { ThirdPartyExpense, ExpenseStatus, PersonTotal } from '../types'
import { thirdPartyExpenseSchema } from '../schemas/third-party.schema'
import type { ThirdPartyExpenseFormData } from '../schemas/third-party.schema'

const TABLE = 'third_party_expenses'

/**
 * Lists third-party expenses for a user, optionally filtered by month/year.
 */
export async function listThirdPartyExpenses(
  userId: string,
  filters?: { month: number; year: number },
): Promise<(ThirdPartyExpense & { data_compra?: string })[]> {
  let query = supabase
    .from(TABLE)
    .select('*, invoice_items!source_invoice_item_id(data_compra)')
    .eq('user_id', userId)

  if (filters) {
    const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
    const lastDay = new Date(filters.year, filters.month, 0).getDate()
    const endDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate)
  }

  const { data, error } = await query.order('data_vencimento', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  // Flatten the joined data
  return (data ?? []).map((item) => {
    const { invoice_items, ...rest } = item as Record<string, unknown> & { invoice_items?: { data_compra: string } | null }
    return {
      ...rest,
      data_compra: invoice_items?.data_compra ?? undefined,
    }
  }) as unknown as (ThirdPartyExpense & { data_compra?: string })[]
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
 * If it was redirected from an invoice item, returns the value back to the invoice.
 * If the original invoice item was deleted (value was fully redirected), recreates it.
 */
export async function deleteThirdPartyExpense(id: string): Promise<void> {
  // First, get full info about this expense before deleting
  const { data: expense } = await supabase
    .from(TABLE)
    .select('source_invoice_item_id, valor, descricao, data_vencimento, user_id')
    .eq('id', id)
    .single()

  // Delete the expense
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  // If it came from an invoice item, return the value
  if (expense?.source_invoice_item_id) {
    try {
      // Get current invoice item value
      const { data: item } = await supabase
        .from('invoice_items')
        .select('id, valor, expense_id, descricao, data_compra, categoria_c6, parcela')
        .eq('id', expense.source_invoice_item_id)
        .single()

      if (item) {
        // Item still exists — add back the value
        const newItemValor = Math.round((Number(item.valor) + Number(expense.valor)) * 100) / 100

        // Update invoice item value
        await supabase
          .from('invoice_items')
          .update({ valor: newItemValor })
          .eq('id', expense.source_invoice_item_id)

        // Recalculate expense total
        const { data: allItems } = await supabase
          .from('invoice_items')
          .select('valor')
          .eq('expense_id', item.expense_id)

        if (allItems) {
          const newTotal = allItems.reduce((sum: number, i: { valor: number }) => sum + Number(i.valor), 0)
          // Add the value we just updated (allItems may have stale data)
          const roundedTotal = Math.round(newTotal * 100) / 100
          await supabase
            .from('expenses')
            .update({ valor: roundedTotal })
            .eq('id', item.expense_id)
        }
      } else {
        // Item was deleted (full value was redirected) — recreate it
        // Find the parent expense (invoice) by looking for invoices that match
        // the data_vencimento of this third-party expense
        const { data: invoiceExpenses } = await supabase
          .from('expenses')
          .select('id')
          .eq('user_id', expense.user_id)
          .eq('categoria', 'Cartão')
          .eq('data_vencimento', expense.data_vencimento)
          .limit(1)

        if (invoiceExpenses && invoiceExpenses.length > 0) {
          const invoiceExpenseId = invoiceExpenses[0].id

          // Recreate the invoice item
          await supabase
            .from('invoice_items')
            .insert({
              id: expense.source_invoice_item_id, // Reuse the same ID
              expense_id: invoiceExpenseId,
              data_compra: expense.data_vencimento, // Best approximation
              descricao: expense.descricao,
              categoria_c6: '',
              parcela: 'Única',
              valor: expense.valor,
            })

          // Recalculate total
          const { data: allItems } = await supabase
            .from('invoice_items')
            .select('valor')
            .eq('expense_id', invoiceExpenseId)

          if (allItems) {
            const newTotal = allItems.reduce((sum: number, i: { valor: number }) => sum + Number(i.valor), 0)
            const roundedTotal = Math.round(newTotal * 100) / 100
            await supabase
              .from('expenses')
              .update({ valor: roundedTotal })
              .eq('id', invoiceExpenseId)
          }
        }
      }
    } catch (err) {
      // Value return failed but expense was already deleted — log but don't throw
      console.error('Erro ao retornar valor para item da fatura:', err)
    }
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
