import { supabase } from '../lib/supabase'
import type { Debtor, DebtorPayment } from '../types'

const DEBTORS_TABLE = 'debtors'
const PAYMENTS_TABLE = 'debtor_payments'

export async function fetchDebtors(userId: string): Promise<Debtor[]> {
  const { data, error } = await supabase
    .from(DEBTORS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Debtor[]
}

export async function createDebtor(
  userId: string,
  data: { nome: string; descricao: string; valor_total: number },
): Promise<Debtor> {
  const { data: created, error } = await supabase
    .from(DEBTORS_TABLE)
    .insert({ user_id: userId, ...data, status: 'open' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return created as Debtor
}

export async function updateDebtor(
  id: string,
  data: { nome?: string; descricao?: string; valor_total?: number },
): Promise<Debtor> {
  const { data: updated, error } = await supabase
    .from(DEBTORS_TABLE)
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return updated as Debtor
}

export async function deleteDebtor(id: string): Promise<void> {
  // Delete payments first
  await supabase.from(PAYMENTS_TABLE).delete().eq('debtor_id', id)
  const { error } = await supabase.from(DEBTORS_TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchPayments(debtorId: string): Promise<DebtorPayment[]> {
  const { data, error } = await supabase
    .from(PAYMENTS_TABLE)
    .select('*')
    .eq('debtor_id', debtorId)
    .order('data_pagamento', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as DebtorPayment[]
}

export async function addPayment(
  debtorId: string,
  data: { valor: number; data_pagamento: string },
): Promise<DebtorPayment> {
  const { data: created, error } = await supabase
    .from(PAYMENTS_TABLE)
    .insert({ debtor_id: debtorId, ...data })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Check if debt is fully paid
  const { data: allPayments } = await supabase
    .from(PAYMENTS_TABLE)
    .select('valor')
    .eq('debtor_id', debtorId)

  const { data: debtor } = await supabase
    .from(DEBTORS_TABLE)
    .select('valor_total')
    .eq('id', debtorId)
    .single()

  if (debtor && allPayments) {
    const totalPaid = allPayments.reduce((sum: number, p: { valor: number }) => sum + Number(p.valor), 0)
    if (totalPaid >= debtor.valor_total) {
      await supabase.from(DEBTORS_TABLE).update({ status: 'paid' }).eq('id', debtorId)
    } else {
      await supabase.from(DEBTORS_TABLE).update({ status: 'open' }).eq('id', debtorId)
    }
  }

  return created as DebtorPayment
}

export async function deletePayment(paymentId: string, debtorId: string): Promise<void> {
  const { error } = await supabase.from(PAYMENTS_TABLE).delete().eq('id', paymentId)
  if (error) throw new Error(error.message)

  // Recalculate status
  const { data: allPayments } = await supabase
    .from(PAYMENTS_TABLE)
    .select('valor')
    .eq('debtor_id', debtorId)

  const { data: debtor } = await supabase
    .from(DEBTORS_TABLE)
    .select('valor_total')
    .eq('id', debtorId)
    .single()

  if (debtor && allPayments) {
    const totalPaid = allPayments.reduce((sum: number, p: { valor: number }) => sum + Number(p.valor), 0)
    const newStatus = totalPaid >= debtor.valor_total ? 'paid' : 'open'
    await supabase.from(DEBTORS_TABLE).update({ status: newStatus }).eq('id', debtorId)
  }
}
