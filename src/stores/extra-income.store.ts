import { create } from 'zustand'
import type { ExtraIncome } from '../types'
import type { ExtraIncomeFormData } from '../schemas/extra-income.schema'
import {
  listExtraIncomes,
  createExtraIncome,
  updateExtraIncome as updateExtraIncomeService,
  deleteExtraIncome,
} from '../services/extra-income.service'

interface ExtraIncomeState {
  extraIncomes: ExtraIncome[]
  loading: boolean
  fetchExtraIncomes: (userId: string, month: number, year: number) => Promise<void>
  addExtraIncome: (userId: string, data: ExtraIncomeFormData, month: number, year: number) => Promise<void>
  updateExtraIncome: (id: string, data: ExtraIncomeFormData) => Promise<void>
  removeExtraIncome: (id: string) => Promise<void>
}

export const useExtraIncomeStore = create<ExtraIncomeState>((set, get) => ({
  extraIncomes: [],
  loading: false,

  fetchExtraIncomes: async (userId, month, year) => {
    set({ loading: true })
    try {
      const extraIncomes = await listExtraIncomes(userId, month, year)
      set({ extraIncomes })
    } finally {
      set({ loading: false })
    }
  },

  addExtraIncome: async (userId, data, month, year) => {
    const created = await createExtraIncome(userId, data, month, year)
    set((state) => ({ extraIncomes: [...state.extraIncomes, created] }))
  },

  updateExtraIncome: async (id, data) => {
    const { extraIncomes } = get()

    // Optimistic update
    const optimisticIncomes = extraIncomes.map((e) =>
      e.id === id ? { ...e, descricao: data.descricao, valor: data.valor, quinzena: data.quinzena as ExtraIncome['quinzena'] } : e,
    )
    set({ extraIncomes: optimisticIncomes })

    try {
      const updated = await updateExtraIncomeService(id, data)
      set((state) => ({
        extraIncomes: state.extraIncomes.map((e) => (e.id === id ? updated : e)),
      }))
    } catch (error) {
      // Rollback on error
      set({ extraIncomes })
      throw error
    }
  },

  removeExtraIncome: async (id) => {
    const { extraIncomes } = get()

    // Optimistic update
    set({ extraIncomes: extraIncomes.filter((e) => e.id !== id) })

    try {
      await deleteExtraIncome(id)
    } catch (error) {
      // Rollback on error
      set({ extraIncomes })
      throw error
    }
  },
}))
