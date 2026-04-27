import { describe, it, expect } from 'vitest'
import { expenseSchema } from './expense.schema'

const validExpense = {
  descricao: 'Almoço',
  valor: 25.5,
  categoria: 'Alimentação' as const,
  quinzena: '1' as const,
  data_vencimento: '2024-01-15',
  status: 'pending' as const,
}

describe('expenseSchema', () => {
  it('should validate a valid expense', () => {
    const result = expenseSchema.safeParse(validExpense)
    expect(result.success).toBe(true)
  })

  it('should default recorrente to false when omitted', () => {
    const result = expenseSchema.safeParse(validExpense)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recorrente).toBe(false)
    }
  })

  it('should accept recorrente as true', () => {
    const result = expenseSchema.safeParse({ ...validExpense, recorrente: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recorrente).toBe(true)
    }
  })

  it('should reject empty descricao', () => {
    const result = expenseSchema.safeParse({ ...validExpense, descricao: '' })
    expect(result.success).toBe(false)
  })

  it('should reject non-positive valor', () => {
    const result = expenseSchema.safeParse({ ...validExpense, valor: 0 })
    expect(result.success).toBe(false)

    const negResult = expenseSchema.safeParse({ ...validExpense, valor: -10 })
    expect(negResult.success).toBe(false)
  })

  it('should reject invalid categoria', () => {
    const result = expenseSchema.safeParse({ ...validExpense, categoria: 'Invalida' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid quinzena', () => {
    const result = expenseSchema.safeParse({ ...validExpense, quinzena: '3' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid date format', () => {
    const result = expenseSchema.safeParse({ ...validExpense, data_vencimento: '15/01/2024' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid status', () => {
    const result = expenseSchema.safeParse({ ...validExpense, status: 'cancelled' })
    expect(result.success).toBe(false)
  })

  it('should accept all valid categories', () => {
    const categories = [
      'Alimentação', 'Transporte', 'Educação', 'Lazer',
      'Saúde', 'Moradia', 'Cartão', 'Utilidades', 'Outros',
    ]
    for (const categoria of categories) {
      const result = expenseSchema.safeParse({ ...validExpense, categoria })
      expect(result.success).toBe(true)
    }
  })
})
