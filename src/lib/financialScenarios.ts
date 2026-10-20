import { fundingSummary } from './fundingProposal.ts'
import { financialNote, planningMonths, sourceMinor, totals, type FinancialData } from './financialSchedules.ts'
export interface SustainableInput { basis: 'household' | 'salary'; food: number | null; health: number | null; transport: number | null; other: number | null; salary: number | null }
export const emptySustainable: SustainableInput = { basis: 'household', food: null, health: null, transport: null, other: null, salary: null }
export function validSustainable(input: unknown): SustainableInput {
  const value = input as SustainableInput
  if (!value || Object.keys(value).sort().join(',') !== 'basis,food,health,other,salary,transport' || !['household','salary'].includes(value.basis) || [value.food,value.health,value.transport,value.other,value.salary].some(amount => amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 10000000))) throw new Error('Invalid scenario input')
  return value
}
export function financialScenarios(data: FinancialData, input: SustainableInput = emptySustainable) {
  validSustainable(input)
  const personal = totals(data.personal), business = totals(data.business)
  const recurringMinor = data.personal.reduce((sum,row) => sum + (sourceMinor(financialNote(row).monthlyZar) ?? 0), 0)
  const oneOffMinor = data.personal.reduce((sum,row) => sum + (sourceMinor(financialNote(row).oneOffZar) ?? 0), 0)
  const parts = [input.food,input.health,input.transport,input.other]
  const monthly = input.basis === 'salary' ? input.salary : parts.every(value => value !== null) ? parts.reduce<number>((sum,value) => sum + value!,0) : null
  const funding = fundingSummary(data)
  return { minimumMinor: funding?.coreMinor ?? personal.baseline + business.baseline, recurringMinor: funding?.monthlyHouseholdMinor ?? recurringMinor, oneOffMinor: funding?.oneOffMinor ?? oneOffMinor, businessMinor: funding?.businessMinor ?? business.baseline, sustainableMonthlyMinor: monthly === null ? null : Math.round(monthly * 100), sustainableMinor: monthly === null ? null : Math.round(monthly * 100) * planningMonths + (funding?.oneOffMinor ?? oneOffMinor) + (funding?.businessMinor ?? business.baseline) }
}
export function confirmation(record: FinancialData['personal'][number]) {
  const note = financialNote(record), label = String(record.payload.label)
  const status = note.optionalHardware ? 'Optional/deferred' : record.payload.amountMinor === null ? /medical|dental/i.test(label) ? 'Awaiting quote' : /school|arrears|subscription|cloud|github/i.test(label) ? 'Awaiting reconciliation' : 'Owner confirmation required' : /quote|quoted|invoice|historical|earlier|prior|confirm|verify|discrepancy/i.test(note.note) ? 'Awaiting reconciliation' : 'Owner confirmation required'
  const action = /school/i.test(label) ? 'Obtain current school statement and confirm the payment proposal; historical proposed payments remain excluded.' : /medical|medication|dental/i.test(label) ? 'Obtain a current written quote or prescription and confirm ongoing need.' : /vehicle|brake/i.test(label) ? 'Confirm quote date, present vehicle condition and current supplier pricing.' : /software|subscription/i.test(label) ? 'Reconcile current subscriptions against invoices, currency conversion and historical summaries.' : note.optionalHardware ? 'Obtain current availability and quotes; agree stage allocation before funding.' : /arrears/i.test(label) ? 'Reconcile the current statement, currency and permitted use of support.' : 'Confirm the current scope, amount, timing and whether this item should be funded.'
  return { status, action, included: record.payload.amountMinor === null ? 'Excluded from current baseline: amount unknown' : note.optionalHardware ? 'Excluded from baseline; included only in optional hardware total' : 'Known estimate included; final amount and eligibility remain provisional', reason: note.note }
}
