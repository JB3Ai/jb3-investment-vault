/** Offline import contract. Never import populated manifests into the browser app. */
import type { Disclosure } from '../src/types'
import type { PipelineStage } from '../src/content/modules'

export const sectionMap = [
  ['introduction', 'introduction', 'Founder biography, executive introduction and publication approval'],
  ['current-position', 'current-position', 'Dated operating position, liabilities, resources and reconciled income'],
  ['history-evidence', 'history-and-evidence', '2024–2025 chronology, laboratory records and licensed photographs'],
  ['assets-claims', 'assets', 'Asset register, title, valuation basis, encumbrances and disputed claims'],
  ['financial-requirements', 'immediate-funding', 'Funding amount, currency, due dates, use of funds and supporting quotes'],
  ['beobacht-alignment', 'beobacht-alignment', 'Proposed scope, correspondence and mutually approved commitments'],
  ['commercial-pipeline', 'pipeline', 'Named opportunities, dated stage evidence and separate prospective values'],
  ['southern-african-strategy', 'southern-african-strategy', 'Priority countries, market evidence, partners and delivery constraints'],
  ['financial-forecast', 'financial-forecast', 'Reconciled actuals, dated assumptions, costs, cash and forecast method'],
  ['investment-structures', 'investment-structures', 'Three proposed structures, draft terms and review of rights and obligations'],
  ['closing', 'closing', 'Approved next steps, diligence owner and authorised contact details'],
] as const
export type SectionId = typeof sectionMap[number][0]
export type Phase2Topic = typeof sectionMap[number][1]
export type EvidenceClassification = 'documented' | 'reported' | 'disputed' | 'awaiting-verification'
export interface Review { reviewer: string; reviewedOn: string; conclusion: string }
export interface EvidenceRecord {
  id: string
  sectionId: SectionId
  disclosure: Disclosure
  claim: string
  classification: EvidenceClassification
  sourceIds: string[]
  reportedBy: string | null
  dispute: string | null
  review: Review | null
}
/** Opaque inventory ID, never a URL, local path, signed URL, or embedded file. */
export interface PrivateSource {
  id: string
  title: string
  sha256: string
  custody: 'private-offline'
  receivedOn: string
}
export interface RecordBase {
  id: string
  sectionId: SectionId
  disclosure: Disclosure
  evidenceIds: string[]
}
export interface NarrativeImport extends RecordBase {
  heading: string
  body: string
  review: Review | null
}
export interface PhotographImport extends RecordBase {
  sourceId: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  caption: string
  alt: string
  capturedOn: string | null
  rights: { owner: string; permissionEvidenceId: string; clearedForVault: boolean }
}
export interface PdfImport extends RecordBase {
  sourceId: string
  title: string
  mimeType: 'application/pdf'
  byteLength: number
  documentDate: string | null
  proposedObjectKey: string | null
  approved: false
}
/** Minor units avoid rounding; missing is null, never zero. Currency is explicit. */
export interface Money { minorUnits: number; currency: string }
export interface OpportunityImport extends RecordBase {
  name: string
  counterparty: string | null
  sector: string
  stage: PipelineStage
  asOf: string
  prospectiveValue: Money | null
  probabilityPercent: number | null
  expectedCloseOn: string | null
  incomeTreatment: 'prospective-only'
}
export interface FinancialFigureImport extends RecordBase {
  kind: 'actual-income' | 'operating-cost' | 'opening-cash' | 'funding-need' | 'forecast-revenue'
  basis: 'actual' | 'reported' | 'assumption'
  amount: Money | null
  periodStart: string
  periodEnd: string
  asOf: string
  methodology: string | null
  review: Review | null
}
export interface Phase2Import {
  schemaVersion: 1
  accessEnabled: false
  sources: PrivateSource[]
  evidence: EvidenceRecord[]
  narratives: NarrativeImport[]
  photographs: PhotographImport[]
  pdfs: PdfImport[]
  opportunities: OpportunityImport[]
  financialFigures: FinancialFigureImport[]
}
/** Blank intake only. No synthetic demo figures are copied into Phase 2. */
export function emptyPhase2Import(): Phase2Import {
  return { schemaVersion: 1, accessEnabled: false, sources: [], evidence: [], narratives: [], photographs: [], pdfs: [], opportunities: [], financialFigures: [] }
}

