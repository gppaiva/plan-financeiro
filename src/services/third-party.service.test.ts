import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ThirdPartyExpenseFormData } from '../schemas/third-party.schema'
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
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockOrder = vi.fn()
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
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Import after mock ────────────────────────────────────────────────────────

import {
  listThirdPartyExpenses,
  createThirdPartyExpense,
  updateThirdPartyExpense,
  deleteThirdPartyExpense,
  toggleThirdPartyStatus,
  getTotalByPerson,
} from './third-party.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-123'

const sampleExpense = {
  id: 'tp-uuid-1',
  user_id: USER_ID,
  pessoa: 'João',
  descricao: 'Empréstimo',
  valor: 500,
  data_vencimento: '2024-06-15',
  status: 'pending' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const sampleFormData: ThirdPartyExpenseFormData = {
  pessoa: 'João',
  descricao: 'Empréstimo',
  valor: 500,
  data_vencimento: '2024-06-15',
  status: 'pending',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('third-party.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── listThirdPartyExpenses ───────────────────────────────────────────────

  describe('listThirdPartyExpenses', () => {
    it('returns all third-party expenses for a user', async () => {
      mockOrder.mockReturnValue({ data: [sampleExpense], error: null })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      const result = await listThirdPartyExpenses(USER_ID)

      expect(mockFrom).toHaveBeenCalledWith('third_party_expenses')
      expect(result).toEqual([sampleExpense])
    })

    it('returns empty array when no expenses exist', async () => {
      mockOrder.mockReturnValue({ data: [], error: null })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      const result = await listThirdPartyExpenses(USER_ID)

      expect(result).toEqual([])
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

      await expect(listThirdPartyExpenses(USER_ID)).rejects.toThrow('Query failed')
    })
  })

  // ── createThirdPartyExpense ──────────────────────────────────────────────

  describe('createThirdPartyExpense', () => {
    it('validates and inserts a new third-party expense', async () => {
      mockSingle.mockReturnValue({ data: sampleExpense, error: null })

      const result = await createThirdPartyExpense(USER_ID, sampleFormData)

      expect(mockFrom).toHaveBeenCalledWith('third_party_expenses')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: USER_ID,
        ...sampleFormData,
      })
      expect(result).toEqual(sampleExpense)
    })

    it('throws ZodError on invalid data (empty pessoa)', async () => {
      const invalidData = { ...sampleFormData, pessoa: '' }

      await expect(
        createThirdPartyExpense(USER_ID, invalidData as ThirdPartyExpenseFormData),
      ).rejects.toThrow()
    })

    it('throws ZodError on invalid data (negative valor)', async () => {
      const invalidData = { ...sampleFormData, valor: -100 }

      await expect(
        createThirdPartyExpense(USER_ID, invalidData as ThirdPartyExpenseFormData),
      ).rejects.toThrow()
    })

    it('throws on insert error', async () => {
      mockSingle.mockReturnValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      await expect(createThirdPartyExpense(USER_ID, sampleFormData)).rejects.toThrow(
        'Insert failed',
      )
    })
  })

  // ── updateThirdPartyExpense ──────────────────────────────────────────────

  describe('updateThirdPartyExpense', () => {
    it('updates a third-party expense and returns the updated record', async () => {
      const updatedExpense = { ...sampleExpense, descricao: 'Empréstimo Atualizado' }
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: updatedExpense, error: null }) }),
      })

      const result = await updateThirdPartyExpense('tp-uuid-1', {
        descricao: 'Empréstimo Atualizado',
      })

      expect(mockFrom).toHaveBeenCalledWith('third_party_expenses')
      expect(mockUpdate).toHaveBeenCalledWith({ descricao: 'Empréstimo Atualizado' })
      expect(result).toEqual(updatedExpense)
    })

    it('throws on update error', async () => {
      mockEq.mockReturnValue({
        select: () => ({
          single: () => ({ data: null, error: { message: 'Update failed' } }),
        }),
      })

      await expect(
        updateThirdPartyExpense('tp-uuid-1', { valor: 1000 }),
      ).rejects.toThrow('Update failed')
    })
  })

  // ── deleteThirdPartyExpense ──────────────────────────────────────────────

  describe('deleteThirdPartyExpense', () => {
    it('deletes a third-party expense by id', async () => {
      mockEq.mockReturnValue({ error: null })

      await expect(deleteThirdPartyExpense('tp-uuid-1')).resolves.toBeUndefined()

      expect(mockFrom).toHaveBeenCalledWith('third_party_expenses')
    })

    it('throws on delete error', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } })

      await expect(deleteThirdPartyExpense('tp-uuid-1')).rejects.toThrow('Delete failed')
    })
  })

  // ── toggleThirdPartyStatus ───────────────────────────────────────────────

  describe('toggleThirdPartyStatus', () => {
    it('toggles from pending to paid', async () => {
      const paidExpense = { ...sampleExpense, status: 'paid' }
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: paidExpense, error: null }) }),
      })

      const result = await toggleThirdPartyStatus('tp-uuid-1', 'pending')

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'paid' })
      expect(result).toEqual(paidExpense)
    })

    it('toggles from paid to pending', async () => {
      const pendingExpense = { ...sampleExpense, status: 'pending' }
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: pendingExpense, error: null }) }),
      })

      const result = await toggleThirdPartyStatus('tp-uuid-1', 'paid')

      expect(mockUpdate).toHaveBeenCalledWith({ status: 'pending' })
      expect(result).toEqual(pendingExpense)
    })

    it('throws on toggle error', async () => {
      mockEq.mockReturnValue({
        select: () => ({
          single: () => ({ data: null, error: { message: 'Toggle failed' } }),
        }),
      })

      await expect(
        toggleThirdPartyStatus('tp-uuid-1', 'pending'),
      ).rejects.toThrow('Toggle failed')
    })
  })

  // ── getTotalByPerson ─────────────────────────────────────────────────────

  describe('getTotalByPerson', () => {
    it('groups expenses by pessoa and sums valor', async () => {
      const expenses = [
        { ...sampleExpense, pessoa: 'João', valor: 500 },
        { ...sampleExpense, id: 'tp-uuid-2', pessoa: 'João', valor: 300 },
        { ...sampleExpense, id: 'tp-uuid-3', pessoa: 'Maria', valor: 200 },
      ]
      mockEq.mockReturnValue({ data: expenses, error: null })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      const result = await getTotalByPerson(USER_ID)

      expect(mockFrom).toHaveBeenCalledWith('third_party_expenses')
      expect(result).toEqual(
        expect.arrayContaining([
          { pessoa: 'João', total: 800 },
          { pessoa: 'Maria', total: 200 },
        ]),
      )
      expect(result).toHaveLength(2)
    })

    it('returns empty array when no expenses exist', async () => {
      mockEq.mockReturnValue({ data: [], error: null })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      const result = await getTotalByPerson(USER_ID)

      expect(result).toEqual([])
    })

    it('throws on query error', async () => {
      mockEq.mockReturnValue({ data: null, error: { message: 'Query failed' } })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      })

      await expect(getTotalByPerson(USER_ID)).rejects.toThrow('Query failed')
    })
  })
})
