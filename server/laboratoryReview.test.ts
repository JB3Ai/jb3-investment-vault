import { describe, expect, it } from 'vitest'
import { parseLaboratoryReview } from './laboratoryReview'
import { youtubeId, type LaboratoryEvidenceReview } from '../src/lib/laboratoryEvidence'
import type { ContentRecord } from '../content-migration/ingestion-schema'
const photos = Array.from({ length: 12 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, kind: 'photograph', classification: 'BRUCE_PRIVATE', approval: 'draft', verification: 'awaiting-verification', provenance: { originalFilename: `synthetic-${index + 1}.jpeg` }, file: { relativePath: `synthetic/${String(index + 1).padStart(2, '0')}.jpeg`, sha256: String(index + 1).padStart(64, '0'), mimeType: 'image/jpeg' } })) as ContentRecord[]
const reference = (number: number) => ({ originalNumber: number, recordId: photos[number - 1].id, sha256: photos[number - 1].file!.sha256 })
function fixture(): LaboratoryEvidenceReview {
  return { format: 'JB3_LABORATORY_REVIEW_V1', classification: 'BRUCE_PRIVATE', approval: 'draft', verification: 'awaiting-verification', sequenceSource: 'founder-provided', recordedBy: 'Synthetic owner', recordedOn: '2026-10-19', slots: [4,5,6,7,8,9,10,11,12,null,null,3].map((number, index) => ({ position: index + 1, ...(number === null ? { recordId: null, originalNumber: null, sha256: null } : reference(number)) })), unplaced: [reference(1), reference(2)], videos: [{ id: '00000000-0000-4000-8000-999999999999', url: 'https://youtu.be/synthetic01', title: null, sourceDate: null, certification: null, classification: 'BRUCE_PRIVATE', approval: 'draft', verification: 'awaiting-verification', sourceReference: 'Synthetic only' }] }
}
describe('private laboratory display review', () => {
  it('retains every photo and provenance unchanged while leaving gaps explicit', () => {
    const before = JSON.stringify(photos), value = fixture()
    expect(parseLaboratoryReview(value, photos)).toBe(value)
    expect(value.slots.filter(slot => slot.recordId === null)).toHaveLength(2)
    expect(JSON.stringify(photos)).toBe(before)
  })
  it.each(['duplicate', 'lost', 'hash', 'original', 'classification', 'chronology', 'video-date', 'video-title', 'video-approval', 'video-host'])('fails closed for %s', problem => {
    const value = fixture()
    if (problem === 'duplicate') value.slots[0] = { position: 1, ...reference(5) }
    if (problem === 'lost') value.unplaced.pop()
    if (problem === 'hash') value.slots[0].sha256 = 'a'.repeat(64)
    if (problem === 'original') value.slots[0].originalNumber = 1
    if (problem === 'classification') Object.assign(value, { classification: 'COMMERCIAL' })
    if (problem === 'chronology') Object.assign(value, { sequenceSource: 'verified' })
    if (problem === 'video-date') Object.assign(value.videos[0], { sourceDate: '2020-01-01' })
    if (problem === 'video-title') Object.assign(value.videos[0], { title: 'Unverified claim' })
    if (problem === 'video-approval') Object.assign(value.videos[0], { approval: 'approved' })
    if (problem === 'video-host') value.videos[0].url = 'https://youtube.com.evil.example/watch?v=synthetic01'
    expect(() => parseLaboratoryReview(value, photos)).toThrow()
  })
  it.each(['http://youtu.be/synthetic01', 'https://www.youtube.com.evil.example/watch?v=synthetic01', 'https://www.youtube.com/other?v=synthetic01', 'javascript:alert(1)', 'https://user:pass@youtu.be/synthetic01', 'https://youtu.be/short'])('rejects unsupported video URL %s', url => expect(youtubeId(url)).toBeNull())
  it('supports only safe IDs from watch and short links', () => { expect(youtubeId('https://youtu.be/synthetic01')).toBe('synthetic01'); expect(youtubeId('https://www.youtube.com/watch?v=synthetic02')).toBe('synthetic02') })
})
