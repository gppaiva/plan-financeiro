import { supabase } from '../lib/supabase'
import type { Expense, InvoiceItem } from '../types'

const ITEMS_TABLE = 'invoice_items'
const EXPENSES_TABLE = 'expenses'

/**
 * Creates an invoice (expense with category "Cartão") and its items in a single operation.
 * Uses manual rollback: if items insertion fails, deletes the created expense.
 */
export async function createInvoice(
  userId: string,
  data: {
    descricao: string
    dataVencimento: string
    quinzena: string | null
    items: Array<{
      data_compra: string
      descricao: string
      categoria_c6: string
      parcela: string
      valor: number
    }>
  },
): Promise<Expense> {
  const totalValor = data.items.reduce((sum, item) => sum + item.valor, 0)
  const roundedTotal = Math.round(totalValor * 100) / 100

  // 1. Create the expense
  const { data: expense, error: expenseError } = await supabase
    .from(EXPENSES_TABLE)
    .insert({
      user_id: userId,
      descricao: data.descricao,
      valor: roundedTotal,
      categoria: 'Cartão',
      data_vencimento: data.dataVencimento,
      quinzena: data.quinzena,
      status: 'pending',
      recorrente: false,
    })
    .select()
    .single()

  if (expenseError) {
    throw new Error(expenseError.message)
  }

  // 2. Insert items in batch
  const itemsToInsert = data.items.map((item) => ({
    expense_id: expense.id,
    data_compra: item.data_compra,
    descricao: item.descricao,
    categoria_c6: item.categoria_c6,
    parcela: item.parcela,
    valor: item.valor,
  }))

  const { error: itemsError } = await supabase
    .from(ITEMS_TABLE)
    .insert(itemsToInsert)

  if (itemsError) {
    // Rollback: delete the expense we just created
    await supabase.from(EXPENSES_TABLE).delete().eq('id', expense.id)
    throw new Error(itemsError.message)
  }

  return expense as Expense
}

/**
 * Lists invoice items linked to an expense, ordered by data_compra ASC.
 */
export async function listInvoiceItems(expenseId: string): Promise<InvoiceItem[]> {
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select('*')
    .eq('expense_id', expenseId)
    .order('data_compra', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as InvoiceItem[]
}

/**
 * Updates the value of an invoice item and recalculates the expense total.
 */
export async function updateInvoiceItem(
  itemId: string,
  expenseId: string,
  newValor: number,
): Promise<{ item: InvoiceItem; newTotal: number }> {
  // 1. Update the item
  const { data: updatedItem, error: itemError } = await supabase
    .from(ITEMS_TABLE)
    .update({ valor: newValor })
    .eq('id', itemId)
    .select()
    .single()

  if (itemError) throw new Error(itemError.message)

  // 2. Recalculate total from all items
  const { data: allItems, error: sumError } = await supabase
    .from(ITEMS_TABLE)
    .select('valor')
    .eq('expense_id', expenseId)

  if (sumError) throw new Error(sumError.message)

  const newTotal = (allItems ?? []).reduce(
    (sum: number, item: { valor: number }) => sum + Number(item.valor),
    0,
  )
  const roundedTotal = Math.round(newTotal * 100) / 100

  // 3. Update the expense total
  const { error: expenseError } = await supabase
    .from(EXPENSES_TABLE)
    .update({ valor: roundedTotal })
    .eq('id', expenseId)

  if (expenseError) throw new Error(expenseError.message)

  return { item: updatedItem as InvoiceItem, newTotal: roundedTotal }
}

/**
 * Checks if an expense has linked invoice items.
 */
export async function hasInvoiceItems(expenseId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from(ITEMS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('expense_id', expenseId)

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}
