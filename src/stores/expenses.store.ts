import { create } from 'zustand'
import type { Expense, ExpenseFilters } from '../types'
import type { ExpenseFormData } from '../schemas/expense.schema'
import {
  listExpenses,
  createExpense,
  toggleExpenseStatus as toggleExpenseStatusService,
  deleteExpense,
} from '../services/expenses.service'

interface ExpensesState {
  expenses: Expense[]
  loading: boolean
  fetchExpenses: (userId: string, filters?: ExpenseFilters) => Promise<void>
  addExpense: (userId: string, data: ExpenseFormData) => Promise<void>
  toggleExpenseStatus: (id: string) => Promise<void>
  removeExpense: (id: string) => Promise<void>
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
  expenses: [],
  loading: false,

  fetchExpenses: async (userId, filters) => {
    set({ loading: true })
    try {
      const expenses = await listExpenses(userId, filters)
      set({ expenses })
    } finally {
      set({ loading: false })
    }
  },

  addExpense: async (userId, data) => {
    const created = await createExpense(userId, data)
    set((state) => ({ expenses: [...state.expenses, created] }))
  },

  toggleExpenseStatus: async (id) => {
    const { expenses } = get()
    const expense = expenses.find((e) => e.id === id)
    if (!expense) return

    // Optimistic update
    const updatedExpenses = expenses.map((e) =>
      e.id === id
        ? { ...e, status: e.status === 'paid' ? ('pending' as const) : ('paid' as const) }
        : e,
    )
    set({ expenses: updatedExpenses })

    try {
      const updated = await toggleExpenseStatusService(id, expense.status)
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
      }))
    } catch (error) {
      // Rollback on error
      set({ expenses })
      throw error
    }
  },

  removeExpense: async (id) => {
    const { expenses } = get()

    // Optimistic update
    set({ expenses: expenses.filter((e) => e.id !== id) })

    try {
      await deleteExpense(id)
    } catch (error) {
      // Rollback on error
      set({ expenses })
      throw error
    }
  },
}))
