import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProfileFormData } from '../schemas/profile.schema'

// ── Hoisted mocks (vi.mock factories are hoisted above imports) ──────────────

const { mockSingle, mockSelect, mockEq, mockInsert, mockUpdate, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockEq = vi.fn()
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))

  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({ eq: mockEq })),
    insert: mockInsert,
    update: mockUpdate,
  }))

  return { mockSingle, mockSelect, mockEq, mockInsert, mockUpdate, mockFrom }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Import after mock ────────────────────────────────────────────────────────

import {
  getProfile,
  createProfile,
  updateProfile,
  hasCompletedOnboarding,
} from './profile.service'

// ── Helpers ──────────────────────────────────────────────────────────────────

const AUTH_USER_ID = 'auth-user-123'

const sampleProfile = {
  id: 'profile-uuid-1',
  auth_user_id: AUTH_USER_ID,
  email: 'test@example.com',
  nome: 'João',
  salario_liquido: 5000,
  dia_pagamento_1: 5,
  dia_pagamento_2: 20,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const sampleFormData: ProfileFormData = {
  nome: 'João',
  email: 'test@example.com',
  salario_liquido: 5000,
  dia_pagamento_1: 5,
  dia_pagamento_2: 20,
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getProfile ───────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns the user profile when found', async () => {
      mockEq.mockReturnValue({ single: () => ({ data: sampleProfile, error: null }) })

      const result = await getProfile(AUTH_USER_ID)

      expect(mockFrom).toHaveBeenCalledWith('user_profiles')
      expect(result).toEqual(sampleProfile)
    })

    it('returns null when no profile exists (PGRST116)', async () => {
      mockEq.mockReturnValue({
        single: () => ({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      })

      const result = await getProfile(AUTH_USER_ID)

      expect(result).toBeNull()
    })

    it('throws on unexpected errors', async () => {
      mockEq.mockReturnValue({
        single: () => ({
          data: null,
          error: { code: 'OTHER', message: 'Something went wrong' },
        }),
      })

      await expect(getProfile(AUTH_USER_ID)).rejects.toThrow('Something went wrong')
    })
  })

  // ── createProfile ────────────────────────────────────────────────────────

  describe('createProfile', () => {
    it('inserts a new profile and returns it', async () => {
      mockSingle.mockReturnValue({ data: sampleProfile, error: null })

      const result = await createProfile(AUTH_USER_ID, sampleFormData)

      expect(mockFrom).toHaveBeenCalledWith('user_profiles')
      expect(mockInsert).toHaveBeenCalledWith({
        auth_user_id: AUTH_USER_ID,
        nome: sampleFormData.nome,
        email: sampleFormData.email,
        salario_liquido: sampleFormData.salario_liquido,
        dia_pagamento_1: sampleFormData.dia_pagamento_1,
        dia_pagamento_2: sampleFormData.dia_pagamento_2,
      })
      expect(result).toEqual(sampleProfile)
    })

    it('strips telefone from the insert payload', async () => {
      mockSingle.mockReturnValue({ data: sampleProfile, error: null })

      const dataWithPhone: ProfileFormData = { ...sampleFormData, telefone: '(11) 99999-9999' }
      await createProfile(AUTH_USER_ID, dataWithPhone)

      const insertArg = mockInsert.mock.calls[0][0]
      expect(insertArg).not.toHaveProperty('telefone')
    })

    it('throws on insert error', async () => {
      mockSingle.mockReturnValue({
        data: null,
        error: { message: 'Duplicate key' },
      })

      await expect(createProfile(AUTH_USER_ID, sampleFormData)).rejects.toThrow('Duplicate key')
    })
  })

  // ── updateProfile ────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates the profile and returns the updated record', async () => {
      const updatedProfile = { ...sampleProfile, nome: 'Maria' }
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: updatedProfile, error: null }) }),
      })

      const result = await updateProfile(AUTH_USER_ID, { nome: 'Maria' })

      expect(mockFrom).toHaveBeenCalledWith('user_profiles')
      expect(mockUpdate).toHaveBeenCalledWith({ nome: 'Maria' })
      expect(result).toEqual(updatedProfile)
    })

    it('strips telefone from the update payload', async () => {
      mockEq.mockReturnValue({
        select: () => ({ single: () => ({ data: sampleProfile, error: null }) }),
      })

      await updateProfile(AUTH_USER_ID, { telefone: '(11) 99999-9999', nome: 'Ana' })

      const updateArg = mockUpdate.mock.calls[0][0]
      expect(updateArg).not.toHaveProperty('telefone')
      expect(updateArg).toHaveProperty('nome', 'Ana')
    })

    it('throws on update error', async () => {
      mockEq.mockReturnValue({
        select: () => ({
          single: () => ({ data: null, error: { message: 'Update failed' } }),
        }),
      })

      await expect(updateProfile(AUTH_USER_ID, { nome: 'X' })).rejects.toThrow('Update failed')
    })
  })

  // ── hasCompletedOnboarding ───────────────────────────────────────────────

  describe('hasCompletedOnboarding', () => {
    it('returns true when a profile exists', async () => {
      mockEq.mockReturnValue({
        single: () => ({ data: { id: 'profile-uuid-1' }, error: null }),
      })

      const result = await hasCompletedOnboarding(AUTH_USER_ID)

      expect(result).toBe(true)
    })

    it('returns false when no profile exists (PGRST116)', async () => {
      mockEq.mockReturnValue({
        single: () => ({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      })

      const result = await hasCompletedOnboarding(AUTH_USER_ID)

      expect(result).toBe(false)
    })

    it('throws on unexpected errors', async () => {
      mockEq.mockReturnValue({
        single: () => ({
          data: null,
          error: { code: 'OTHER', message: 'DB error' },
        }),
      })

      await expect(hasCompletedOnboarding(AUTH_USER_ID)).rejects.toThrow('DB error')
    })
  })
})
