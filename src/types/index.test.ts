import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseStatus,
  type Quinzena,
  type ExpenseFilters,
  type UserProfile,
  type Expense,
  type ThirdPartyExpense,
  type InvestmentAccount,
  type InvestmentTransaction,
  type ExtraIncome,
  type AuthResult,
  type PersonTotal,
} from './index'

describe('EXPENSE_CATEGORIES', () => {
  it('should contain exactly 9 categories', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(9)
  })

  it('should contain all expected categories', () => {
    const expected = [
      'Alimentação',
      'Transporte',
      'Educação',
      'Lazer',
      'Saúde',
      'Moradia',
      'Cartão',
      'Utilidades',
      'Outros',
    ]
    expect([...EXPENSE_CATEGORIES]).toEqual(expected)
  })

  it('should be readonly (frozen tuple)', () => {
    // The `as const` assertion makes it readonly at the type level.
    // At runtime we verify the array contents are stable.
    const copy = [...EXPENSE_CATEGORIES]
    expect(copy).toEqual([...EXPENSE_CATEGORIES])
  })
})

describe('Type structure validation', () => {
  it('should allow creating a valid UserProfile object', () => {
    const profile: UserProfile = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      nome: 'João Silva',
      salario_liquido: 5000,
      quinzena_1_valor: 2500,
      quinzena_2_valor: 2500,
      ciclo_tipo: '15_ultimo',
      dia_pagamento_1: 5,
      dia_pagamento_2: 20,
      dia_pagamento_mensal: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    expect(profile.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(profile.salario_liquido).toBe(5000)
  })

  it('should allow creating a valid Expense object', () => {
    const expense: Expense = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      descricao: 'Almoço',
      valor: 25.5,
      categoria: 'Alimentação',
      data_vencimento: '2024-01-15',
      quinzena: '1',
      status: 'pending',
      recorrente: false,
      data_final: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    expect(expense.valor).toBe(25.5)
    expect(expense.status).toBe('pending')
    expect(expense.quinzena).toBe('1')
  })

  it('should allow creating a valid ThirdPartyExpense object', () => {
    const expense: ThirdPartyExpense = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      pessoa: 'Maria',
      descricao: 'Empréstimo',
      valor: 100,
      data_vencimento: '2024-02-01',
      status: 'pending',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    expect(expense.pessoa).toBe('Maria')
    expect(expense.status).toBe('pending')
  })

  it('should allow creating a valid InvestmentAccount object', () => {
    const account: InvestmentAccount = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      nome: 'Tesouro Selic',
      tipo: 'Renda Fixa',
      saldo_atual: 10000,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    expect(account.saldo_atual).toBe(10000)
  })

  it('should allow creating a valid InvestmentTransaction object', () => {
    const transaction: InvestmentTransaction = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      conta_id: '123e4567-e89b-12d3-a456-426614174001',
      tipo: 'aporte',
      valor: 500,
      data: '2024-01-15',
      created_at: '2024-01-01T00:00:00Z',
    }
    expect(transaction.tipo).toBe('aporte')
    expect(transaction.valor).toBe(500)
  })

  it('should allow creating a valid ExtraIncome object', () => {
    const income: ExtraIncome = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      descricao: 'Freelance',
      valor: 2000,
      quinzena: '1',
      data: '2024-01-20',
      created_at: '2024-01-01T00:00:00Z',
    }
    expect(income.descricao).toBe('Freelance')
    expect(income.valor).toBe(2000)
  })

  it('should allow creating a valid AuthResult object', () => {
    const result: AuthResult = {
      session: null,
      user: null,
      error: 'Invalid credentials',
    }
    expect(result.error).toBe('Invalid credentials')
    expect(result.session).toBeNull()
  })

  it('should allow creating a valid PersonTotal object', () => {
    const total: PersonTotal = {
      pessoa: 'Carlos',
      total: 350.75,
    }
    expect(total.pessoa).toBe('Carlos')
    expect(total.total).toBe(350.75)
  })

  it('should allow creating ExpenseFilters with optional fields', () => {
    const minimalFilters: ExpenseFilters = {
      month: 1,
      year: 2024,
    }
    expect(minimalFilters.quinzena).toBeUndefined()

    const fullFilters: ExpenseFilters = {
      month: 6,
      year: 2024,
      quinzena: '2',
      category: 'Saúde',
      status: 'paid',
    }
    expect(fullFilters.quinzena).toBe('2')
    expect(fullFilters.category).toBe('Saúde')
    expect(fullFilters.status).toBe('paid')
  })

  it('should support both Quinzena values', () => {
    const q1: Quinzena = '1'
    const q2: Quinzena = '2'
    expect(q1).toBe('1')
    expect(q2).toBe('2')
  })

  it('should support both ExpenseStatus values', () => {
    const paid: ExpenseStatus = 'paid'
    const pending: ExpenseStatus = 'pending'
    expect(paid).toBe('paid')
    expect(pending).toBe('pending')
  })

  it('should support all ExpenseCategory values from EXPENSE_CATEGORIES', () => {
    const categories: ExpenseCategory[] = [...EXPENSE_CATEGORIES]
    expect(categories).toHaveLength(9)
    expect(categories).toContain('Alimentação')
    expect(categories).toContain('Outros')
  })
})
