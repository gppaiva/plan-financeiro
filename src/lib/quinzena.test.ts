import { describe, it, expect } from 'vitest'
import type { Quinzena } from '../types'
import {
  getQuinzenaLabel,
  filterByQuinzena,
  getLastBusinessDay,
  calculatePaidTotal,
  calculatePendingTotal,
} from './quinzena'

describe('getQuinzenaLabel', () => {
  it('should return "Dia 15" for quinzena 1', () => {
    expect(getQuinzenaLabel('1')).toBe('Dia 15')
  })

  it('should return "Último dia útil" for quinzena 2', () => {
    expect(getQuinzenaLabel('2')).toBe('Último dia útil')
  })
})

describe('filterByQuinzena', () => {
  const items = [
    { id: 1, quinzena: '1' as Quinzena },
    { id: 2, quinzena: '2' as Quinzena },
    { id: 3, quinzena: '1' as Quinzena },
    { id: 4, quinzena: '2' as Quinzena },
  ]

  it('should return all items when filter is "all"', () => {
    expect(filterByQuinzena(items, 'all')).toEqual(items)
  })

  it('should filter items by quinzena 1', () => {
    const result = filterByQuinzena(items, '1')
    expect(result).toHaveLength(2)
    expect(result.every((item) => item.quinzena === '1')).toBe(true)
  })

  it('should filter items by quinzena 2', () => {
    const result = filterByQuinzena(items, '2')
    expect(result).toHaveLength(2)
    expect(result.every((item) => item.quinzena === '2')).toBe(true)
  })

  it('should return empty array when no items match', () => {
    const singleItems = [{ id: 1, quinzena: '1' as Quinzena }]
    expect(filterByQuinzena(singleItems, '2')).toEqual([])
  })

  it('should return empty array for empty input', () => {
    expect(filterByQuinzena([], '1')).toEqual([])
  })
})

describe('getLastBusinessDay', () => {
  it('should return 31 for January 2024 (Wednesday)', () => {
    // Jan 31, 2024 is a Wednesday
    expect(getLastBusinessDay(2024, 1)).toBe(31)
  })

  it('should return 29 for February 2024 (Thursday, leap year)', () => {
    // Feb 29, 2024 is a Thursday
    expect(getLastBusinessDay(2024, 2)).toBe(29)
  })

  it('should return 28 for February 2025 (Friday, non-leap year)', () => {
    // Feb 28, 2025 is a Friday
    expect(getLastBusinessDay(2025, 2)).toBe(28)
  })

  it('should skip weekends — March 2024 ends on Sunday', () => {
    // March 31, 2024 is a Sunday → last business day is Friday March 29
    expect(getLastBusinessDay(2024, 3)).toBe(29)
  })

  it('should skip Saturday — June 2024 ends on Sunday', () => {
    // June 30, 2024 is a Sunday → last business day is Friday June 28
    expect(getLastBusinessDay(2024, 6)).toBe(28)
  })

  it('should handle month ending on Saturday', () => {
    // August 31, 2024 is a Saturday → last business day is Friday August 30
    expect(getLastBusinessDay(2024, 8)).toBe(30)
  })
})

describe('calculatePaidTotal', () => {
  it('should sum only paid expenses', () => {
    const expenses = [
      { status: 'paid', valor: 100 },
      { status: 'pending', valor: 200 },
      { status: 'paid', valor: 50 },
    ]
    expect(calculatePaidTotal(expenses)).toBe(150)
  })

  it('should return 0 when no paid expenses', () => {
    const expenses = [
      { status: 'pending', valor: 100 },
      { status: 'pending', valor: 200 },
    ]
    expect(calculatePaidTotal(expenses)).toBe(0)
  })

  it('should return 0 for empty array', () => {
    expect(calculatePaidTotal([])).toBe(0)
  })
})

describe('calculatePendingTotal', () => {
  it('should sum only pending expenses', () => {
    const expenses = [
      { status: 'paid', valor: 100 },
      { status: 'pending', valor: 200 },
      { status: 'pending', valor: 50 },
    ]
    expect(calculatePendingTotal(expenses)).toBe(250)
  })

  it('should return 0 when no pending expenses', () => {
    const expenses = [
      { status: 'paid', valor: 100 },
      { status: 'paid', valor: 200 },
    ]
    expect(calculatePendingTotal(expenses)).toBe(0)
  })

  it('should return 0 for empty array', () => {
    expect(calculatePendingTotal([])).toBe(0)
  })
})