export interface ImportIssue { recordId: string; code: string; message: string }
export function inspectPhase2(input: Phase2Import) {
  const issues: ImportIssue[] = []
  const issue = (recordId: string, code: string, message: string) => issues.push({ recordId, code, message })
  const validSection = (id: string) => sectionMap.some(s => s[0] === id)
  const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
  const reviewValid = (v: Review | null) => !!v && !!v.reviewer.trim() && date(v.reviewedOn) && !!v.conclusion.trim()
  const moneyValid = (v: Money | null) => v !== null && Number.isSafeInteger(v.minorUnits) && /^[A-Z]{3}$/.test(v.currency)
  const opaque = (v: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(v)
  if (input.schemaVersion !== 1 || input.accessEnabled !== false) issue('manifest', 'release-closed', 'Schema 1 and disabled release are required.')
  const allRecords = [...input.sources, ...input.evidence, ...input.narratives, ...input.photographs, ...input.pdfs, ...input.opportunities, ...input.financialFigures]
  const ids = new Set<string>()
  for (const r of allRecords) {
    if (!opaque(r.id) || ids.has(r.id)) issue(r.id, 'record-id', 'IDs must be unique opaque identifiers across the manifest.')
    ids.add(r.id)
    if ('sectionId' in r && !validSection(r.sectionId)) issue(r.id, 'section-id', 'Unknown existing section ID.')
  }
  const sources = new Map(input.sources.map(s => [s.id, s]))
  const evidence = new Map(input.evidence.map(e => [e.id, e]))
  for (const s of input.sources) {
    if (s.custody !== 'private-offline' || !/^[a-f0-9]{64}$/i.test(s.sha256) || !date(s.receivedOn) || !s.title.trim()) issue(s.id, 'source', 'Private custody, SHA-256, title and received date are required.')
  }
  for (const e of input.evidence) {
    if (!['PRIVATE', 'COMMERCIAL'].includes(e.disclosure)) issue(e.id, 'disclosure', 'Explicit evidence disclosure tier required.')
    if (!['documented', 'reported', 'disputed', 'awaiting-verification'].includes(e.classification) || !e.claim.trim()) issue(e.id, 'classification', 'A claim and explicit evidence classification are required.')
    if (e.sourceIds.some(id => !sources.has(id))) issue(e.id, 'source-reference', 'Referenced source is absent.')
    if (e.classification === 'documented' && !e.sourceIds.length) issue(e.id, 'documented-source', 'Documented evidence needs a source; it does not imply verification.')
    if (e.classification === 'reported' && !e.reportedBy?.trim()) issue(e.id, 'reporter', 'Reported evidence needs an attributable reporter.')
    if (e.classification === 'disputed' && !e.dispute?.trim()) issue(e.id, 'dispute', 'Preserve the dispute and competing account.')
    if (e.review && !reviewValid(e.review)) issue(e.id, 'review', 'Review metadata is incomplete.')
  }
  const supported = (r: RecordBase) => r.evidenceIds.length > 0 && r.evidenceIds.every(id => {
    const e = evidence.get(id)
    return e?.classification === 'documented' && reviewValid(e.review) && e.sourceIds.length > 0 && e.sourceIds.every(s => sources.has(s))
  })
  const content = [...input.narratives, ...input.photographs, ...input.pdfs, ...input.opportunities, ...input.financialFigures]
  for (const r of content) {
    if (!['PRIVATE', 'COMMERCIAL'].includes(r.disclosure)) issue(r.id, 'disclosure', 'Explicit disclosure tier required.')
    if (!r.evidenceIds.length) issue(r.id, 'missing-evidence', 'No evidence linked.')
    if (r.evidenceIds.some(id => !evidence.has(id))) issue(r.id, 'evidence-reference', 'Referenced evidence is absent.')
    if (r.disclosure === 'COMMERCIAL' && r.evidenceIds.some(id => evidence.get(id)?.disclosure === 'PRIVATE')) issue(r.id, 'private-evidence', 'Private evidence cannot silently become commercial content; prepare an approved redacted source separately.')
  }
  for (const n of input.narratives) {
    if (!n.heading.trim() || !n.body.trim()) issue(n.id, 'narrative', 'Heading and body are required.')
    if (!supported(n) || !reviewValid(n.review)) issue(n.id, 'narrative-review', 'Narrative is not ready as verified copy; documented reviewed sources and editorial review are required.')
  }
  for (const p of [...input.photographs, ...input.pdfs]) {
    if (!sources.has(p.sourceId)) issue(p.id, 'private-source', 'Private inventory source is absent.')
    if (!p.evidenceIds.some(id => evidence.get(id)?.sourceIds.includes(p.sourceId))) issue(p.id, 'asset-provenance', 'Asset source must occur in its linked evidence.')
  }
  for (const p of input.photographs) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(p.mimeType)) issue(p.id, 'photo-format', 'Supported photograph MIME type required.')
    if (!p.alt.trim() || !p.caption.trim() || !p.rights.owner.trim() || !p.rights.clearedForVault || !p.evidenceIds.includes(p.rights.permissionEvidenceId) || !supported(p)) issue(p.id, 'photo-clearance', 'Photograph needs caption, alt text, reviewed evidence and recorded permission.')
    if (p.capturedOn !== null && !date(p.capturedOn)) issue(p.id, 'photo-date', 'Invalid capture date.')
  }
  for (const p of input.pdfs) {
    if (p.approved !== false || p.mimeType !== 'application/pdf' || !Number.isSafeInteger(p.byteLength) || p.byteLength < 1 || p.byteLength > 26214400) issue(p.id, 'pdf', 'PDF must remain unapproved and fit the existing 25 MiB limit.')
    if (p.proposedObjectKey !== null && !/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.pdf$/.test(p.proposedObjectKey)) issue(p.id, 'object-key', 'Use an opaque private object key, never a public/local path or URL.')
    if (p.documentDate !== null && !date(p.documentDate)) issue(p.id, 'pdf-date', 'Invalid document date.')
  }
  for (const o of input.opportunities) {
    if (!o.name.trim() || !o.sector.trim() || !['Exploration', 'Qualified', 'Proposal', 'Diligence', 'Signed'].includes(o.stage)) issue(o.id, 'opportunity', 'Name, sector and recognised stage required.')
    if (o.incomeTreatment !== 'prospective-only') issue(o.id, 'pipeline-income', 'Pipeline, including signed opportunities, is never automatically actual income.')
    if (o.prospectiveValue !== null && (!moneyValid(o.prospectiveValue) || o.prospectiveValue.minorUnits < 0)) issue(o.id, 'opportunity-value', 'Invalid prospective value.')
    if (o.probabilityPercent !== null && (!Number.isFinite(o.probabilityPercent) || o.probabilityPercent < 0 || o.probabilityPercent > 100)) issue(o.id, 'probability', 'Probability must be missing or between 0 and 100.')
    if (!date(o.asOf) || (o.expectedCloseOn !== null && !date(o.expectedCloseOn))) issue(o.id, 'opportunity-date', 'Valid dated opportunity metadata required.')
    if (o.stage === 'Signed' && !supported(o)) issue(o.id, 'signed-evidence', 'Signed stage requires reviewed documentary evidence.')
  }
  for (const f of input.financialFigures) {
    if (!['actual', 'reported', 'assumption'].includes(f.basis) || !['actual-income', 'operating-cost', 'opening-cash', 'funding-need', 'forecast-revenue'].includes(f.kind)) issue(f.id, 'financial-kind', 'Recognised figure kind and basis required.')
    if (f.kind === 'forecast-revenue' && f.basis !== 'assumption') issue(f.id, 'forecast-basis', 'Forecast revenue must remain an assumption, never an actual.')
    if (!moneyValid(f.amount)) issue(f.id, 'missing-amount', 'An explicit finite amount in minor units and currency is required; unknown is not zero.')
    if (!date(f.periodStart) || !date(f.periodEnd) || !date(f.asOf) || f.periodStart > f.periodEnd) issue(f.id, 'financial-period', 'A valid ordered period and as-of date are required.')
    if (f.basis === 'actual' && (!supported(f) || !reviewValid(f.review))) issue(f.id, 'actual-evidence', 'Actuals require reviewed documented sources and reconciliation review.')
    if (f.kind === 'actual-income' && f.basis !== 'actual') issue(f.id, 'income-basis', 'Reported or assumed figures cannot be actual income.')
    if ((f.basis === 'assumption' || f.kind === 'forecast-revenue') && !f.methodology?.trim()) issue(f.id, 'forecast-method', 'Forecasts and assumptions require an explicit method.')
  }
  const verifiedNarrativeIds = issues.length ? [] : input.narratives.filter(n => supported(n) && reviewValid(n.review)).map(n => n.id)
  return {
    accessEnabled: false as const, issues, verifiedNarrativeIds,
    sections: sectionMap.map(([sectionId, topic, required], index) => ({
      number: index + 1, sectionId, topic, required,
      narrativeIds: input.narratives.filter(n => n.sectionId === sectionId).map(n => n.id),
      evidenceIds: input.evidence.filter(e => e.sectionId === sectionId).map(e => e.id),
      status: input.narratives.some(n => n.sectionId === sectionId && verifiedNarrativeIds.includes(n.id)) ? 'ready-for-private-staging' as const : 'awaiting-material-or-verification' as const,
    })),
  }
}
