import { create } from 'zustand'
import type { ThirdPartyExpense } from '../types'
import type { ThirdPartyExpenseFormData } from '../schemas/third-party.schema'
import {
  listThirdPartyExpenses,
  createThirdPartyExpense,
  toggleThirdPartyStatus as toggleThirdPartyStatusService,
  deleteThirdPartyExpense,
} from '../services/third-party.service'

interface ThirdPartyState {
  expenses: ThirdPartyExpense[]
  loading: boolean
  fetchExpenses: (userId: string) => Promise<void>
  addExpense: (userId: string, data: ThirdPartyExpenseFormData) => Promise<void>
  toggleStatus: (id: string) => Promise<void>
  removeExpense: (id: string) => Promise<void>
}

export const useThirdPartyStore = create<ThirdPartyState>((set, get) => ({
  expenses: [],
  loading: false,

  fetchExpenses: async (userId) => {
    set({ loading: true })
    try {
      const expenses = await listThirdPartyExpenses(userId)
      set({ expenses })
    } finally {
      set({ loading: false })
    }
  },

  addExpense: async (userId, data) => {
    const created = await createThirdPartyExpense(userId, data)
    set((state) => ({ expenses: [...state.expenses, created] }))
  },

  toggleStatus: async (id) => {
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
      const updated = await toggleThirdPartyStatusService(id, expense.status)
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
      await deleteThirdPartyExpense(id)
    } catch (error) {
      // Rollback on error
      set({ expenses })
      throw error
    }
  },
}))
