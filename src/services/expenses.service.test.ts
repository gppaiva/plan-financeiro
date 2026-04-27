import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExpenseFormData } from '../schemas/expense.schema'
import type { ExpenseStatus } from '../types'

// ── Hoisted mocks (vi.mock factories are hoisted above imports) ──────────────

const {
  mockSingle,
  mockSelect,
  mockEq,
  mockInsert,
  mockUpdate,
  mockDelete,
  mockFrom,
  mockOrder,
  mockGte,
  mockLte,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockOrder = vi.fn()
  const mockLte = vi.fn()
  const mockGte = vi.fn()
  const mockEq = vi.fn()
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))
  const mockDelete = vi.fn(() => ({ eq: mockEq }))

  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({ eq: mockEq })),
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  }))

  return {
    mockSingle,
    mockSelect,
    mockEq,
    mockInsert,
    mockUpdate,
    mockDelete,
    mockFrom,
    mockOrder,
    mockGte,
    mockLte,
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Import after mock ────────────────────────────────────────────────────────

import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  toggleExpenseStatus,
} from './expenses.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-123'

const sampleExpense = {
  id: 'expense-uuid-1',
  user_id: USER_ID,
  descricao: 'Aluguel',
  valor: 1500,
  categoria: 'Moradia' as const,
  data_vencimento: '2024-06-10',
  quinzena: '1' as const,
  status: 'pending' as const,
  recorrente: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const sampleFormData: ExpenseFormData = {
  descricao: 'Aluguel',
  valor: 1500,
  categoria: 'Moradia',
  data_vencimento: '2024-06-10',
  quinzena: '1',
  status: 'pending',
  recorrente: true,
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('expenses.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── listExpenses ─────────────────────────────────────────────────────────

  describe('listExpenses', () => {
    it('returns all expenses for a user without filters', async () => {
      // Build a chainable mock: from().select().eq().order()
      mockOrder.mockReturnValue({ data: [sampleExpense], error: null })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      const result = await listExpenses(USER_ID)

      expect(mockFrom).toHaveBeenCalledWith('expenses')
      expect(result).toEqual([sampleExpense])
    })

    it('applies month/year filters via date range', async () => {
      // Chain: from().select().eq().gte().lte().order()
      mockOrder.mockReturnValue({ data: [sampleExpense], error: null })
      mockLte.mockReturnValue({ order: mockOrder })
      mockGte.mockReturnValue({ lte: mockLte })
      mockEq.mockReturnValue({ gte: mockGte })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      const result = await listExpenses(USER_ID, { month: 6, year: 2024 })

      expect(mockGte).toHaveBeenCalledWith('data_vencimento', '2024-06-01')
      expect(mockLte).toHaveBeenCalledWith('data_vencimento', '2024-06-30')
      expect(result).toEqual([sampleExpense])
    })

    it('applies quinzena filter when provided', async () => {
      const mockEqQuinzena = vi.fn(() => ({ order: mockOrder }))
      mockOrder.mockReturnValue({ data: [], error: null })
      mockLte.mockReturnValue({ eq: mockEqQuinzena })
      mockGte.mockReturnValue({ lte: mockLte })
      mockEq.mockReturnValue({ gte: mockGte })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      await listExpenses(USER_ID, { month: 6, year: 2024, quinzena: '1' })

      expect(mockEqQuinzena).toHaveBeenCalledWith('quinzena', '1')
    })

    it('throws on query error', async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: 'Query failed' } })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      await expect(listExpenses(USER_ID)).rejects.toThrow('Query failed')
    })
  })

  // ── createExpense ────────────────────────────────────────────────────────

  describe('createExpense', () => {
    it('validates and inserts a new expense', async () => {
      mockSingle.mockReturnValue({ data: sampleExpense, error: null })

      const result = await createExpense(USER_ID, sampleFormData)

      expect(mockFrom).toHaveBeenCalledWith('expenses')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: USER_ID,
        ...sampleFormData,
      })
      expect(result).toEqual(sampleExpense)
    })

    it('throws ZodError on invalid data', async () => {
      const invalidData = { ...sampleFormData, valor: -100 }

      await expect(createExpense(USER_ID, invalidData as ExpenseFormData)).rejects.toThrow()
    })

    it('throws on insert error', async () => {
      mockSingle.mockReturnValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      await expect(createExpense(USER_ID, sampleFormData)).rejects.toThrow('Insert failed')
    })
  })

  // ── updateExpense ────────────────────────────────────────────────────────

  describe('updateExpense', () => {
    it('updates an expense and returns the updated record', async () => {
      const updatedExpense = { ...sampleExpense, descricao: 'Aluguel Atualizado' }
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: updatedExpense, error: null }) }),
      })

      const result = await updateExpense('expense-uuid-1', { descricao: 'Aluguel Atualizado' })

      expect(mockFrom).toHaveBeenCalledWith('expenses')
      expect(mockUpdate).toHaveBeenCalledWith({ descricao: 'Aluguel Atualizado' })
      expect(result).toEqual(updatedExpense)
    })

    it('throws on update error', async () => {
      mockEq.mockReturnValue({
        select: () => ({
          single: () => ({ data: null, error: { message: 'Update failed' } }),
        }),
      })

      await expect(updateExpense('expense-uuid-1', { valor: 2000 })).rejects.toThrow(
        'Update failed',
      )
    })
  })

  // ── deleteExpense ────────────────────────────────────────────────────────

  describe('deleteExpense', () => {
    it('deletes an expense by id', async () => {
      mockEq.mockReturnValue({ error: null })

      await expect(deleteExpense('expense-uuid-1')).resolves.toBeUndefined()

      expect(mockFrom).toHaveBeenCalledWith('expenses')
    })

    it('throws on delete error', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } })

      await expect(deleteExpense('expense-uuid-1')).rejects.toThrow('Delete failed')
    })
  })

  // ── toggleExpenseStatus ──────────────────────────────────────────────────

  describe('toggleExpenseStatus', () => {
    it('toggles from pending to paid', async () => {
      const paidExpense = { ...sampleExpense, status: 'paid' }
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: paidExpense, error: null }) }),
      })

      const result = await toggleExpenseStatus('expense-uuid-1', 'pending')

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'paid' })
      expect(result).toEqual(paidExpense)
    })

    it('toggles from paid to pending', async () => {
      const pendingExpense = { ...sampleExpense, status: 'pending' }
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: pendingExpense, error: null }) }),
      })

      const result = await toggleExpenseStatus('expense-uuid-1', 'paid')

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending' })
      expect(result).toEqual(pendingExpense)
    })

    it('throws on toggle error', async () => {
      mockEq.mockReturnValue({
        select: () => ({
          single: () => ({ data: null, error: { message: 'Toggle failed' } }),
        }),
      })

      await expect(toggleExpenseStatus('expense-uuid-1', 'pending')).rejects.toThrow(
        'Toggle failed',
      )
    })
  })
})
