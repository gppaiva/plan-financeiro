import { describe, it, expect } from 'vitest'
import { thirdPartyExpenseSchema } from './third-party.schema'

const validExpense = {
  pessoa: 'Maria',
  descricao: 'Empréstimo',
  valor: 100,
  data_vencimento: '2024-02-01',
  status: 'pending' as const,
}

describe('thirdPartyExpenseSchema', () => {
  it('should validate a valid third-party expense', () => {
    const result = thirdPartyExpenseSchema.safeParse(validExpense)
    expect(result.success).toBe(true)
  })

  it('should reject empty pessoa (person_name)', () => {
    const result = thirdPartyExpenseSchema.safeParse({ ...validExpense, pessoa: '' })
    expect(result.success).toBe(false)
  })

  it('should reject empty descricao', () => {
    const result = thirdPartyExpenseSchema.safeParse({ ...validExpense, descricao: '' })
    expect(result.success).toBe(false)
  })

  it('should reject non-positive valor', () => {
    const result = thirdPartyExpenseSchema.safeParse({ ...validExpense, valor: -5 })
    expect(result.success).toBe(false)
  })

  it('should reject invalid date format', () => {
    const result = thirdPartyExpenseSchema.safeParse({ ...validExpense, data_vencimento: '01/02/2024' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid status', () => {
    const result = thirdPartyExpenseSchema.safeParse({ ...validExpense, status: 'overdue' })
    expect(result.success).toBe(false)
  })

  it('should reject missing pessoa field', () => {
    const { pessoa: _, ...withoutPessoa } = validExpense
    const result = thirdPartyExpenseSchema.safeParse(withoutPessoa)
    expect(result.success).toBe(false)
  })
})
