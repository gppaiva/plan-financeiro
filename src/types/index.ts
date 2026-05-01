import type { Session, User } from '@supabase/supabase-js'

// ── Auxiliary Types ──────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Educação',
  'Lazer',
  'Saúde',
  'Moradia',
  'Cartão',
  'Utilidades',
  'Outros',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export type ExpenseStatus = 'paid' | 'pending'

export type Quinzena = '1' | '2'

export interface ExpenseFilters {
  month: number
  year: number
  quinzena?: Quinzena
  category?: ExpenseCategory
  status?: ExpenseStatus
}

// ── Database Entity Interfaces ───────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  nome: string
  salario_liquido: number
  quinzena_1_valor: number
  quinzena_2_valor: number
  ciclo_tipo: string
  dia_pagamento_1: number
  dia_pagamento_2: number
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  user_id: string
  descricao: string
  valor: number
  categoria: ExpenseCategory
  data_vencimento: string
  quinzena: Quinzena
  status: ExpenseStatus
  recorrente: boolean
  data_final: string | null
  created_at: string
  updated_at: string
}

export interface ThirdPartyExpense {
  id: string
  user_id: string
  pessoa: string
  descricao: string
  valor: number
  data_vencimento: string
  status: ExpenseStatus
  created_at: string
  updated_at: string
}

export interface InvestmentAccount {
  id: string
  user_id: string
  nome: string
  tipo: string
  saldo_atual: number
  created_at: string
  updated_at: string
}

export interface InvestmentTransaction {
  id: string
  conta_id: string
  tipo: 'aporte' | 'resgate'
  valor: number
  data: string
  created_at: string
}

export interface ExtraIncome {
  id: string
  user_id: string
  descricao: string
  valor: number
  quinzena: Quinzena
  data: string
  created_at: string
}

// ── Result Types ─────────────────────────────────────────────────────

export interface AuthResult {
  session: Session | null
  user: User | null
  error: string | null
}

export interface PersonTotal {
  pessoa: string
  total: number
}

// ── Re-exports ───────────────────────────────────────────────────────

export type { Session, User }
