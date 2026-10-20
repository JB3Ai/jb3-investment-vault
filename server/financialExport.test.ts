import { describe, expect, it } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import type { ContentRecord } from '../content-migration/ingestion-schema'
import { financialNote, sourceMinor, sterlingMinor, totals, validateFinancialRows, validExchangeRate } from '../src/lib/financialSchedules'
import { exportRequest, readExportRequest } from './financialExport'

export function fixtureRow(id: string, monthly: string | null, once: string | null, optional = false): ContentRecord {
  return { id, kind: 'financial', classification: 'BRUCE_PRIVATE', verification: 'awaiting-verification', approval: 'draft', file: null,
    provenance: { originalFilename: 'synthetic.xlsx', sourceDate: null, citation: 'Synthetic!A5:E5', sourceReference: 'sha256:synthetic', reviewedBy: null, reviewedOn: null, conflictNote: null },
    payload: { label: `Synthetic ${id}`, kind: 'operating-cost', basis: 'assumption', currency: 'ZAR', amountMinor: monthly === null && once === null ? null : (sourceMinor(monthly) ?? 0) * 5 + (sourceMinor(once) ?? 0), periodStart: null, periodEnd: null, reconciliationNote: JSON.stringify({ monthlyZar: monthly, oneOffZar: once, formula: 'IF(COUNT(B5:C5)=0,0,N(B5)*5+N(C5))', cachedTotalZar: monthly === null && once === null ? '0' : 'synthetic', note: 'Synthetic review only', missingInputs: monthly === null || once === null, optionalHardware: optional, periodBasis: 'Five months; dates unknown', amountBasis: 'Assumption' }) },
  } as ContentRecord
}
describe('private financial calculations and export input', () => {
  const rows = [fixtureRow('known', '10.01', '20.03'), fixtureRow('unknown', null, null), fixtureRow('optional', null, '50', true)]
  it('separates baseline, optional hardware and missing amounts in integer cents', () => expect(totals(rows)).toEqual({ known: 12008, optional: 5000, baseline: 7008, unresolved: 1 }))
  it('does not mutate any record while calculating', () => { const before = JSON.stringify(rows); validateFinancialRows(rows); totals(rows); expect(JSON.stringify(rows)).toBe(before) })
  it('does not turn cached formula zero into a known obligation', () => { expect(financialNote(rows[1]).cachedTotalZar).toBe('0'); expect(rows[1].payload.amountMinor).toBeNull() })
  it('converts the subtotal once at the selected rate', () => { expect(sterlingMinor(7008, 25)).toBe(280); expect(sterlingMinor(7008, 20)).toBe(350) })
  it.each([0, -2, NaN, Infinity, 0.00001, 1000001])('rejects invalid exchange rate %s', rate => expect(validExchangeRate(rate)).toBe(false))
  it.each(['combined', 'personal', 'business'])('accepts only a scope and selected numeric rate: %s', scope => expect(exportRequest({ scope, zarPerGbp: 25 })).toEqual({ scope, zarPerGbp: 25 }))
  it.each([{ scope: 'other', zarPerGbp: 25 }, { scope: 'personal', zarPerGbp: '25' }, { scope: 'combined', zarPerGbp: 25, path: '/private' }, { scope: 'combined', zarPerGbp: 25, records: [] }, null])('rejects arbitrary selectors and client-supplied records', input => expect(() => exportRequest(input)).toThrow())
  it('fails on a source/formula discrepancy rather than reconciling silently', () => expect(() => validateFinancialRows([{ ...rows[0], payload: { ...rows[0].payload, amountMinor: 100 } }])).toThrow())
  it('rejects duplicate UUIDs, other classifications and non-draft records', () => {
    expect(() => validateFinancialRows([rows[0], rows[0]])).toThrow()
    expect(() => validateFinancialRows([{ ...rows[0], classification: 'COMMERCIAL' }])).toThrow()
    expect(() => validateFinancialRows([{ ...rows[0], approval: 'approved' }])).toThrow()
  })
  it('bounds request bodies and requires JSON', async () => {
    const request = (text: string, type = 'application/json') => Object.assign(Readable.from([text]), { headers: { 'content-type': type } }) as IncomingMessage
    await expect(readExportRequest(request('{"scope":"combined","zarPerGbp":25}'))).resolves.toEqual({ scope: 'combined', zarPerGbp: 25 })
    await expect(readExportRequest(request(' '.repeat(1025)))).rejects.toThrow()
    await expect(readExportRequest(request('{}', 'text/plain'))).rejects.toThrow()
  })
})
