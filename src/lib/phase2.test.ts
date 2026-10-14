import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { demoSections } from '../content/registry'
import { emptyPhase2Import, inspectPhase2, sectionMap, type Phase2Import } from '../../content-migration/phase2'

// All fixtures below are synthetic. They prove validation, not real verification.
const review = { reviewer: 'TEST REVIEWER', reviewedOn: '2026-10-14', conclusion: 'Synthetic test only' }
function fixture(): Phase2Import {
  const data = emptyPhase2Import()
  data.sources.push({ id: 'source-test', title: 'Synthetic source', custody: 'private-offline', sha256: 'a'.repeat(64), receivedOn: '2026-10-14' })
  data.evidence.push({ id: 'evidence-test', sectionId: 'introduction', disclosure: 'PRIVATE', claim: 'Synthetic claim', classification: 'documented', sourceIds: ['source-test'], reportedBy: null, dispute: null, review })
  data.narratives.push({ id: 'narrative-test', sectionId: 'introduction', disclosure: 'PRIVATE', heading: 'Synthetic heading', body: 'Synthetic narrative, not a real claim.', evidenceIds: ['evidence-test'], review })
  return data
}
describe('Phase 2 offline migration', () => {
  it('maps all 11 existing IDs without changing display titles or seeding actuals', () => {
    expect(sectionMap.map(s => s[0])).toEqual(demoSections.map(s => s.id))
    expect(sectionMap[4][1]).toBe('immediate-funding')
    const plan = inspectPhase2(emptyPhase2Import())
    expect(plan.sections).toHaveLength(11)
    expect(plan.sections.every(s => s.status === 'awaiting-material-or-verification')).toBe(true)
    expect(plan.verifiedNarrativeIds).toEqual([])
    expect(plan.accessEnabled).toBe(false)
  })
  it('allows reviewed documentary narrative to be staged, never released', () => {
    const plan = inspectPhase2(fixture())
    expect(plan.issues).toEqual([])
    expect(plan.verifiedNarrativeIds).toEqual(['narrative-test'])
    expect(plan.accessEnabled).toBe(false)
  })
  it.each(['reported', 'disputed', 'awaiting-verification'] as const)('never promotes %s evidence to verified narrative', classification => {
    const data = fixture()
    Object.assign(data.evidence[0], { classification, reportedBy: 'TEST REPORTER', dispute: 'Synthetic contested account' })
    expect(inspectPhase2(data).verifiedNarrativeIds).toEqual([])
  })
  it('does not equate documentation with verification', () => {
    const data = fixture(); data.evidence[0].review = null
    expect(inspectPhase2(data).issues.some(i => i.code === 'narrative-review')).toBe(true)
  })
  it('rejects missing provenance, duplicate IDs and private to commercial escalation', () => {
    const data = fixture()
    data.narratives[0].disclosure = 'COMMERCIAL'
    data.sources.push({ ...data.sources[0] })
    data.evidence[0].sourceIds = ['missing']
    expect(inspectPhase2(data).issues.map(i => i.code)).toEqual(expect.arrayContaining(['record-id', 'source-reference', 'private-evidence']))
  })
  it('requires photo rights and rejects public, signed and traversal PDF references', () => {
    for (const path of ['https://host/file.pdf?token=x', 'public/file.pdf/../secret', '../secret.pdf', 'C:\\private\\file.pdf']) {
      const data = fixture()
      data.pdfs.push({ id: 'pdf-test', sectionId: 'introduction', disclosure: 'PRIVATE', evidenceIds: ['evidence-test'], sourceId: 'source-test', title: 'Synthetic PDF', mimeType: 'application/pdf', byteLength: 100, documentDate: null, proposedObjectKey: path, approved: false })
      data.photographs.push({ id: 'photo-test', sectionId: 'introduction', disclosure: 'PRIVATE', evidenceIds: ['evidence-test'], sourceId: 'source-test', mimeType: 'image/jpeg', caption: 'Synthetic', alt: 'Synthetic', capturedOn: null, rights: { owner: 'Test', permissionEvidenceId: 'evidence-test', clearedForVault: false } })
      expect(inspectPhase2(data).issues.map(i => i.code)).toEqual(expect.arrayContaining(['object-key', 'photo-clearance']))
    }
  })
  it('distinguishes missing financial amounts from verified zero and refuses assumed actual income', () => {
    const data = fixture()
    data.financialFigures.push({ id: 'figure-test', sectionId: 'current-position', disclosure: 'PRIVATE', evidenceIds: ['evidence-test'], kind: 'actual-income', basis: 'actual', amount: null, periodStart: '2026-10-01', periodEnd: '2026-10-14', asOf: '2026-10-14', methodology: null, review })
    expect(inspectPhase2(data).issues.some(i => i.code === 'missing-amount')).toBe(true)
    data.financialFigures[0].amount = { minorUnits: 0, currency: 'ZAR' }
    expect(inspectPhase2(data).issues).toEqual([])
    data.financialFigures[0].basis = 'assumption'
    expect(inspectPhase2(data).issues.map(i => i.code)).toContain('income-basis')
  })
  it('rejects invalid periods, non-finite figures and unsupported signed opportunities', () => {
    const data = fixture(); data.evidence[0].review = null
    data.financialFigures.push({ id: 'figure-test', sectionId: 'financial-forecast', disclosure: 'PRIVATE', evidenceIds: ['evidence-test'], kind: 'forecast-revenue', basis: 'assumption', amount: { minorUnits: Infinity, currency: 'ZAR' }, periodStart: '2026-02-30', periodEnd: '2025-01-01', asOf: '2026-10-14', methodology: null, review: null })
    data.opportunities.push({ id: 'opportunity-test', sectionId: 'commercial-pipeline', disclosure: 'PRIVATE', evidenceIds: ['evidence-test'], name: 'Synthetic', counterparty: null, sector: 'Synthetic', stage: 'Signed', asOf: '2026-10-14', prospectiveValue: null, probabilityPercent: 101, expectedCloseOn: null, incomeTreatment: 'prospective-only' })
    expect(inspectPhase2(data).issues.map(i => i.code)).toEqual(expect.arrayContaining(['missing-amount', 'financial-period', 'forecast-method', 'probability', 'signed-evidence']))
  })
  it('keeps the release migration disabled and the frontend disconnected from Phase 2', () => {
    const sql = readFileSync('supabase/migrations/20261013195840_vault_access.sql', 'utf8')
    expect(sql).toContain('access_enabled boolean not null default false')
    expect(readFileSync('src/lib/useVault.ts', 'utf8')).not.toContain('content-migration')
    expect(readFileSync('src/content/registry.ts', 'utf8')).not.toContain('content-migration')
  })
})
