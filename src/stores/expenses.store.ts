import { create } from 'zustand'
import type { EditScope, Expense, ExpenseFilters } from '../types'
import type { ExpenseFormData } from '../schemas/expense.schema'
import {
  listExpenses,
  createExpense,
  updateExpense as updateExpenseService,
  updateExpenseWithScope,
  toggleExpenseStatus as toggleExpenseStatusService,
  deleteExpense,
} from '../services/expenses.service'

interface ExpensesState {
  expenses: Expense[]
  loading: boolean
  fetchExpenses: (userId: string, filters?: ExpenseFilters) => Promise<void>
  addExpense: (userId: string, data: ExpenseFormData) => Promise<void>
  updateExpense: (id: string, data: Partial<ExpenseFormData>, scope?: EditScope, month?: number, year?: number) => Promise<void>
  toggleExpenseStatus: (id: string, month?: number, year?: number) => Promise<void>
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

  updateExpense: async (id, data, scope, month, year) => {
    if (scope && month !== undefined && year !== undefined) {
      // Recurring expense with scope — use scoped update
      await updateExpenseWithScope(id, data, scope, month, year)
      // Re-fetch expenses to reflect overrides in the listing
      const { expenses } = get()
      if (expenses.length > 0) {
        const userId = expenses[0].user_id
        await get().fetchExpenses(userId, { month, year })
      }
    } else {
      // Non-recurring expense — keep current behavior
      const updated = await updateExpenseService(id, data)
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
      }))
    }
  },

  toggleExpenseStatus: async (id, month, year) => {
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
      const updated = await toggleExpenseStatusService(id, expense.status, month, year)
      set((state) => ({
        expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
      }))
    } catch (error) {
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
