import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Expense } from '../types'

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockOrder,
  mockLte,
  mockGte,
  mockEq,
  mockFrom,
} = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockLte = vi.fn()
  const mockGte = vi.fn()
  const mockEq = vi.fn()

  const mockFrom = vi.fn()

  return { mockOrder, mockLte, mockGte, mockEq, mockFrom }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Import after mock ────────────────────────────────────────────────────────

import {
  getCategoryBreakdown,
  getMonthlyEvolutionFromData,
  getMonthlyEvolution,
} from './reports.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    user_id: 'user-1',
    descricao: 'Test',
    valor: 100,
    categoria: 'Alimentação',
    data_vencimento: '2024-06-15',
    quinzena: '1',
    status: 'pending',
    recorrente: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('reports.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getCategoryBreakdown ─────────────────────────────────────────────────

  describe('getCategoryBreakdown', () => {
    it('returns empty array for no expenses', () => {
      const result = getCategoryBreakdown([])
      expect(result).toEqual([])
    })

    it('calculates correct totals and percentages for single category', () => {
      const expenses = [
        makeExpense({ valor: 200, categoria: 'Alimentação' }),
        makeExpense({ valor: 300, categoria: 'Alimentação' }),
      ]

      const result = getCategoryBreakdown(expenses)

      expect(result).toHaveLength(1)
      expect(result[0].categoria).toBe('Alimentação')
      expect(result[0].total).toBe(500)
      expect(result[0].percentual).toBe(100)
    })

    it('calculates correct percentages for multiple categories', () => {
      const expenses = [
        makeExpense({ valor: 300, categoria: 'Alimentação' }),
        makeExpense({ valor: 200, categoria: 'Transporte' }),
        makeExpense({ valor: 500, categoria: 'Moradia' }),
      ]

      const result = getCategoryBreakdown(expenses)

      expect(result).toHaveLength(3)
      // Sorted by total descending
      expect(result[0].categoria).toBe('Moradia')
      expect(result[0].total).toBe(500)
      expect(result[0].percentual).toBe(50)

      expect(result[1].categoria).toBe('Alimentação')
      expect(result[1].total).toBe(300)
      expect(result[1].percentual).toBe(30)

      expect(result[2].categoria).toBe('Transporte')
      expect(result[2].total).toBe(200)
      expect(result[2].percentual).toBe(20)
    })

    it('percentages sum to 100', () => {
      const expenses = [
        makeExpense({ valor: 100, categoria: 'Alimentação' }),
        makeExpense({ valor: 200, categoria: 'Transporte' }),
        makeExpense({ valor: 300, categoria: 'Moradia' }),
        makeExpense({ valor: 400, categoria: 'Lazer' }),
      ]

      const result = getCategoryBreakdown(expenses)
      const totalPercentage = result.reduce((sum, item) => sum + item.percentual, 0)

      expect(totalPercentage).toBeCloseTo(100)
    })

    it('aggregates multiple expenses in the same category', () => {
      const expenses = [
        makeExpense({ valor: 50, categoria: 'Alimentação' }),
        makeExpense({ valor: 150, categoria: 'Alimentação' }),
        makeExpense({ valor: 100, categoria: 'Transporte' }),
      ]

      const result = getCategoryBreakdown(expenses)

      expect(result).toHaveLength(2)
      const alimentacao = result.find((r) => r.categoria === 'Alimentação')
      expect(alimentacao?.total).toBe(200)
    })
  })

  // ── getMonthlyEvolutionFromData ──────────────────────────────────────────

  describe('getMonthlyEvolutionFromData', () => {
    it('returns 12 months with zero expenses when no expenses provided', () => {
      const result = getMonthlyEvolutionFromData([], 5000)

      expect(result).toHaveLength(12)
      for (const item of result) {
        expect(item.receita).toBe(5000)
        expect(item.despesa).toBe(0)
      }
      expect(result[0].month).toBe(1)
      expect(result[11].month).toBe(12)
    })

    it('aggregates expenses into correct months', () => {
      const expenses = [
        makeExpense({ valor: 100, data_vencimento: '2024-01-15' }),
        makeExpense({ valor: 200, data_vencimento: '2024-01-20' }),
        makeExpense({ valor: 300, data_vencimento: '2024-06-10' }),
      ]

      const result = getMonthlyEvolutionFromData(expenses, 5000)

      expect(result[0].month).toBe(1)
      expect(result[0].despesa).toBe(300) // 100 + 200
      expect(result[0].receita).toBe(5000)

      expect(result[5].month).toBe(6)
      expect(result[5].despesa).toBe(300)
      expect(result[5].receita).toBe(5000)

      // Other months should have zero expenses
      expect(result[1].despesa).toBe(0) // February
      expect(result[11].despesa).toBe(0) // December
    })

    it('uses the same income for all months', () => {
      const result = getMonthlyEvolutionFromData([], 8000)

      for (const item of result) {
        expect(item.receita).toBe(8000)
      }
    })
  })

  // ── getMonthlyEvolution (async, uses Supabase) ──────────────────────────

  describe('getMonthlyEvolution', () => {
    it('fetches expenses for the year and returns monthly evolution', async () => {
      const expenses = [
        makeExpense({ valor: 500, data_vencimento: '2024-03-15' }),
      ]

      // Chain: from().select().eq().gte().lte().order()
      mockOrder.mockReturnValue({ data: expenses, error: null })
      mockLte.mockReturnValue({ order: mockOrder })
      mockGte.mockReturnValue({ lte: mockLte })
      mockEq.mockReturnValue({ gte: mockGte })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
      })

      const result = await getMonthlyEvolution('user-1', 2024, 5000)

      expect(mockFrom).toHaveBeenCalledWith('expenses')
      expect(mockGte).toHaveBeenCalledWith('data_vencimento', '2024-01-01')
      expect(mockLte).toHaveBeenCalledWith('data_vencimento', '2024-12-31')
      expect(result).toHaveLength(12)
      expect(result[2].month).toBe(3)
      expect(result[2].despesa).toBe(500)
      expect(result[2].receita).toBe(5000)
    })

    it('throws on query error', async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: 'Query failed' } })
      mockLte.mockReturnValue({ order: mockOrder })
      mockGte.mockReturnValue({ lte: mockLte })
      mockEq.mockReturnValue({ gte: mockGte })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
      })

      await expect(getMonthlyEvolution('user-1', 2024, 5000)).rejects.toThrow('Query failed')
    })
  })
})
