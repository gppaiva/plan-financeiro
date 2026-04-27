import { describe, it, expect } from 'vitest'
import { investmentAccountSchema, investmentTransactionSchema } from './investment.schema'

describe('investmentAccountSchema', () => {
  const validAccount = {
    nome: 'Tesouro Selic',
    tipo: 'Renda Fixa',
  }

  it('should validate a valid account', () => {
    const result = investmentAccountSchema.safeParse(validAccount)
    expect(result.success).toBe(true)
  })

  it('should accept optional cor as valid hex', () => {
    const result = investmentAccountSchema.safeParse({ ...validAccount, cor: '#FF5733' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid hex cor', () => {
    const result = investmentAccountSchema.safeParse({ ...validAccount, cor: 'red' })
    expect(result.success).toBe(false)
  })

  it('should reject empty nome', () => {
    const result = investmentAccountSchema.safeParse({ ...validAccount, nome: '' })
    expect(result.success).toBe(false)
  })

  it('should reject empty tipo', () => {
    const result = investmentAccountSchema.safeParse({ ...validAccount, tipo: '' })
    expect(result.success).toBe(false)
  })
})

describe('investmentTransactionSchema', () => {
  const validTransaction = {
    conta_id: 'abc-123',
    valor: 500,
    tipo: 'aporte' as const,
    data: '2024-01-15',
  }

  it('should validate a valid transaction', () => {
    const result = investmentTransactionSchema.safeParse(validTransaction)
    expect(result.success).toBe(true)
  })

  it('should accept optional descricao', () => {
    const result = investmentTransactionSchema.safeParse({
      ...validTransaction,
      descricao: 'Aporte mensal',
    })
    expect(result.success).toBe(true)
  })

  it('should reject non-positive valor', () => {
    const result = investmentTransactionSchema.safeParse({ ...validTransaction, valor: 0 })
    expect(result.success).toBe(false)
  })

  it('should reject invalid tipo', () => {
    const result = investmentTransactionSchema.safeParse({ ...validTransaction, tipo: 'saque' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid date format', () => {
    const result = investmentTransactionSchema.safeParse({ ...validTransaction, data: '15-01-2024' })
    expect(result.success).toBe(false)
  })

  it('should reject empty conta_id', () => {
    const result = investmentTransactionSchema.safeParse({ ...validTransaction, conta_id: '' })
    expect(result.success).toBe(false)
  })
})
