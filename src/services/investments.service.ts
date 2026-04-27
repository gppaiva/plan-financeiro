import { supabase } from '../lib/supabase'
import type { InvestmentAccount, InvestmentTransaction } from '../types'
import { investmentAccountSchema, investmentTransactionSchema } from '../schemas/investment.schema'
import type { InvestmentAccountFormData, InvestmentTransactionFormData } from '../schemas/investment.schema'

const ACCOUNTS_TABLE = 'investment_accounts'
const TRANSACTIONS_TABLE = 'investment_transactions'

/**
 * Lists all investment accounts for a user, ordered by name ascending.
 */
export async function listAccounts(
  userId: string,
): Promise<InvestmentAccount[]> {
  const { data, error } = await supabase
    .from(ACCOUNTS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('nome', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as InvestmentAccount[]
}

/**
 * Creates a new investment account after validating with Zod schema.
 */
export async function createAccount(
  userId: string,
  data: InvestmentAccountFormData,
): Promise<InvestmentAccount> {
  const validated = investmentAccountSchema.parse(data)

  const { data: created, error } = await supabase
    .from(ACCOUNTS_TABLE)
    .insert({ user_id: userId, ...validated })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created as InvestmentAccount
}

/**
 * Lists all transactions for a given investment account, ordered by date ascending.
 */
export async function listTransactions(
  accountId: string,
): Promise<InvestmentTransaction[]> {
  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select('*')
    .eq('conta_id', accountId)
    .order('data', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as InvestmentTransaction[]
}

/**
 * Adds a deposit (aporte) transaction after validating with Zod schema.
 */
export async function addDeposit(
  data: InvestmentTransactionFormData,
): Promise<InvestmentTransaction> {
  const validated = investmentTransactionSchema.parse({ ...data, tipo: 'aporte' })

  const { data: created, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .insert(validated)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created as InvestmentTransaction
}

/**
 * Adds a withdrawal (resgate) transaction after validating with Zod schema.
 */
export async function addWithdrawal(
  data: InvestmentTransactionFormData,
): Promise<InvestmentTransaction> {
  const validated = investmentTransactionSchema.parse({ ...data, tipo: 'resgate' })

  const { data: created, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .insert(validated)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return created as InvestmentTransaction
}

/**
 * Calculates the balance for a given investment account.
 * Balance = sum of deposits (aporte) - sum of withdrawals (resgate).
 */
export async function getAccountBalance(
  accountId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select('*')
    .eq('conta_id', accountId)

  if (error) {
    throw new Error(error.message)
  }

  const transactions = (data ?? []) as InvestmentTransaction[]

  let balance = 0
  for (const tx of transactions) {
    if (tx.tipo === 'aporte') {
      balance += tx.valor
    } else {
      balance -= tx.valor
    }
  }

  return balance
}

/**
 * Calculates the total invested across all accounts for a user.
 * Sums the balance (deposits - withdrawals) of each account.
 */
export async function getTotalInvested(
  userId: string,
): Promise<number> {
  const accounts = await listAccounts(userId)

  let total = 0
  for (const account of accounts) {
    const balance = await getAccountBalance(account.id)
    total += balance
  }

  return total
}
