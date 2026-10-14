import { describe, it, expect } from 'vitest'
import { forecast } from './finance'
describe('hypothetical cash model', () => {
  it('accumulates monthly operating cash flows with compounded revenue', () => {
    const rows = forecast({ monthlyRevenue: 100, monthlyCosts: 80, growthPercent: 10, openingCash: 50, months: 3 })
    expect(rows[0].cash).toBe(70)
    expect(rows[1].revenue).toBeCloseTo(110)
    expect(rows[2].cash).toBeCloseTo(141)
  })
  it('preserves negative cash and does not imply profitability', () => {
    const rows = forecast({ monthlyRevenue: 0, monthlyCosts: 80, growthPercent: 0, openingCash: 50, months: 2 })
    expect(rows[1].cash).toBe(-110)
  })
  it('bounds non-finite and unreasonable inputs', () => {
    const rows = forecast({ monthlyRevenue: NaN, monthlyCosts: -100, growthPercent: Infinity, openingCash: 0, months: 1000 })
    expect(rows).toHaveLength(60)
    expect(rows.every(r => Number.isFinite(r.cash))).toBe(true)
    expect(rows[0].cash).toBe(0)
  })
})
