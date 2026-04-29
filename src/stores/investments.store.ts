import { create } from 'zustand'
import type { InvestmentAccount, InvestmentTransaction } from '../types'
import type {
  InvestmentAccountFormData,
  InvestmentTransactionFormData,
} from '../schemas/investment.schema'
import {
  listAccounts,
  createAccount as createAccountService,
  updateAccount as updateAccountService,
  deleteAccount as deleteAccountService,
  addDeposit as addDepositService,
  addWithdrawal as addWithdrawalService,
  listTransactions,
} from '../services/investments.service'

interface InvestmentsState {
  accounts: InvestmentAccount[]
  transactions: Record<string, InvestmentTransaction[]>
  loading: boolean
  fetchAccounts: (userId: string) => Promise<void>
  createAccount: (userId: string, data: InvestmentAccountFormData) => Promise<void>
  updateAccount: (id: string, data: Partial<InvestmentAccountFormData> & { saldo_atual?: number }) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  addDeposit: (data: InvestmentTransactionFormData) => Promise<void>
  addWithdrawal: (data: InvestmentTransactionFormData) => Promise<void>
  fetchTransactions: (accountId: string) => Promise<void>
}

export const useInvestmentsStore = create<InvestmentsState>((set, get) => ({
  accounts: [],
  transactions: {},
  loading: false,

  fetchAccounts: async (userId) => {
    set({ loading: true })
    try {
      const accounts = await listAccounts(userId)
      set({ accounts })
    } finally {
      set({ loading: false })
    }
  },

  createAccount: async (userId, data) => {
    const created = await createAccountService(userId, data)
    set((state) => ({ accounts: [...state.accounts, created] }))
  },

  updateAccount: async (id, data) => {
    const updated = await updateAccountService(id, data)
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? updated : a)),
    }))
  },

  deleteAccount: async (id) => {
    const { accounts } = get()
    set({ accounts: accounts.filter((a) => a.id !== id) })
    try {
      await deleteAccountService(id)
    } catch (error) {
      set({ accounts })
      throw error
    }
  },

  addDeposit: async (data) => {
    const { accounts, transactions } = get()

    const tx = await addDepositService(data)

    // Update transactions for the account
    const accountTxs = transactions[tx.conta_id] ?? []
    const updatedTransactions = {
      ...transactions,
      [tx.conta_id]: [...accountTxs, tx],
    }

    // Optimistically update account balance
    const updatedAccounts = accounts.map((a) =>
      a.id === tx.conta_id
        ? { ...a, saldo_atual: a.saldo_atual + tx.valor }
        : a,
    )

    set({ accounts: updatedAccounts, transactions: updatedTransactions })
  },

  addWithdrawal: async (data) => {
    const { accounts, transactions } = get()

    const tx = await addWithdrawalService(data)

    // Update transactions for the account
    const accountTxs = transactions[tx.conta_id] ?? []
    const updatedTransactions = {
      ...transactions,
      [tx.conta_id]: [...accountTxs, tx],
    }

    // Optimistically update account balance
    const updatedAccounts = accounts.map((a) =>
      a.id === tx.conta_id
        ? { ...a, saldo_atual: a.saldo_atual - tx.valor }
        : a,
    )

    set({ accounts: updatedAccounts, transactions: updatedTransactions })
  },

  fetchTransactions: async (accountId) => {
    set({ loading: true })
    try {
      const txs = await listTransactions(accountId)
      set((state) => ({
        transactions: { ...state.transactions, [accountId]: txs },
      }))
    } finally {
      set({ loading: false })
    }
  },
}))
