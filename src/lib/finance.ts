export interface Assumptions { monthlyRevenue: number; monthlyCosts: number; growthPercent: number; openingCash: number; months: number }
export const initialAssumptions: Assumptions = { monthlyRevenue: 100000, monthlyCosts: 70000, growthPercent: 2, openingCash: 300000, months: 12 }
export function forecast(input: Assumptions) {
  const clean = (value: number, max: number) => Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0
  const revenue = clean(input.monthlyRevenue, 10000000), costs = clean(input.monthlyCosts, 10000000)
  const growth = clean(input.growthPercent, 20) / 100
  let cash = clean(input.openingCash, 100000000)
  return Array.from({ length: Math.max(1, Math.floor(clean(input.months, 60))) }, (_, i) => {
    const income = revenue * (1 + growth) ** i
    cash += income - costs
    return { month: i + 1, revenue: income, costs, operatingSurplus: income - costs, cash }
  })
}
export const zar = (value: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value)
