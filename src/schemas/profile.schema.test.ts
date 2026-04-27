import { describe, it, expect } from 'vitest'
import { profileSchema } from './profile.schema'

const validProfile = {
  nome: 'João Silva',
  email: 'joao@example.com',
  salario_liquido: 5000,
  dia_pagamento_1: 5,
  dia_pagamento_2: 20,
}

describe('profileSchema', () => {
  it('should validate a valid profile', () => {
    const result = profileSchema.safeParse(validProfile)
    expect(result.success).toBe(true)
  })

  it('should accept optional telefone in correct format', () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      telefone: '(11) 99999-1234',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid telefone format', () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      telefone: '11999991234',
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty nome', () => {
    const result = profileSchema.safeParse({ ...validProfile, nome: '' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid email', () => {
    const result = profileSchema.safeParse({ ...validProfile, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('should reject negative salario_liquido', () => {
    const result = profileSchema.safeParse({ ...validProfile, salario_liquido: -1 })
    expect(result.success).toBe(false)
  })

  it('should accept zero salario_liquido', () => {
    const result = profileSchema.safeParse({ ...validProfile, salario_liquido: 0 })
    expect(result.success).toBe(true)
  })

  it('should reject dia_pagamento out of range', () => {
    const result1 = profileSchema.safeParse({ ...validProfile, dia_pagamento_1: 0 })
    expect(result1.success).toBe(false)

    const result2 = profileSchema.safeParse({ ...validProfile, dia_pagamento_2: 32 })
    expect(result2.success).toBe(false)
  })

  it('should reject non-integer dia_pagamento', () => {
    const result = profileSchema.safeParse({ ...validProfile, dia_pagamento_1: 5.5 })
    expect(result.success).toBe(false)
  })
})
