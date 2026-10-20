import { describe, expect, it } from 'vitest'
import { illustrativeRepayment } from './repayment'
describe('illustrative repayment, never source obligations', () => {
  it('handles zero interest exactly, including fractional payments', () => {
    const result = illustrativeRepayment(1, 0, 49)!
    expect(result.monthlyPayment).toBe(1 / 49)
    expect(result.totalInterest).toBe(0)
    expect(result.totalRepayment).toBe(1)
  })
  it('uses the standard monthly amortisation formula', () => {
    const expected = 12000 * .01 / (1 - 1.01 ** -12)
    const result = illustrativeRepayment(12000, 12, 12)!
    expect(result.monthlyPayment).toBeCloseTo(expected, 8)
    expect(result.totalRepayment).toBeCloseTo(expected * 12, 8)
    expect(result.totalInterest).toBeCloseTo(expected * 12 - 12000, 8)
  })
  it.each([[0, 10, 12], [-1, 10, 12], [100, -1, 12], [100, 101, 12], [100, 10, 0], [100, 10, 1.5], [100, 10, 601], [Infinity, 10, 12], [100, NaN, 12]])('rejects invalid terms without making a repayment claim', (principal, rate, months) => expect(illustrativeRepayment(principal, rate, months)).toBeNull())
  it('remains stable at very small positive interest rates', () => {
    const result = illustrativeRepayment(1000, .000001, 12)!
    expect(Number.isFinite(result.monthlyPayment)).toBe(true)
    expect(result.totalInterest).toBeGreaterThanOrEqual(0)
    expect(result.totalRepayment).toBeCloseTo(1000, 3)
  })
})
