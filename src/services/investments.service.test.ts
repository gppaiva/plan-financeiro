import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InvestmentAccountFormData, InvestmentTransactionFormData } from '../schemas/investment.schema'

// ── Hoisted mocks (vi.mock factories are hoisted above imports) ──────────────

const {
  mockSingle,
  mockSelect,
  mockEq,
  mockInsert,
  mockFrom,
  mockOrder,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockOrder = vi.fn()
  const mockEq = vi.fn()
  const mockInsert = vi.fn(() => ({ select: mockSelect }))

  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({ eq: mockEq })),
    insert: mockInsert,
  }))

  return {
    mockSingle,
    mockSelect,
    mockEq,
    mockInsert,
    mockFrom,
    mockOrder,
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Import after mock ────────────────────────────────────────────────────────

import {
  listAccounts,
  createAccount,
  listTransactions,
  addDeposit,
  addWithdrawal,
  getAccountBalance,
  getTotalInvested,
} from './investments.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-123'
const ACCOUNT_ID = 'account-uuid-1'

const sampleAccount = {
  id: ACCOUNT_ID,
  user_id: USER_ID,
  nome: 'Tesouro Direto',
  tipo: 'Renda Fixa',
  saldo_atual: 5000,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const sampleAccountFormData: InvestmentAccountFormData = {
  nome: 'Tesouro Direto',
  tipo: 'Renda Fixa',
}

const sampleDeposit = {
  id: 'tx-uuid-1',
  conta_id: ACCOUNT_ID,
  tipo: 'aporte' as const,
  valor: 1000,
  data: '2024-06-01',
  created_at: '2024-06-01T00:00:00Z',
}

const sampleWithdrawal = {
  id: 'tx-uuid-2',
  conta_id: ACCOUNT_ID,
  tipo: 'resgate' as const,
  valor: 300,
  data: '2024-06-15',
  created_at: '2024-06-15T00:00:00Z',
}

const sampleDepositFormData: InvestmentTransactionFormData = {
  conta_id: ACCOUNT_ID,
  valor: 1000,
  tipo: 'aporte',
  data: '2024-06-01',
}

const sampleWithdrawalFormData: InvestmentTransactionFormData = {
  conta_id: ACCOUNT_ID,
  valor: 300,
  tipo: 'resgate',
  data: '2024-06-15',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('investments.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── listAccounts ─────────────────────────────────────────────────────────

  describe('listAccounts', () => {
    it('returns all accounts for a user', async () => {
      mockOrder.mockReturnValue({ data: [sampleAccount], error: null })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      const result = await listAccounts(USER_ID)

      expect(mockFrom).toHaveBeenCalledWith('investment_accounts')
      expect(result).toEqual([sampleAccount])
    })

    it('returns empty array when no accounts exist', async () => {
      mockOrder.mockReturnValue({ data: [], error: null })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      const result = await listAccounts(USER_ID)

      expect(result).toEqual([])
    })

    it('throws on query error', async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: 'Query failed' } })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      await expect(listAccounts(USER_ID)).rejects.toThrow('Query failed')
    })
  })

  // ── createAccount ────────────────────────────────────────────────────────

  describe('createAccount', () => {
    it('validates and inserts a new account', async () => {
      mockSingle.mockReturnValue({ data: sampleAccount, error: null })

      const result = await createAccount(USER_ID, sampleAccountFormData)

      expect(mockFrom).toHaveBeenCalledWith('investment_accounts')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: USER_ID,
        ...sampleAccountFormData,
      })
      expect(result).toEqual(sampleAccount)
    })

    it('throws ZodError on invalid data', async () => {
      const invalidData = { nome: '', tipo: '' }

      await expect(createAccount(USER_ID, invalidData as InvestmentAccountFormData)).rejects.toThrow()
    })

    it('throws on insert error', async () => {
      mockSingle.mockReturnValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      await expect(createAccount(USER_ID, sampleAccountFormData)).rejects.toThrow('Insert failed')
    })
  })

  // ── listTransactions ─────────────────────────────────────────────────────

  describe('listTransactions', () => {
    it('returns all transactions for an account', async () => {
      mockOrder.mockReturnValue({ data: [sampleDeposit, sampleWithdrawal], error: null })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      const result = await listTransactions(ACCOUNT_ID)

      expect(mockFrom).toHaveBeenCalledWith('investment_transactions')
      expect(result).toEqual([sampleDeposit, sampleWithdrawal])
    })

    it('throws on query error', async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: 'Query failed' } })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      await expect(listTransactions(ACCOUNT_ID)).rejects.toThrow('Query failed')
    })
  })

  // ── addDeposit ───────────────────────────────────────────────────────────

  describe('addDeposit', () => {
    it('validates and inserts a deposit transaction', async () => {
      mockSingle.mockReturnValue({ data: sampleDeposit, error: null })

      const result = await addDeposit(sampleDepositFormData)

      expect(mockFrom).toHaveBeenCalledWith('investment_transactions')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'aporte', valor: 1000 }),
      )
      expect(result).toEqual(sampleDeposit)
    })

    it('throws ZodError on invalid data', async () => {
      const invalidData = { ...sampleDepositFormData, valor: -100 }

      await expect(addDeposit(invalidData as InvestmentTransactionFormData)).rejects.toThrow()
    })

    it('throws on insert error', async () => {
      mockSingle.mockReturnValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      await expect(addDeposit(sampleDepositFormData)).rejects.toThrow('Insert failed')
    })
  })

  // ── addWithdrawal ────────────────────────────────────────────────────────

  describe('addWithdrawal', () => {
    it('validates and inserts a withdrawal transaction', async () => {
      mockSingle.mockReturnValue({ data: sampleWithdrawal, error: null })

      const result = await addWithdrawal(sampleWithdrawalFormData)

      expect(mockFrom).toHaveBeenCalledWith('investment_transactions')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'resgate', valor: 300 }),
      )
      expect(result).toEqual(sampleWithdrawal)
    })

    it('throws ZodError on invalid data', async () => {
      const invalidData = { ...sampleWithdrawalFormData, conta_id: '' }

      await expect(addWithdrawal(invalidData as InvestmentTransactionFormData)).rejects.toThrow()
    })

    it('throws on insert error', async () => {
      mockSingle.mockReturnValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      await expect(addWithdrawal(sampleWithdrawalFormData)).rejects.toThrow('Insert failed')
    })
  })

  // ── getAccountBalance ────────────────────────────────────────────────────

  describe('getAccountBalance', () => {
    it('calculates balance as deposits minus withdrawals', async () => {
      mockEq.mockReturnValue({
        data: [sampleDeposit, sampleWithdrawal],
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      const result = await getAccountBalance(ACCOUNT_ID)

      expect(mockFrom).toHaveBeenCalledWith('investment_transactions')
      expect(result).toBe(700) // 1000 - 300
    })

    it('returns 0 when no transactions exist', async () => {
      mockEq.mockReturnValue({ data: [], error: null })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      const result = await getAccountBalance(ACCOUNT_ID)

      expect(result).toBe(0)
    })

    it('throws on query error', async () => {
      mockEq.mockReturnValue({
        data: null,
        error: { message: 'Query failed' },
      })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      await expect(getAccountBalance(ACCOUNT_ID)).rejects.toThrow('Query failed')
    })
  })

  // ── getTotalInvested ─────────────────────────────────────────────────────

  describe('getTotalInvested', () => {
    it('sums balances across all accounts', async () => {
      const account2 = { ...sampleAccount, id: 'account-uuid-2', nome: 'CDB' }
      const deposit2 = { ...sampleDeposit, id: 'tx-uuid-3', conta_id: 'account-uuid-2', valor: 2000 }

      let callCount = 0
      mockFrom.mockImplementation((table: string) => {
        if (table === 'investment_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  data: [sampleAccount, account2],
                  error: null,
                })),
              })),
            })),
            insert: mockInsert,
          }
        }
        // investment_transactions — alternate between accounts
        callCount++
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: callCount === 1
                ? [sampleDeposit, sampleWithdrawal] // account 1: 1000 - 300 = 700
                : [deposit2],                        // account 2: 2000
              error: null,
            })),
          })),
          insert: mockInsert,
        }
      })

      const result = await getTotalInvested(USER_ID)

      expect(result).toBe(2700) // 700 + 2000
    })

    it('returns 0 when user has no accounts', async () => {
      mockOrder.mockReturnValue({ data: [], error: null })
      mockEq.mockReturnValue({ order: mockOrder })
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({ eq: mockEq })),
        insert: mockInsert,
      })

      const result = await getTotalInvested(USER_ID)

      expect(result).toBe(0)
    })
  })
})
