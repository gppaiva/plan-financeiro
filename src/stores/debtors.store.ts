import { create } from 'zustand'
import type { Debtor, DebtorPayment } from '../types'
import * as service from '../services/debtors.service'

interface DebtorsState {
  debtors: Debtor[]
  payments: Map<string, DebtorPayment[]>
  loading: boolean
  fetchDebtors: (userId: string) => Promise<void>
  addDebtor: (userId: string, data: { nome: string; descricao: string; valor_total: number }) => Promise<void>
  updateDebtor: (id: string, data: { nome?: string; descricao?: string; valor_total?: number }) => Promise<void>
  deleteDebtor: (id: string) => Promise<void>
  fetchPayments: (debtorId: string) => Promise<void>
  addPayment: (debtorId: string, data: { valor: number; data_pagamento: string }) => Promise<void>
  deletePayment: (paymentId: string, debtorId: string) => Promise<void>
}

export const useDebtorsStore = create<DebtorsState>((set, get) => ({
  debtors: [],
  payments: new Map(),
  loading: false,

  fetchDebtors: async (userId) => {
    set({ loading: true })
    try {
      const debtors = await service.fetchDebtors(userId)
      set({ debtors })
    } finally {
      set({ loading: false })
    }
  },

  addDebtor: async (userId, data) => {
    const created = await service.createDebtor(userId, data)
    set((state) => ({ debtors: [created, ...state.debtors] }))
  },

  updateDebtor: async (id, data) => {
    const updated = await service.updateDebtor(id, data)
    set((state) => ({
      debtors: state.debtors.map((d) => (d.id === id ? updated : d)),
    }))
  },

  deleteDebtor: async (id) => {
    await service.deleteDebtor(id)
    set((state) => ({
      debtors: state.debtors.filter((d) => d.id !== id),
    }))
  },

  fetchPayments: async (debtorId) => {
    const payments = await service.fetchPayments(debtorId)
    set((state) => {
      const newMap = new Map(state.payments)
      newMap.set(debtorId, payments)
      return { payments: newMap }
    })
  },

  addPayment: async (debtorId, data) => {
    await service.addPayment(debtorId, data)
    // Refresh payments and debtors to get updated status
    const payments = await service.fetchPayments(debtorId)
    const { debtors } = get()
    const userId = debtors.find((d) => d.id === debtorId)?.user_id
    set((state) => {
      const newMap = new Map(state.payments)
      newMap.set(debtorId, payments)
      return { payments: newMap }
    })
    if (userId) {
      const updatedDebtors = await service.fetchDebtors(userId)
      set({ debtors: updatedDebtors })
    }
  },

  deletePayment: async (paymentId, debtorId) => {
    await service.deletePayment(paymentId, debtorId)
    const payments = await service.fetchPayments(debtorId)
    const { debtors } = get()
    const userId = debtors.find((d) => d.id === debtorId)?.user_id
    set((state) => {
      const newMap = new Map(state.payments)
      newMap.set(debtorId, payments)
      return { payments: newMap }
    })
    if (userId) {
      const updatedDebtors = await service.fetchDebtors(userId)
      set({ debtors: updatedDebtors })
    }
  },
}))
