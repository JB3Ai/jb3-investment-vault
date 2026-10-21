import type { ContentRecord } from '../../content-migration/ingestion-schema.ts'
import { financialNote, sourceMinor, totals, type FinancialData } from './financialSchedules.ts'

export type FundingTreatment = 'included-in-household' | 'additional-one-off' | 'essential-business' | 'conditional-business' | 'optional-hardware'
export interface FundingRow {
  recordId: string
  component: 'one-off' | 'monthly'
  treatment: FundingTreatment
  status: 'Confirmed' | 'Awaiting reconciliation' | 'Awaiting quote' | 'Deferred'
  urgency: 'Priority' | 'Safety-critical' | 'Medical review required' | 'Essential' | 'Standard' | 'Staged'
  note: string
}
export interface FundingProposal {
  format: 'JB3_FUNDING_PROPOSAL_V1'
  classification: 'BRUCE_PRIVATE'
  approval: 'draft'
  owner: string
  recordedOn: string
  source: { relativePath: string; originalFilename: string; sha256: string }
  historicalRecordsSha256: string
  household: { essentialsMonthlyMinor: number; bufferMonthlyMinor: number; minimumMonthlyMinor: number; periods: string[]; inclusions?: string[] }
  business: { essentialMonthlyMinor: number; travelMonthlyMinMinor: number; travelMonthlyMaxMinor: number }
  cashFlowScenarios?:{owner:string;recordedOn:string;source:{relativePath:string;originalFilename:string;sha256:string};entries:{recordId:string;label:string;amountMinor:number;earliestMonth:string|null;note:string}[]}
  rows: FundingRow[]
}

export function fundingRow(data: FinancialData, record: ContentRecord) {
  return data.funding?.rows.find(row => row.recordId === record.id)
}

/** Presentation-only ordering. Source records, UUIDs, formulas and amounts are untouched. */
export function orderedFinancialRows(data: FinancialData, rows: ContentRecord[]) {
  const priority = (record: ContentRecord) => {
    const item = fundingRow(data, record)
    return (item?.component === 'one-off' || financialNote(record).oneOffZar !== null ? 0 : 10) + (item?.urgency === 'Priority' ? 0 : item?.urgency === 'Safety-critical' || item?.urgency === 'Medical review required' ? 1 : 2)
  }
  return [...rows].sort((a, b) => priority(a) - priority(b))
}

export function fundingSummary(data: FinancialData) {
  if (!data.funding) return null
  const proposal = data.funding, hasPersonal = data.personal.length > 0
  const sourceRecurringMinor = data.personal.reduce((sum, row) => sum + (sourceMinor(financialNote(row).monthlyZar) ?? 0), 0)
  const oneOffMinor = data.personal.filter(row => fundingRow(data, row)?.treatment === 'additional-one-off').reduce((sum, row) => sum + (sourceMinor(financialNote(row).oneOffZar) ?? 0), 0)
  const essential = data.business.filter(row => fundingRow(data, row)?.treatment === 'essential-business')
  const businessMinor = totals(essential).known
  const businessMonthlyMinor = essential.reduce((sum, row) => sum + (sourceMinor(financialNote(row).monthlyZar) ?? 0), 0)
  const householdMinor = hasPersonal ? proposal.household.minimumMonthlyMinor * proposal.household.periods.length : 0
  const coreMinor = householdMinor + businessMinor
  return { householdMinor, monthlyHouseholdMinor: hasPersonal ? proposal.household.minimumMonthlyMinor : 0, sourceRecurringMinor, essentialsDifferenceMinor: hasPersonal ? proposal.household.essentialsMonthlyMinor - sourceRecurringMinor : 0, oneOffMinor, businessMinor, businessMonthlyMinor, businessDifferenceMinor: data.business.length ? proposal.business.essentialMonthlyMinor - businessMonthlyMinor : 0, coreMinor, knownRequirementsMinor: coreMinor + oneOffMinor, optionalMinor: totals(data.business).optional }
}

export function componentDisplay(data: FinancialData, record: ContentRecord, component: 'one-off' | 'monthly') {
  const note = financialNote(record), value = component === 'one-off' ? note.oneOffZar : note.monthlyZar
  if (value !== null) return { minor: sourceMinor(value), label: null }
  const item = fundingRow(data, record)
  if(item?.treatment==='conditional-business'&&note.monthlyZar===null&&note.oneOffZar===null)return {minor:null,label:item.status==='Awaiting quote'?'Awaiting quote':'Awaiting reconciliation'}
  if (item && item.component !== component || !item && (component === 'one-off' ? note.monthlyZar : note.oneOffZar) !== null) return { minor: null, label: 'Not applicable' }
  return { minor: null, label: item?.status === 'Awaiting quote' ? 'Awaiting quote' : item?.status === 'Deferred' ? 'Deferred' : 'Awaiting reconciliation' }
}
