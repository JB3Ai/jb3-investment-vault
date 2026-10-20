import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { privateFile } from '../content-migration/local-importer.ts'
import type { ContentManifest } from '../content-migration/ingestion-schema.ts'
import { commercialCategories, commercialDocumentVisible, type CommercialReview } from '../src/lib/commercialReview.ts'
export function parseCommercialReview(value: unknown, manifest: ContentManifest): CommercialReview {
  const review = value as CommercialReview, section = manifest.sections.find(section => section.id === 'commercial-pipeline')
  const records = new Map(manifest.sections.flatMap(section => section.records.map(record => [record.id, record] as const)))
  const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
  if (!review || review.format !== 'JB3_COMMERCIAL_REVIEW_V1' || review.classification !== 'BRUCE_PRIVATE' || review.approval !== 'draft' || !text(review.owner) || !/^\d{4}-\d{2}-\d{2}$/.test(review.recordedOn) || !text(review.source?.originalFilename) || !text(review.source.relativePath) || !/^[a-f0-9]{64}$/.test(review.source.sha256) || !Array.isArray(review.entries) || !review.entries.length || new Set(review.entries.map(entry => entry.recordId)).size !== review.entries.length) throw Error('Invalid commercial review')
  for (const entry of review.entries) {
    const record = section?.records.find(record => record.id === entry.recordId)
    if (!record || record.kind !== 'opportunity' || record.classification !== 'BRUCE_PRIVATE' || record.approval !== 'draft' || record.verification !== 'reported' || record.payload.name !== entry.title || record.payload.stage === 'Signed' || record.payload.incomeTreatment !== 'prospective-only' || record.provenance.sourceReference !== 'sha256:' + review.source.sha256 || !commercialDocumentVisible({ title: entry.title, originalFilename: '' }) || !Object.hasOwn(commercialCategories,entry.category) || !text(entry.positioning) || !Array.isArray(entry.limitations) || !entry.limitations.length || !entry.limitations.every(text) || !Array.isArray(entry.missingEvidence) || !entry.missingEvidence.every(text) || entry.confirmedRevenueMinor !== null || entry.forecastContributionMinor !== 0 || entry.assetContributionMinor !== 0 || typeof entry.thirdPartyIp !== 'boolean' || !Array.isArray(entry.sourceDocuments) || !Array.isArray(entry.quotedValues)) throw Error('Commercial annotation does not match its draft opportunity')
    if (entry.category === 'potential-distribution' && (!entry.thirdPartyIp || !text(entry.ownershipNote))) throw Error('Distribution review must separate third-party IP')
    for (const source of entry.sourceDocuments) {
      const document = records.get(source.recordId)
      if (!document || document.kind !== 'pdf' || document.classification !== 'BRUCE_PRIVATE' || !commercialDocumentVisible({ title: String(document.payload.title), originalFilename: document.provenance.originalFilename }) || !['technical-context', 'internal-audit', 'subject-brochure'].includes(source.relation) || !text(source.citation) || !/\bp(?:p)?\.?\s*\d+/i.test(source.citation)) throw Error('Invalid commercial source association')
    }
    for (const quote of entry.quotedValues) {
      if (!Number.isSafeInteger(quote.amountMinor) || quote.amountMinor < 0 || !['ZAR','GBP'].includes(quote.currency) || quote.treatment !== 'historical-quoted-or-proposed' || !text(quote.citation) || !entry.sourceDocuments.some(source => source.recordId === quote.sourceDocumentId) || entry.thirdPartyIp) throw Error('Unsupported quoted value or third-party valuation')
    }
  }
  return review
}
export async function loadCommercialReview(root: string, manifest: ContentManifest) {
  let value
  try { value = JSON.parse(await readFile(await privateFile(root, 'intake-brochures-01/review/commercial-review.json'), 'utf8')) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error }
  const review = parseCommercialReview(value, manifest)
  if (createHash('sha256').update(await readFile(await privateFile(root, review.source.relativePath))).digest('hex') !== review.source.sha256) throw Error('Commercial owner-source checksum mismatch')
  return review
}
