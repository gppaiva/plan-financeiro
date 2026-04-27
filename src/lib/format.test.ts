import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatShortDate } from './format'

describe('formatCurrency', () => {
  it('should format a positive value as Brazilian Real', () => {
    const result = formatCurrency(1234.56)
    // pt-BR locale uses R$ with non-breaking space, period for thousands, comma for decimals
    expect(result).toContain('R$')
    expect(result).toContain('1.234,56')
  })

  it('should format zero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('R$')
    expect(result).toContain('0,00')
  })

  it('should format negative values', () => {
    const result = formatCurrency(-500.1)
    expect(result).toContain('R$')
    expect(result).toContain('500,10')
  })

  it('should format values with no decimal part', () => {
    const result = formatCurrency(100)
    expect(result).toContain('R$')
    expect(result).toContain('100,00')
  })

  it('should format large values with thousands separators', () => {
    const result = formatCurrency(1000000)
    expect(result).toContain('R$')
    expect(result).toContain('1.000.000,00')
  })
})

describe('formatDate', () => {
  it('should format ISO date to DD/MM/AAAA', () => {
    expect(formatDate('2024-01-15')).toBe('15/01/2024')
  })

  it('should handle end of year dates', () => {
    expect(formatDate('2024-12-31')).toBe('31/12/2024')
  })

  it('should handle single-digit months and days in ISO format', () => {
    expect(formatDate('2024-03-05')).toBe('05/03/2024')
  })
})

describe('formatShortDate', () => {
  it('should format ISO date to DD/MM', () => {
    expect(formatShortDate('2024-01-15')).toBe('15/01')
  })

  it('should handle end of year dates', () => {
    expect(formatShortDate('2024-12-31')).toBe('31/12')
  })

  it('should handle single-digit months and days in ISO format', () => {
    expect(formatShortDate('2024-03-05')).toBe('05/03')
  })
})
