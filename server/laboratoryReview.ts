import type { ContentRecord } from '../content-migration/ingestion-schema.ts'
import type { LaboratoryEvidenceReview } from '../src/lib/laboratoryEvidence.ts'
import { youtubeId } from '../src/lib/laboratoryEvidence.ts'

/** Only validated review metadata can affect display; original records stay untouched. */
export function parseLaboratoryReview(input: unknown, photographs: ContentRecord[]): LaboratoryEvidenceReview {
  const value = input as LaboratoryEvidenceReview
  const fail = () => { throw new Error('Invalid private laboratory review metadata') }
  if (!value || value.format !== 'JB3_LABORATORY_REVIEW_V1' || value.classification !== 'BRUCE_PRIVATE' || value.approval !== 'draft' || value.verification !== 'awaiting-verification' || value.sequenceSource !== 'founder-provided' || !value.recordedBy || !/^\d{4}-\d{2}-\d{2}$/.test(value.recordedOn) || !Array.isArray(value.slots) || value.slots.length !== 12 || !Array.isArray(value.unplaced) || !Array.isArray(value.videos) || photographs.length !== 12) return fail()
  const seen = new Set<string>()
  function reference(item: { recordId: string; originalNumber: number; sha256: string }) {
    const photo = photographs.find(record => record.id === item.recordId)
    const number = Number(photo?.file?.relativePath.match(/\/(\d{2})\.jpeg$/)?.[1])
    if (!photo || seen.has(photo.id) || photo.kind !== 'photograph' || photo.classification !== 'BRUCE_PRIVATE' || photo.approval !== 'draft' || number !== item.originalNumber || photo.file?.sha256 !== item.sha256) return fail()
    seen.add(photo.id)
  }
  value.slots.forEach((slot, index) => {
    if (slot.position !== index + 1) return fail()
    if (slot.recordId === null) { if (slot.originalNumber !== null || slot.sha256 !== null) return fail() }
    else {
      if (typeof slot.recordId !== 'string' || !Number.isInteger(slot.originalNumber) || typeof slot.sha256 !== 'string') return fail()
      reference(slot as { recordId: string; originalNumber: number; sha256: string })
    }
  })
  value.unplaced.forEach(reference)
  if (seen.size !== photographs.length || value.unplaced.length !== value.slots.filter(slot => slot.recordId === null).length) return fail()
  const ids = new Set<string>()
  for (const video of value.videos) {
    if (typeof video.id !== 'string' || !/^[a-f0-9-]{36}$/.test(video.id) || ids.has(video.id) || !youtubeId(video.url) || video.title !== null || video.sourceDate !== null || video.certification !== null || video.classification !== 'BRUCE_PRIVATE' || video.approval !== 'draft' || video.verification !== 'awaiting-verification' || !video.sourceReference) return fail()
    ids.add(video.id)
  }
  return value
}
