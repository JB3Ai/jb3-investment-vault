// Schema code is safe to version; populated manifests are private and must stay external.
export const sectionIds = ['introduction', 'current-position', 'history-evidence', 'assets-claims', 'financial-requirements', 'beobacht-alignment', 'commercial-pipeline', 'southern-african-strategy', 'financial-forecast', 'investment-structures', 'closing'] as const
export type ContentSectionId = typeof sectionIds[number]
export const classifications = ['BRUCE_PRIVATE', 'COMMERCIAL', 'LEGAL_RESTRICTED'] as const
export type Classification = typeof classifications[number]
export interface Provenance {
  originalFilename: string
  sourceDate: string | null
  citation: string
  sourceReference: string
  reviewedBy: string | null
  reviewedOn: string | null
  conflictNote: string | null
}
export interface ContentRecord {
  id: string
  kind: 'narrative' | 'photograph' | 'pdf' | 'opportunity' | 'financial'
  classification: Classification
  verification: 'documented' | 'reported' | 'disputed' | 'awaiting-verification'
  approval: 'draft' | 'approved' | 'rejected'
  provenance: Provenance
  payload: Record<string, string | number | null>
  file: { relativePath: string; sha256: string; mimeType: string } | null
}
export interface ContentManifest {
  format: 'JB3_PRIVATE_CONTENT_V1'
  releaseEnabled: false
  sections: { id: ContentSectionId; records: ContentRecord[] }[]
}
export function blankManifest(): ContentManifest {
  return { format: 'JB3_PRIVATE_CONTENT_V1', releaseEnabled: false, sections: sectionIds.map(id => ({ id, records: [] })) }
}
function check(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
function object(value: unknown, keys: string[], where: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), `${where}: object required`)
  const result = value as Record<string, unknown>
  check(Object.keys(result).length === keys.length && keys.every(k => Object.hasOwn(result, k)), `${where}: exact schema fields required`)
  return result
}
function text(value: unknown, nullable = false): boolean { return nullable && value === null || typeof value === 'string' && value.trim().length > 0 && value.length <= 100000 }
function date(value: unknown, nullable = false): boolean {
  return nullable && value === null || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
function member(value: unknown, values: readonly string[]) { return typeof value === 'string' && values.includes(value) }
export function parseManifest(value: unknown): ContentManifest {
  const root = object(value, ['format', 'releaseEnabled', 'sections'], 'manifest')
  check(root.format === 'JB3_PRIVATE_CONTENT_V1' && root.releaseEnabled === false, 'Private manifest must keep release disabled')
  check(Array.isArray(root.sections) && root.sections.length === 11, 'All eleven sections required')
  const ids = new Set<string>()
  for (const [index, input] of root.sections.entries()) {
    const section = object(input, ['id', 'records'], `section ${index + 1}`)
    check(section.id === sectionIds[index] && Array.isArray(section.records), 'Section IDs/order must match the approved registry')
    for (const [ri, raw] of section.records.entries()) {
      const where = `section ${index + 1}, record ${ri + 1}`
      const r = object(raw, ['id', 'kind', 'classification', 'verification', 'approval', 'provenance', 'payload', 'file'], where)
      check(typeof r.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.id) && !ids.has(r.id.toLowerCase()), `${where}: unique UUID required`)
      ids.add(r.id.toLowerCase())
      check(member(r.kind, ['narrative', 'photograph', 'pdf', 'opportunity', 'financial']) && member(r.classification, classifications) && member(r.verification, ['documented', 'reported', 'disputed', 'awaiting-verification']) && member(r.approval, ['draft', 'approved', 'rejected']), `${where}: invalid classification/status/kind`)
      const p = object(r.provenance, ['originalFilename', 'sourceDate', 'citation', 'sourceReference', 'reviewedBy', 'reviewedOn', 'conflictNote'], where)
      check(text(p.originalFilename) && !/[\\/\x00-\x1f]/.test(p.originalFilename as string) && date(p.sourceDate, true) && text(p.citation) && text(p.sourceReference) && text(p.reviewedBy, true) && date(p.reviewedOn, true) && text(p.conflictNote, true), `${where}: invalid provenance`)
      check(r.verification !== 'disputed' || text(p.conflictNote), `${where}: preserve the unresolved dispute`)
      check(r.approval !== 'approved' || r.verification !== 'awaiting-verification' && text(p.reviewedBy) && date(p.reviewedOn), `${where}: approval needs a named dated review and classified evidence`)
      const fields: Record<string, string[]> = {
        narrative: ['heading', 'body'], photograph: ['caption', 'alt'], pdf: ['title'],
        opportunity: ['name', 'stage', 'currency', 'valueMinor', 'probabilityPercent', 'asOf', 'incomeTreatment'],
        financial: ['label', 'kind', 'basis', 'amountMinor', 'currency', 'periodStart', 'periodEnd', 'reconciliationNote'],
      }
      const payload = object(r.payload, fields[r.kind as string], where)
      if (r.kind === 'narrative' || r.kind === 'photograph' || r.kind === 'pdf') check(Object.values(payload).every(v => text(v)), `${where}: text fields required`)
      if (r.kind === 'opportunity' || r.kind === 'financial') {
        check(typeof payload.currency === 'string' && /^[A-Z]{3}$/.test(payload.currency), `${where}: explicit currency required`)
        const amount = r.kind === 'financial' ? payload.amountMinor : payload.valueMinor
        check(amount === null || typeof amount === 'number' && Number.isSafeInteger(amount), `${where}: integer minor units or null required`)
      }
      if (r.kind === 'opportunity') {
        check(text(payload.name) && member(payload.stage, ['Exploration', 'Qualified', 'Proposal', 'Diligence', 'Signed']) && date(payload.asOf) && payload.incomeTreatment === 'prospective-only', `${where}: invalid opportunity metadata`)
        check(payload.probabilityPercent === null || typeof payload.probabilityPercent === 'number' && Number.isFinite(payload.probabilityPercent) && payload.probabilityPercent >= 0 && payload.probabilityPercent <= 100, `${where}: invalid probability`)
        check(payload.stage !== 'Signed' || r.verification === 'documented', `${where}: signed stage needs documented evidence`)
      }
      if (r.kind === 'financial') {
        check(text(payload.label) && member(payload.kind, ['actual-income', 'operating-cost', 'opening-cash', 'funding-need', 'forecast-revenue', 'repayment']) && member(payload.basis, ['actual', 'reported', 'assumption']) && date(payload.periodStart, r.approval !== 'approved') && date(payload.periodEnd, r.approval !== 'approved') && (payload.periodStart === null || payload.periodEnd === null || String(payload.periodStart) <= String(payload.periodEnd)) && text(payload.reconciliationNote, true), `${where}: invalid financial metadata`)
        check(payload.kind !== 'actual-income' || payload.basis === 'actual', `${where}: income cannot be promoted from a forecast`)
        check(payload.kind !== 'forecast-revenue' || payload.basis === 'assumption', `${where}: forecasts must remain assumptions`)
        check(payload.basis !== 'actual' || r.verification === 'documented' && p.conflictNote === null && text(payload.reconciliationNote), `${where}: actuals need documented reconciliation without unresolved conflict`)
        check(r.approval !== 'approved' || payload.amountMinor !== null, `${where}: approved financial amount cannot be missing`)
      }
      if (r.kind === 'pdf' || r.kind === 'photograph') {
        const file = object(r.file, ['relativePath', 'sha256', 'mimeType'], where)
        check(typeof file.relativePath === 'string' && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_. ()-]+)+$/.test(file.relativePath) && !file.relativePath.split('/').includes('..') && typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(file.sha256), `${where}: safe relative file and SHA-256 required`)
        check(r.kind === 'pdf' ? file.mimeType === 'application/pdf' : member(file.mimeType, ['image/jpeg', 'image/png', 'image/webp']), `${where}: unsupported media type`)
      } else check(r.file === null, `${where}: only photographs and PDFs attach binary files`)
    }
  }
  return value as ContentManifest
}
