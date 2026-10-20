import type { ContentRecord } from '../../content-migration/ingestion-schema.ts'
import type { LocalReview } from './localReview.ts'

export type FinancialData = LocalReview['finances']
export type Schedule = 'personal' | 'business'
export type ExportScope = Schedule | 'combined'
export interface FinancialNote {
  monthlyZar: string | null; oneOffZar: string | null; formula: string
  cachedTotalZar: string; note: string; missingInputs: boolean; optionalHardware: boolean
  periodBasis: string; amountBasis: string
}
export const planningMonths = 5
export function financialNote(record: ContentRecord): FinancialNote {
  return JSON.parse(String(record.payload.reconciliationNote)) as FinancialNote
}
export const validExchangeRate = (rate: number) => Number.isFinite(rate) && rate >= 0.0001 && rate <= 1_000_000
export const money = (minor: number, currency: 'ZAR' | 'GBP' = 'ZAR') => `${currency} ${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const sterlingMinor = (minor: number, rate: number) => Math.round(minor / rate)
export function totals(rows: ContentRecord[]) {
  const known = rows.reduce((sum, row) => sum + (typeof row.payload.amountMinor === 'number' ? row.payload.amountMinor : 0), 0)
  const optional = rows.filter(row => financialNote(row).optionalHardware).reduce((sum, row) => sum + (typeof row.payload.amountMinor === 'number' ? row.payload.amountMinor : 0), 0)
  return { known, optional, baseline: known - optional, unresolved: rows.filter(row => row.payload.amountMinor === null).length }
}
export function sourceMinor(value: string | null) {
  if (value === null) return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new Error('Invalid financial input')
  return Math.round(amount * 100)
}
/** Reconcile rather than silently changing a source amount during export. */
export function validateFinancialRows(rows: ContentRecord[]) {
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.id) || row.kind !== 'financial' || row.classification !== 'BRUCE_PRIVATE' || row.approval !== 'draft' || row.payload.currency !== 'ZAR') throw new Error('Unexpected financial record')
    seen.add(row.id)
    const note = financialNote(row), monthly = sourceMinor(note.monthlyZar), once = sourceMinor(note.oneOffZar)
    const calculated = monthly === null && once === null ? null : (monthly ?? 0) * planningMonths + (once ?? 0)
    if (calculated !== row.payload.amountMinor) throw new Error('Source formula reconciliation required')
  }
}
